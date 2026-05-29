# AI Assessment Creator Architecture & Orchestration

This document outlines the architecture, orchestration lifecycle, and engineering design of the AI Assessment Creator. Built as an enterprise-grade platform, this system orchestrates multi-provider Large Language Models (LLMs) to generate pedagogically rigorous examinations asynchronously.

The architecture is explicitly decoupled to handle long-running, unpredictable generative AI workloads via message queues, persistent state locks, and real-time WebSocket synchronization.

---

## Table of Contents
1. [System Architecture Overview](#1-system-architecture-overview)
2. [Core Workflows & Request Lifecycle](#2-core-workflows--request-lifecycle)
3. [AI Provider Orchestration Strategy](#3-ai-provider-orchestration-strategy)
4. [Generation Performance & Timeouts](#4-generation-performance--timeouts)
5. [Structured Output Enforcement](#5-structured-output-enforcement)
6. [File Upload & Processing Pipeline](#6-file-upload--processing-pipeline)
7. [Docker & Deployment Topology](#7-docker--deployment-topology)
8. [Operational & Engineering Decisions](#8-operational--engineering-decisions)
9. [Setup & Development Environment](#9-setup--development-environment)
10. [Known Limitations & Scaling Considerations](#10-known-limitations--scaling-considerations)

---

## 1. System Architecture Overview

The system operates across three distinct planes: the client (Next.js), the API Gateway (Express), and the background processing tier (Node.js/BullMQ). State is persisted in MongoDB, while Redis handles transient job queues, rate limiting, and distributed locking.

```mermaid
graph TD
    subgraph Client Tier
        UI[Next.js App Router]
        WS_Client[Socket.io Client]
    end

    subgraph API Tier
        API[Express API]
        WS_Server[Socket.io Server]
    end

    subgraph Orchestration Tier
        BullMQ[BullMQ Job Queue]
        Worker[Node.js Worker]
        LockManager[Redis Lock Manager]
    end

    subgraph Data Tier
        MongoDB[(MongoDB Persistent State)]
        Redis[(Redis Queue & Cache)]
    end

    subgraph AI Provider Tier
        Cohere[Cohere API]
        Groq[Groq API]
        OpenRouter[OpenRouter API]
    end

    UI -->|HTTP POST| API
    UI <-->|WebSocket| WS_Server
    
    API -->|Read/Write| MongoDB
    API -->|Enqueue Job| Redis
    
    Redis <--> BullMQ
    BullMQ -->|Dequeue| Worker
    Worker <-->|Acquire/Release Lock| LockManager
    LockManager <--> Redis
    
    Worker -->|Read/Write| MongoDB
    Worker -->|Emit Progress| WS_Server
    
    Worker -->|Tier 1/2/3 Routing| Cohere
    Worker -->|Tier 1/2/3 Routing| Groq
    Worker -->|Tier 1/2/3 Routing| OpenRouter
```

---

## 2. Core Workflows & Request Lifecycle

Generative AI requests often exceed standard HTTP timeout thresholds (30s+). Therefore, generation is completely detached from the HTTP request cycle.

### 2.1 Async Job Enqueueing & Execution

```mermaid
sequenceDiagram
    participant Client
    participant Express API
    participant MongoDB
    participant Redis (Queue)
    participant Worker
    
    Client->>Express API: POST /api/generate (Parameters)
    Express API->>MongoDB: Create Assignment Document (Status: Pending)
    Express API->>Redis: Enqueue Job (Queue: 'generation', Data: ID)
    Express API-->>Client: HTTP 202 Accepted (Returns Assignment ID)
    
    Note over Client,Express API: HTTP Request Ends. Client polls or connects via WS.
    
    Worker->>Redis: Dequeue Job
    Worker->>Redis: Acquire Lock (NX gen-lock:ID)
    Worker->>MongoDB: Update Status (Status: Generating)
    Worker->>Worker: Execute LLM Orchestration
    Worker->>MongoDB: Save Final Paper (Status: Completed)
    Worker->>Redis: Release Lock
```

### 2.2 Frontend-Backend WebSocket Synchronization

Because the HTTP request terminates immediately, the frontend relies on WebSockets for real-time progress hydration.

```mermaid
sequenceDiagram
    participant Client
    participant WebSocket Server
    participant Worker Queue
    
    Client->>WebSocket Server: Connect
    Client->>WebSocket Server: Emit 'join-room' (assignmentId)
    WebSocket Server-->>Client: Ack 'joined'
    
    loop During Generation
        Worker Queue->>WebSocket Server: Emit 'generation:progress' (Internal)
        WebSocket Server->>Client: Broadcast 'generation:progress' (Room)
        Client->>Client: Update Loading UI (e.g. "Generating Section A")
    end
    
    Worker Queue->>WebSocket Server: Emit 'generation:complete' (Internal)
    WebSocket Server->>Client: Broadcast 'generation:complete' (Room)
    Client->>Client: Fetch Final Document via HTTP
```

**Database Replication Lag Mitigation:**
Because the architecture uses a distributed MongoDB Replica Set, a Read-after-Write consistency race condition can occur when the WebSocket `completed` event triggers an instant HTTP GET request before the database fully syncs the completed state across nodes. 

To mitigate this, the frontend implements a **Retry with Exponential Backoff** architecture. If the fetched document returns a `processing` status immediately after a `completed` socket event, the client will wait 1,000ms and retry, ensuring perfect state reconciliation without requiring strict primary read preferences on the database.

### 2.3 Safe Deletion Orchestration

Hard deleting an assignment in a distributed architecture requires cleaning up state across multiple layers to prevent memory leaks and API cost bleeding. When `DELETE /api/assignments/:id` is called:

1. **Redis Cleanup**: The backend clears any active `gen-lock:ID` and `gen-run:ID` keys.
2. **BullMQ Termination**: The worker queue is queried for active or pending generation jobs (`gen-ID`). If found, the job is forcibly terminated (`job.remove()`), stopping any expensive LLM API calls mid-flight.
3. **MongoDB Deletion**: Finally, the document is securely purged from the primary database.
```

---

## 3. AI Provider Orchestration Strategy

Relying on a single LLM provider creates a single point of failure and wastes compute resources. The `LLMOrchestrator` implements cognitive-based model routing and automatic fallbacks.

### 3.1 Cognitive Tier Routing

Different question types demand different levels of reasoning:
- **Tier 3 (Lightning):** Groq (Llama 3). Used for MCQs and Short Answers. Generates hundreds of tokens per second.
- **Tier 2 (Moderate):** Gemma 2 / Mixtral. Used for Numerical Problems requiring basic math reasoning.
- **Tier 1 (Heavy):** Cohere (Command R) / Deepseek. Used for Long Answers and Diagram evaluation rubrics requiring deep synthesis.

### 3.2 Provider Fallback Execution

```mermaid
flowchart TD
    Start[Worker Begins Chunk Generation] --> TierCheck{Determine Required Tier}
    TierCheck -->|Tier 3| Groq[Attempt Groq Llama 3]
    TierCheck -->|Tier 1| Cohere[Attempt Cohere Command-R]
    
    Groq --> Success{Success?}
    Cohere --> Success
    
    Success -->|Yes| Output[Return JSON Payload]
    Success -->|No - HTTP 429 / Timeout| Fallback[Trigger Orchestrator Fallback]
    
    Fallback --> FetchEligible[Fetch next eligible provider from Registry]
    FetchEligible --> OpenRouter[Attempt OpenRouter Secondary]
    
    OpenRouter --> FinalSuccess{Success?}
    FinalSuccess -->|Yes| Output
    FinalSuccess -->|No| Abort[Throw Orchestration Error -> BullMQ Retry]
```

---

## 4. Generation Performance & Timeouts

Generating a full assessment requires massive token outputs. The backend is designed with strict performance budgets and safety mechanisms to handle this.

### 4.1 Token Generation Speeds & Chunking
- A typical 30-question MCQ paper requires outputting **~4,500 tokens**.
- Modern models (like Cohere Command R or Llama 3) generate at roughly **50 to 80 tokens per second**.
- If a user requests a single question type (e.g., just 30 MCQs), the `ChunkPlanner` groups it into a **single massive chunk**, taking **45 to 90 seconds** to complete.
- If multiple question types are requested, the planner breaks them into smaller sequential chunks, updating the UI progress incrementally.
- To prevent UI freezing during single massive chunks, the frontend utilizes an **Asymptotic Progress Simulation** that crawls the progress bar forward autonomously until the backend syncs.

### 4.2 The 3-Minute Hard Timeout & Abort Cascade
To protect server memory from hanging AI API requests, the orchestrator enforces a strict **3-minute (`180,000ms`) timeout** per chunk. 
If an AI provider (e.g., Cohere) experiences severe degradation and takes longer than 3 minutes, the following sequence occurs:
1. The orchestrator triggers an `AbortController`.
2. The primary request is instantly killed with a `"LLM request timed out"` or `"User aborted a request"` error.
3. The orchestrator attempts to cascade to fallback models (Deepseek, Llama, Gemma).
4. Because the global 3-minute timer has expired, the fallback models are instantly aborted in the same millisecond (`APIUserAbortError: Request was aborted`).
5. The `LLMOrchestrator` officially fails the attempt.
6. The background worker (BullMQ) catches the failure and **automatically schedules a full retry** (Attempt 2 of 3).

This mechanism ensures the system is self-healing and never permanently locks up during provider outages.

---

## 5. Structured Output Enforcement

LLMs are highly prone to injecting markdown wrappers (`````json ... `````) or conversational text around payloads, which breaks naive `JSON.parse()`.

### 4.1 Generation Pipeline

```mermaid
flowchart LR
    A[Raw LLM Output] --> B[String Sanitization]
    B --> C{Detect Markdown Block?}
    C -->|Yes| D[Extract content inside backticks]
    C -->|No| E[Attempt Parsing]
    D --> E
    E --> F[Parse JSON]
    F --> G[Zod Schema Validation]
    G -->|Valid| H[Accept Chunk]
    G -->|Invalid Schema| I[Reject -> Retry LLM Call]
```

**Optimization Note (Answer Keys):** To drastically reduce output tokens, the prompt strategy conditionally instructs the LLM to completely omit the `correctAnswer` field for non-MCQ questions or College-level papers. The Zod validation schema strictly supports this optionality to prevent validation crashes.

---

## 6. File Upload & Processing Pipeline

```mermaid
flowchart TD
    Upload[Client Uploads File] --> Multer[Express Multer Middleware]
    Multer --> Parse{File Type?}
    Parse -->|PDF| PDFExtract[pdf-parse Extraction]
    Parse -->|TXT| TXTExtract[Read File Buffer]
    PDFExtract --> Sanitizer[Strip non-UTF8 / Control Chars]
    TXTExtract --> Sanitizer
    Sanitizer --> Truncate[Truncate to Token Limit ~15k chars]
    Truncate --> Context[Inject into LLM Context Window]
```

---

## 7. Docker & Deployment Topology

The local development environment and production build utilize a containerized microservice approach.

```mermaid
graph TD
    subgraph Docker Host
        subgraph ai-assessment-frontend
            Next[Next.js Server: 3000]
        end
        subgraph ai-assessment-backend
            Express[Express & WS: 5001]
            WorkerNode[BullMQ Worker]
        end
        subgraph ai-assessment-redis
            RedisDB[(Redis: 6379)]
        end
        subgraph ai-assessment-mongo
            MongoDB[(MongoDB: 27017)]
        end
        
        Next --> Express
        Express <--> RedisDB
        Express <--> MongoDB
        WorkerNode <--> RedisDB
        WorkerNode <--> MongoDB
    end
```

---

## 8. Operational & Engineering Decisions

### 7.1 Why BullMQ and Redis?
- **Durability:** Standard `setTimeout` or `Promise.all` in Node.js disappears if the process crashes (e.g., OOM kill). BullMQ persists the job in Redis. If the server restarts, the job is dequeued and resumed.
- **Concurrency Control:** LLM APIs strictly rate-limit concurrent requests. BullMQ allows us to set exact concurrency limits across workers.

### 7.2 Redis State Locking
- **The Problem:** If a worker crashes midway through generation but BullMQ immediately retries the job while the original process is still somehow writing to DB, it causes race conditions (`ConcurrentRunError`).
- **The Solution:** Implemented distributed locking using Redis `SET key value NX PX ttl`. A worker must acquire the lock before generating. If the lock is held, the retry is aborted until the lock expires or is cleared.

### 7.3 Structured Output over Tools
- **Decision:** Rather than relying on fragile OpenAI Function Calling (which some OSS models on OpenRouter struggle with), the system injects a hardcoded JSON schema definition into the system prompt and utilizes Zod for backend enforcement. This guarantees cross-provider compatibility.

---

## 9. Setup & Development Environment

### 8.1 Prerequisites
- Node.js `v20+`
- Docker Engine `v24+` & Compose
- API Keys: Cohere, Groq, OpenRouter

### 8.2 Environment Configuration
Create `.env` in both `/backend` and `/frontend`.

**Backend (`/backend/.env`):**
```ini
PORT=5001
NODE_ENV=development
CLIENT_URL=http://localhost:3000
MONGODB_URI=mongodb://localhost:27017/ai-assessment
REDIS_URL=redis://localhost:6379
COHERE_API_KEY=your_key
GROQ_API_KEY=your_key
OPENROUTER_API_KEY=your_key
```

**Frontend (`/frontend/.env.local`):**
```ini
NEXT_PUBLIC_API_URL=http://localhost:5001/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5001
```

### 8.3 Bootstrapping Scripts

1. Start Infrastructure:
   ```bash
   docker-compose up -d
   ```
2. Start Backend API & Worker:
   ```bash
   cd backend && npm install && npm run dev
   ```
3. Start Frontend:
   ```bash
   cd frontend && npm install && npm run dev
   ```

---

## 10. Known Limitations & Scaling Considerations

- **State Lock Stalls:** If a Node process crashes violently without executing `finally` blocks, a Redis generation lock may persist. A manual flush (`DEL gen-lock:<id>`) is required.
- **Vector Search (RAG) Absence:** Currently, textbook uploads rely on a naive truncation strategy (15k characters). For large texts, a Vector Database (Pinecone/Milvus) should be introduced for semantic RAG injection.
- **Horizontal Scaling:** The backend currently runs the Express API and the BullMQ worker in the same process. To scale production horizontally, the worker logic should be decoupled into a standalone Docker image, allowing you to run 10x Worker containers independently of the API gateways.

---

## 11. Phase 3A — Directive Content & Code Navigation Layer

This README functions as both documentation and a repository navigation hub. Every architectural claim references actual implementation files.

### 11.1 Directive Content System

#### LLM Orchestrator
**Purpose:**
Routes requests to the most appropriate AI model based on capability, empirical success rate, provider health, capacity, load, cost, latency, and fallback rules.

**Responsibilities:**
- Candidate model selection via Empirical Scoring
- Capability matching
- Provider failover and circuit breaking
- Capacity-aware routing and load balancing
- Telemetry generation (`[ROUTING_DECISION]`)

**Inputs:** `LLMRequest` (system prompt, expected schema, required capability, workload type)
**Outputs:** `LLMResponse` (parsed JSON, raw response text, latency, token usage)
**Dependencies:** `CapacityManager`, `ModelRegistry`, `ILLMProvider` interfaces
**Failure Modes:**
- Provider exhaustion (all providers 429/503)
- Candidate pool collapse (no models match required capabilities)
- Invalid model capability mapping

**Primary Files:**
- `src/services/ai/llm.orchestrator.ts`
- `src/services/ai/models/model-registry.ts`
- `src/services/ai/capacity.manager.ts`

**Related Components:**
- `GroqProvider`, `OpenRouterProvider`, `CohereProvider`
- `GenerationOrchestrator`

---

#### Generation Orchestrator
**Purpose:**
Manages the entire lifecycle of an assessment generation request, breaking it into executable chunks, handling concurrency, aggregating results, and performing crash recovery.

**Responsibilities:**
- Strategy resolution (e.g., School vs College)
- Chunk planning
- Distributed locking via Redis
- Batch recovery pass (Output Recovery)
- Emitting WebSocket progress events
- Result aggregation and final structuring

**Inputs:** `IAssignment` (user configuration), `IConceptLedger` (curriculum knowledge)
**Outputs:** `GeneratedPaperOutput` (final structured paper), `GenerationMetadata`
**Dependencies:** `LLMOrchestrator`, `ChunkPlanner`, `Aggregator`, `IntegrityValidator`, `Redis`
**Failure Modes:**
- Redis lock acquisition failure (ConcurrentRunError)
- Terminal provider exhaustion across all chunks
- Worker crashes leading to stalled locks

**Primary Files:**
- `src/services/ai/generation/generation.orchestrator.ts`
- `src/services/ai/generation/chunk-planner.ts`
- `src/services/ai/generation/aggregator.ts`

---

#### Prompt Builder
**Purpose:**
Constructs pedagogically rigorous and schema-constrained system and user prompts based on the selected generation strategy.

**Responsibilities:**
- Combining curriculum knowledge (avoidance lists) with task instructions
- Configuring few-shot examples
- Optimizing formatting for specific question types

**Inputs:** `IAssignment`, `ChunkContext`, `IConceptLedger`
**Outputs:** Formatted `systemPrompt` and `userPrompt` string payloads
**Dependencies:** `prompt.strategy.ts` interfaces
**Failure Modes:**
- Token overflow if curriculum avoidance lists grow too large
- Prompt injection from user-supplied topics

**Primary Files:**
- `src/services/ai/prompts/school.prompt.ts`
- `src/services/ai/prompts/prompt.utils.ts`
- `src/services/ai/prompts/prompt.strategy.ts`

---

#### Capacity Manager
**Purpose:**
Acts as the single source of truth for rate limits (RPM/TPM), model cooldowns, provider health, and load balancing across the multi-provider ecosystem.

**Responsibilities:**
- Admission control based on available TPM
- Inflight request tracking (Concurrency control)
- Empirical health scoring (tracking success vs. malformed outputs)
- Provider degradation logic

**Inputs:** Provider ID, Model ID, Estimated Token counts
**Outputs:** `CapacityStatus` (availability, remaining quotas, health score, admission reason)
**Dependencies:** None (In-memory state)
**Failure Modes:**
- Throttling out healthy requests due to token overestimation
- Memory leaks if inflight requests aren't decremented gracefully on crashes

**Primary Files:**
- `src/services/ai/capacity.manager.ts`

---

#### Output Recovery Manager
**Purpose:**
Detects when the LLM generates fewer questions than requested in a chunk and orchestrates targeted recovery passes to fill the shortfall.

**Responsibilities:**
- Counting valid output items vs requested items
- Triggering secondary generation chunks for the exact missing amount
- Merging recovered items back into the primary chunk result

**Inputs:** Original `ChunkDefinition`, `ChunkResult`
**Outputs:** Augmented `ChunkResult`
**Dependencies:** `LLMOrchestrator`, `ChunkPlanner`
**Failure Modes:**
- Infinite loops if recovery continuously yields 0 items
- Token starvation

**Primary Files:**
- Embedded within `src/services/ai/generation/generation.orchestrator.ts` (Batch Recovery Pass logic)

---

#### Validation Layer
**Purpose:**
Ensures the raw JSON outputs from the LLMs strictly conform to the expected schema before they are saved to the database.

**Responsibilities:**
- Zod schema parsing and type coercion
- Stripping hallucinated markdown wrappers (`````json ... `````)
- Ensuring structural integrity of the final aggregated paper

**Inputs:** Raw LLM string output or unknown JSON
**Outputs:** Strictly typed `GeneratedPaperOutput` or `ChunkResult`
**Dependencies:** `zod`, `LLMOrchestrator`
**Failure Modes:**
- Schema drift causing false positive rejections
- Malformed nested arrays bypassing shallow checks

**Primary Files:**
- `src/utils/validation.ts`
- `src/services/ai/generation/integrity-validator.ts`

---

#### Model Registry
**Purpose:**
Maintains a static registry of all available AI models, their cognitive tiers, capabilities, token limits, and associated providers.

**Responsibilities:**
- Exposing available models to the orchestrator
- Defining model capability mappings (e.g., `supportsMCQ`)

**Inputs:** None (static configuration)
**Outputs:** Array of `ModelEntry` objects
**Dependencies:** None
**Failure Modes:**
- Outdated physical token limits
- Misconfigured model IDs causing 404s at the provider level

**Primary Files:**
- `src/services/ai/models/model-registry.ts`

---

#### Provider Implementations
**Purpose:**
Adapts the standard `ILLMProvider` interface to specific third-party API SDKs (Groq, Cohere, OpenRouter).

**Responsibilities:**
- API authentication and HTTP request formatting
- Response parsing and latency tracking
- Mapping standardized provider errors (e.g., HTTP 429) to internal error types (`QuotaCooldownError`)

**Inputs:** `LLMRequest`
**Outputs:** `LLMResponse`
**Dependencies:** External SDKs (`@cohere/cohere-api`, `groq-sdk`, `openai`)
**Failure Modes:**
- External API outages
- SDK breaking changes
- Unhandled network socket timeouts

**Primary Files:**
- `src/services/ai/providers/groq.provider.ts`
- `src/services/ai/providers/cohere.provider.ts`
- `src/services/ai/providers/openrouter.provider.ts`

---

#### Benchmark Framework
**Purpose:**
Provides a standalone execution environment to stress-test the orchestration layer, evaluate provider success rates, and validate schema adherence without requiring the full backend stack.

**Responsibilities:**
- Simulating varied workloads (e.g., 10-40 MCQs)
- Capturing telemetry and Empirical scoring
- Evaluating fallback behaviors under simulated or real load

**Inputs:** Mock `LLMRequest` configurations
**Outputs:** Terminal telemetry (`[ROUTING_DECISION]`, success/fail rates)
**Dependencies:** `LLMOrchestrator`, `CapacityManager`
**Failure Modes:**
- EPERM errors when run in restricted environments lacking proper Node.js filesystem or socket permissions

**Primary Files:**
- `src/scripts/benchmark.ts`
- `src/tests/llm.orchestrator.test.ts`

---

#### Redis Locking Layer
**Purpose:**
Prevents race conditions and ensures only one background worker processes a specific generation assignment at any given time.

**Responsibilities:**
- Acquiring `NX` locks
- Extending TTLs via Lua scripts
- Clearing locks on generation completion or assignment hard deletion

**Inputs:** `assignmentId`
**Outputs:** Lock acquisition success boolean
**Dependencies:** `redis`
**Failure Modes:**
- Zombie locks if a worker process crashes completely without releasing, requiring manual TTL expiration

**Primary Files:**
- `src/services/ai/generation/generation-run.ts`
- `src/controllers/assignmentController.ts`

---

#### Database Layer
**Purpose:**
Persists assignment configurations, lifecycle statuses, and the final generated assessment outputs.

**Responsibilities:**
- Mongoose schema enforcement
- Controller-based CRUD operations

**Inputs:** HTTP controller payloads, Worker final outputs
**Outputs:** MongoDB documents
**Dependencies:** `mongoose`, `MongoDB Replica Set`
**Failure Modes:**
- Read-after-write consistency delays on Replica Sets affecting frontend polling (mitigated by exponential backoff in the client)

**Primary Files:**
- `src/controllers/assignmentController.ts`
- `src/routes/assignmentRoutes.ts`

---

### 11.2 Code Navigation Guide

Use this index as a direct map of where core functionality lives.

| Capability | File / Location |
| :--- | :--- |
| **Model Routing & Scoring** | `src/services/ai/llm.orchestrator.ts` |
| **Capacity & Admission Tracking** | `src/services/ai/capacity.manager.ts` |
| **Model Registry** | `src/services/ai/models/model-registry.ts` |
| **Chunk Generation Lifecycle** | `src/services/ai/generation/generation.orchestrator.ts` |
| **Chunk Planning** | `src/services/ai/generation/chunk-planner.ts` |
| **Output Recovery** | `src/services/ai/generation/generation.orchestrator.ts` (Batch Recovery Pass) |
| **Prompt Engineering** | `src/services/ai/prompts/school.prompt.ts` |
| **Zod Validation Schemas** | `src/utils/validation.ts` |
| **Benchmarks & Testing** | `src/scripts/benchmark.ts` & `src/tests/llm.orchestrator.test.ts` |
| **AI Service Entry Point** | `src/services/ai/ai.service.ts` |
| **Distributed Locking (Redis)** | `src/services/ai/generation/generation-run.ts` |
| **Job Queue Worker (BullMQ)** | `src/jobs/worker.ts` |
| **API Controllers (Assignments)** | `src/controllers/assignmentController.ts` |

---

### 11.3 Deep Architecture References

#### Generation & Orchestration Core
**Relevant Source Files:**
- `src/services/ai/ai.service.ts`
- `src/services/ai/generation/generation.orchestrator.ts`
- `src/services/ai/llm.orchestrator.ts`
- `src/services/ai/capacity.manager.ts`

**Entry Points:**
- Primary execution path: `src/jobs/worker.ts` -> `AIService.generateAssessment()`
- Request entry points: `src/controllers/assignmentController.ts` (POST `/api/assignments`)
- Generation entry points: `GenerationOrchestrator.generate()`
- Provider entry points: `LLMOrchestrator.generateJSON()` -> `[Provider].generate()`

**Dependency Graph:**
```mermaid
graph TD
    API[Express API] --> Worker[BullMQ Worker]
    Worker --> AIService[AI Service]
    AIService --> GenerationOrchestrator[Generation Orchestrator]
    GenerationOrchestrator --> LLMOrchestrator[LLM Orchestrator]
    GenerationOrchestrator --> ChunkPlanner[Chunk Planner]
    GenerationOrchestrator --> Aggregator[Aggregator]
    LLMOrchestrator --> CapacityManager[Capacity Manager]
    LLMOrchestrator --> ModelRegistry[Model Registry]
    LLMOrchestrator --> GroqProvider[Groq Provider]
    LLMOrchestrator --> OpenRouterProvider[OpenRouter Provider]
    LLMOrchestrator --> CohereProvider[Cohere Provider]
```

**Traceability Answers:**
- *Where does this live?* Orchestration is rooted in `src/services/ai/`.
- *What implements it?* `LLMOrchestrator` handles routing; `GenerationOrchestrator` handles chunking.
- *What depends on it?* The BullMQ background worker `src/jobs/worker.ts`.
- *What depends on those dependencies?* The Express API `src/controllers/assignmentController.ts` enqueues jobs to the worker.

---

### 11.4 New Engineer Onboarding Section: 30-Minute Codebase Tour

Welcome to the AI Assessment Creator! To understand how the system orchestrates LLMs reliably, follow this exact reading sequence:

1. **Start Here: The API Entry Point**
   - Read `src/controllers/assignmentController.ts` (Specifically `createAssignment`).
   - Understand how the HTTP request creates a MongoDB document and enqueues a job, then immediately returns 202 Accepted.

2. **Read These Files First: The Worker**
   - Read `src/jobs/worker.ts`.
   - See how BullMQ dequeues the job and calls `aiService.generateAssessment()`.

3. **Understand Generation & Chunking**
   - Read `src/services/ai/generation/generation.orchestrator.ts`.
   - This is the brain of the operation. Trace the `generate()` method to see how it plans chunks, iterates over them, and calls `generateOneChunk()`.
   - Notice the Batch Recovery Pass at the end.

4. **Understand Model Routing (The "Smart" Layer)**
   - Read `src/services/ai/llm.orchestrator.ts`.
   - Focus on `getEligibleModels()`. Observe how it uses Empirical Scoring (Base Quality * Empirical Multiplier * Load Penalty * Cost) instead of hardcoded fallbacks.

5. **Understand Capacity & Health**
   - Read `src/services/ai/capacity.manager.ts`.
   - Understand how inflight requests are tracked and how malformed JSON responses mathematically degrade a model's health score.

6. **Understand Providers**
   - Skim `src/services/ai/providers/groq.provider.ts`.
   - See how it implements `ILLMProvider` and maps external 429 errors to internal `QuotaCooldownError`.

7. **Understand Benchmarking (Testing)**
   - Run or read `src/tests/llm.orchestrator.test.ts` to see how routing scenarios (e.g., Tier-1 cooldown -> Tier-3 fallback) are verified without making real API calls.

---

### 11.5 Repository Intelligence Layer

#### Critical Paths
The most important execution flow is the **Chunk Generation Pipeline**:
`GenerationOrchestrator.generateOneChunk()` -> `LLMOrchestrator.generateJSON()` -> `CapacityManager.startRequest()` -> `Provider.generate()` -> `Zod Validation`. If this chain breaks, generation halts.

#### High-Risk Components
- **`src/services/ai/capacity.manager.ts`**: The mathematical core of load balancing. A logic error here (e.g., failing to decrement inflight requests) will cause all providers to appear fully loaded, completely bricking the platform with `NoEligibleModelsError`.
- **`src/services/ai/generation/generation-run.ts`**: Modifying Redis Lua scripts incorrectly can cause distributed lock deadlocks, leaving assessments in a permanent "Generating" state.

#### Extension Points
- **Adding a New AI Provider:** Create a new class implementing `ILLMProvider` in `src/services/ai/providers/`, add it to `ModelRegistry`, and inject it into `LLMOrchestrator` in `src/services/ai/ai.service.ts`.
- **Adding a New Question Type:** Update `ModelCapability` mappings, add the Zod schema to `src/utils/validation.ts`, and update the `ChunkPlanner`.

#### Performance Hotspots
- **JSON Parsing & Validation:** Zod parsing of massive 5,000+ token payloads can block the Node.js event loop.
- **Provider TPM Headroom:** If multiple assignments are requested simultaneously, the `CapacityManager` dynamically routes based on tokens-per-minute (TPM) capacity. This is the primary latency hotspot when traffic scales.

#### Technical Debt Findings
- **In-Memory State:** `CapacityManager` currently relies on local Node.js memory. To scale to a multi-container Kubernetes deployment, this must be refactored to use Redis for distributed TPM tracking and Empirical Health Scoring.
- **Polling Fallback:** The frontend implements exponential backoff polling for MongoDB Read-After-Write replication lag. This is robust but masks the root cause of database replication delays.
