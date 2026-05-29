import OpenAI from 'openai';
import { ILLMProvider, LLMRequest, LLMResponse, ModelCapability, ProviderConfig } from '../types.js';
import { getModelsForProvider } from '../models/model-registry.js';

export class OpenRouterProvider implements ILLMProvider {
  public name = 'OpenRouter';
  private client: OpenAI | null = null;
  private config: ProviderConfig;

  // Fallback only — orchestrator should always specify modelOverride
  private readonly FALLBACK_MODEL = 'meta-llama/llama-3.1-8b-instruct:free';

  constructor(config: ProviderConfig) {
    this.config = config;
    if (this.config.apiKey) {
      this.client = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: this.config.apiKey,
        maxRetries: 0,
        defaultHeaders: {
          'HTTP-Referer': 'https://aiassessmentcreator.local', 
          'X-Title': 'AI Assessment Creator', 
        },
      });
    }
  }

  public isAvailable(): boolean {
    return !!this.client && !!this.config.apiKey;
  }

  public supports(capabilities: ModelCapability[]): boolean {
    // OpenRouter supports everything depending on the underlying model
    return true; 
  }

  public getAvailableModels(): string[] {
    return getModelsForProvider('openrouter').map((m) => m.id);
  }

  public async generate(request: LLMRequest, modelOverride?: string): Promise<LLMResponse> {
    if (!this.client) {
      throw new Error('OpenRouter client not initialized (missing API key)');
    }

    const model = modelOverride || this.FALLBACK_MODEL;
    const startTime = Date.now();

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: request.systemPrompt },
      { role: 'user', content: request.userPrompt },
    ];

    const responseFormat = request.capabilitiesRequired?.includes(ModelCapability.JSON_MODE) 
      ? { type: 'json_object' as const } 
      : undefined;

    try {
      const chatCompletion = await this.client.chat.completions.create({
        model,
        messages,
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

    } catch (error) {
      console.error(`[OpenRouterProvider] Error during generation (model: ${model}):`, error);
      throw error;
    }
  }
}
