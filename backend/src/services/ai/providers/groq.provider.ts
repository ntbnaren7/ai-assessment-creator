import { Groq } from 'groq-sdk';
import { ILLMProvider, LLMRequest, LLMResponse, ModelCapability, ProviderConfig } from '../types.js';
import { QuotaCooldownError } from '../errors.js';
import { getModelsForProvider } from '../models/model-registry.js';

export class GroqProvider implements ILLMProvider {
  public name = 'Groq';
  private client: Groq | null = null;
  private config: ProviderConfig;

  // Fallback only — orchestrator should always specify modelOverride
  private readonly FALLBACK_MODEL = 'llama-3.3-70b-versatile'; 
  
  constructor(config: ProviderConfig) {
    this.config = config;
    if (this.config.apiKey) {
      this.client = new Groq({ 
        apiKey: this.config.apiKey,
        maxRetries: 0
      });
    }
  }

  public isAvailable(): boolean {
    return !!this.client && !!this.config.apiKey;
  }

  public supports(capabilities: ModelCapability[]): boolean {
    // Groq currently supports JSON_MODE (on specific models)
    // and TOOL_CALLING, but we'll check against our requested capabilities.
    return true; 
  }

  public getAvailableModels(): string[] {
    return getModelsForProvider('groq').map((m) => m.id);
  }

  public async generate(request: LLMRequest, modelOverride?: string): Promise<LLMResponse> {
    if (!this.client) {
      throw new Error('Groq client not initialized (missing API key)');
    }

    const model = modelOverride || this.FALLBACK_MODEL;
    const startTime = Date.now();
    
    // Construct messages
    const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: request.systemPrompt },
      { role: 'user', content: request.userPrompt },
    ];

    const responseFormat = request.capabilitiesRequired?.includes(ModelCapability.JSON_MODE) 
      ? { type: 'json_object' as const } 
      : undefined;

    try {
      const chatCompletion = await this.client.chat.completions.create({
        messages,
        model,
        temperature: request.temperature ?? 0.7,
        response_format: responseFormat,
        ...(request.maxOutputTokens ? { max_tokens: request.maxOutputTokens } : {}),
      }, { signal: request.abortSignal });

      const latencyMs = Date.now() - startTime;
      const content = chatCompletion.choices?.[0]?.message?.content || '';
      const usage = chatCompletion.usage;

      return {
        content,
        providerName: this.name,
        modelUsed: chatCompletion.model,
        latencyMs,
        usage: usage ? {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        } : undefined
      };

    } catch (error: any) {
      if (error?.status === 429) {
        // Groq uses a custom headers object in its error wrapper
        const headers = error?.headers;
        const retryAfterStr = headers?.get ? headers.get('retry-after') : (headers?.['retry-after']);
        
        let retryAfterMs = 60000; // Default 60s
        if (retryAfterStr) {
          const parsed = parseFloat(retryAfterStr);
          if (!isNaN(parsed)) {
            // retry-after can be seconds or absolute epoch
            retryAfterMs = parsed < 1e9 ? parsed * 1000 : Math.max(0, parsed - Date.now());
          }
        }
        
        console.error(`[GroqProvider] Rate limit hit for model ${model}. Cooldown: ${retryAfterMs}ms`);
        throw new QuotaCooldownError(this.name, model, retryAfterMs);
      }

      console.error(`[GroqProvider] Error during generation (model: ${model}):`, error);
      throw error;
    }
  }
}
