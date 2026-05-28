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
  generate(request: LLMRequest): Promise<LLMResponse>;
}
