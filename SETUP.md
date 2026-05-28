# Local Environment Setup & Orchestration

This document outlines the local environment bootstrapping process for the AI Assessment Creator platform. The stack utilizes a decoupled client-server architecture with an asynchronous BullMQ worker queue running on Redis, persistent state in MongoDB, and real-time state synchronization via Socket.io.

## Prerequisites

Ensure the following runtimes and services are available on your host machine:
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **Docker**: Engine `v24+` & Compose `v2+`
- **Git**

## 1. Infrastructure Bootstrapping

The local development environment relies on Docker to orchestrate the datastores (MongoDB and Redis). 

```bash
# From the repository root
docker-compose up -d
```

### Verification
Verify that both containers are running and port-forwarded correctly:
- **Redis**: `docker exec -it ai-assessment-creator-redis-1 redis-cli ping` (Expected output: `PONG`)
- **MongoDB**: `docker exec -it ai-assessment-creator-mongodb-1 mongosh --eval "db.adminCommand('ping')"` (Expected output: `{ ok: 1 }`)

Expected Local Ports:
- Redis: `6379`
- MongoDB: `27017`

## 2. Backend Orchestration

The backend encompasses the Express API, the Socket.io server, and the BullMQ worker process. In the local environment, these run within the same Node.js process via `tsx`.

### Dependency Installation
```bash
cd backend
npm install
```

### Environment Configuration
Create a `.env` file in the `/backend` directory.

```ini
# Server Configuration
PORT=5001
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# Datastores
MONGODB_URI=mongodb://localhost:27017/ai-assessment
REDIS_URL=redis://localhost:6379

# AI Provider API Keys
# The system utilizes an LLMOrchestrator with tier-based fallback.
# For local testing, ensure you have active keys for free-tier providers.
COHERE_API_KEY=your_cohere_key         # Tier 1 fallback
GROQ_API_KEY=your_groq_key             # Tier 3 (High-speed MCQs)
OPENROUTER_API_KEY=your_openrouter_key # Tier 1/2 routing
```

### Process Initialization
Start the backend process. This single command initializes the HTTP server, establishes the MongoDB connection, connects the BullMQ worker to Redis, and mounts the WebSocket server.
```bash
npm run dev
```

### Health Checks
- API Health: `curl -I http://localhost:5001/api/health`
- WebSocket: Verify `WebSocket server initialized` appears in terminal stdout.
- Worker: Verify `Assessment generation worker started` appears in terminal stdout.

## 3. Frontend Orchestration

The Next.js frontend acts as the client consuming the REST API and maintaining persistent WebSocket connections for job state hydration.

### Dependency Installation
```bash
cd frontend
npm install
```

### Environment Configuration
Create a `.env.local` file in the `/frontend` directory.

```ini
# Next.js Public Variables
NEXT_PUBLIC_API_URL=http://localhost:5001/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5001
```

### Process Initialization
```bash
npm run dev
```
The application will be accessible at `http://localhost:3000`.

## 4. End-to-End System Flow & Verification

To verify the async pipeline is operating correctly:
1. Navigate to `http://localhost:3000/create` and submit an assessment generation request.
2. Observe the **Backend Terminal**:
   - `POST /api/generate` route hit.
   - Job enqueued to BullMQ (Queue: `generation`).
   - Worker dequeues job and attempts Redis `set NX` lock.
   - WebSocket emits `generation:progress` events.
3. Observe the **Frontend Browser Console**:
   - `useWebSocket` hook establishes connection to room `assignmentId`.
   - UI reacts to `generation:progress` and `generation:complete` payloads.

## 5. Operational Guidelines & Debugging

### BullMQ Queue Debugging
If jobs are hanging or failing silently, inspect the Redis keyspace directly.
```bash
# Connect to Redis
docker exec -it ai-assessment-creator-redis-1 redis-cli

# List all BullMQ keys for the generation queue
KEYS bull:generation:*

# Check active, waiting, or failed jobs
ZRANGE bull:generation:active 0 -1
ZRANGE bull:generation:waiting 0 -1
ZRANGE bull:generation:failed 0 -1
```

### Common Failure Modes

#### 1. Redis Lock Contention (`ConcurrentRunError`)
**Symptom**: Backend logs indicate "Failed to acquire lock" despite no active generation.
**Cause**: A previous worker crashed mid-generation without releasing the Redis lock (`gen-lock:<id>`).
**Resolution**: Manually flush the Redis lock.
```bash
docker exec -it ai-assessment-creator-redis-1 redis-cli DEL gen-lock:<assignmentId>
```

#### 2. LLM Provider Rate Limiting (HTTP 429)
**Symptom**: Backend logs indicate "All eligible models failed."
**Cause**: The free-tier API limits on Groq or Cohere have been exhausted.
**Resolution**: The `LLMOrchestrator` will automatically attempt tier-based fallback. If all tiers fail, the job moves to the BullMQ failed queue. Inspect the backend terminal for the specific provider rejection payloads. Ensure API keys are valid and quotas are not exceeded.

#### 3. WebSocket Disconnection (Transport Polling)
**Symptom**: Frontend hangs indefinitely on the loading screen, but backend logs show generation is progressing.
**Cause**: The Next.js client failed to upgrade from HTTP Long-Polling to WebSockets.
**Resolution**: Verify `NEXT_PUBLIC_SOCKET_URL` strictly matches the backend origin (`http://localhost:5001`) and ensure no local proxy (like ngrok) is stripping upgrade headers.

## Production Build Verification

To verify the application compiles successfully before CI/CD deployment:
```bash
# Backend
cd backend && npx tsc --noEmit

# Frontend
cd frontend && npm run build
```
