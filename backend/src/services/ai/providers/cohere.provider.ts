import { CohereClient } from 'cohere-ai';
import { ILLMProvider, LLMRequest, LLMResponse, ModelCapability, ProviderConfig } from '../types.js';
import { getModelsForProvider } from '../models/model-registry.js';

export class CohereProvider implements ILLMProvider {
  public name = 'Cohere';
  private client: CohereClient | null = null;
  private config: ProviderConfig;

  private readonly DEFAULT_MODEL = 'command-r-08-2024';

  constructor(config: ProviderConfig) {
    this.config = config;
    if (this.config.apiKey) {
      this.client = new CohereClient({
        token: this.config.apiKey,
        clientName: 'ai-assessment-creator',
      });
    }
  }

  public isAvailable(): boolean {
    return !!this.client && !!this.config.apiKey;
  }

  public supports(capabilities: ModelCapability[]): boolean {
    // Cohere command-r supports tool calling and robust text generation.
    // They have strict JSON modes coming/in-beta, but text response works well.
    return true; 
  }

  public getAvailableModels(): string[] {
    return getModelsForProvider('cohere').map((m) => m.id);
  }

  public async generate(request: LLMRequest, modelOverride?: string): Promise<LLMResponse> {
    if (!this.client) {
      throw new Error('Cohere client not initialized (missing API key)');
    }

    const startTime = Date.now();
    const modelToUse = modelOverride || this.DEFAULT_MODEL;

    try {
      const response = await this.client.chat({
        model: modelToUse,
        preamble: request.systemPrompt,
        message: request.userPrompt,
        temperature: request.temperature ?? 0.7,
        maxTokens: Math.min(request.maxOutputTokens || 4096, 4096),
      }, { abortSignal: request.abortSignal });

      const latencyMs = Date.now() - startTime;
      const content = response.text || '';
      const meta = response.meta;
      
      const usage = meta?.billedUnits;

      return {
        content,
        providerName: this.name,
        modelUsed: modelToUse,
        latencyMs,
        usage: usage ? {
          promptTokens: usage.inputTokens || 0,
          completionTokens: usage.outputTokens || 0,
          totalTokens: (usage.inputTokens || 0) + (usage.outputTokens || 0),
        } : undefined
      };

    } catch (error) {
      console.error(`[CohereProvider] Error during generation:`, error);
      throw error;
    }
  }
}
