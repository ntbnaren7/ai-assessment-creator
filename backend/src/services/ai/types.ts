import { ModelTier } from './models/model-registry.js';

export enum ModelCapability {
  JSON_MODE = 'JSON_MODE',
  VISION = 'VISION',
  TOOL_CALLING = 'TOOL_CALLING',
}

export interface ProviderConfig {
  apiKey: string;
  maxRetries?: number;
  timeoutMs?: number;
}

export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  expectedSchema?: any; // JSON Schema for structured output
  capabilitiesRequired?: ModelCapability[];
  temperature?: number;
  // ── Capability-aware routing (v4) ──
  preferredTier?: ModelTier;      // Ideal tier for the request
  fallbackTier?: ModelTier;       // Lowest acceptable emergency fallback tier
  requiredQuestionCapability?: string; // e.g., 'Multiple Choice Questions'
  requiredWorkload?: 'question-generation' | 'answer-generation';
  allowCapabilityDegradation?: boolean;
  preferredModelId?: string;      // Try this model first if eligible
  maxOutputTokens?: number;       // Safety cap per request
  estimatedCompletionTokens?: number; // Realistic completion estimate for admission control
  abortSignal?: AbortSignal;      // Pass-through for graceful cancellation
  requestId?: string;             // For telemetry tracing
  chunkId?: string;               // For telemetry tracing
}

export interface LLMResponse {
  content: string; // The raw JSON string or text
  providerName: string;
  modelUsed: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs?: number;
}

export interface ILLMProvider {
  name: string;
  isAvailable(): boolean; // Checks if API key exists and health check passes
  supports(capabilities: ModelCapability[]): boolean;
  generate(request: LLMRequest, modelOverride?: string): Promise<LLMResponse>;
  /** Returns the model IDs this provider can serve */
  getAvailableModels(): string[];
}
