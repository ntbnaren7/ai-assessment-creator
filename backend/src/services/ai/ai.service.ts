import { config } from "../../config/index.js";
import type { IAssignment } from "../../models/index.js";
import { LLMOrchestrator } from "./llm.orchestrator.js";
import { GroqProvider } from "./providers/groq.provider.js";
import { OpenRouterProvider } from "./providers/openrouter.provider.js";
import { CohereProvider } from "./providers/cohere.provider.js";
import { GenerationOrchestrator, type ProgressCallback } from "./generation/generation.orchestrator.js";

// Initialize providers with their respective API keys
const providers = [];

if (config.groqApiKey) {
  providers.push(new GroqProvider({ apiKey: config.groqApiKey }));
}
if (config.openRouterApiKey) {
  providers.push(new OpenRouterProvider({ apiKey: config.openRouterApiKey }));
}
if (config.cohereApiKey) {
  providers.push(new CohereProvider({ apiKey: config.cohereApiKey }));
}

// Instantiate the Capability-Aware LLM Orchestrator
const llmOrchestrator = new LLMOrchestrator(providers);

// Instantiate the unified Generation Pipeline Orchestrator
const generationOrchestrator = new GenerationOrchestrator(llmOrchestrator);

/**
 * Main entry point for generating a question paper.
 * Delegates to the GenerationOrchestrator which handles locking, chunking,
 * LLM fallback/routing, aggregation, and quality evaluation.
 */
export async function generateQuestionPaper(
  assignment: IAssignment,
  runId: string,
  progressCallback?: ProgressCallback,
  abortSignal?: AbortSignal
) {
  return await generationOrchestrator.generate(
    assignment,
    runId,
    progressCallback,
    abortSignal
  );
}
