import OpenAI from 'openai';
import { ILLMProvider, LLMRequest, LLMResponse, ModelCapability, ProviderConfig } from '../types.js';

export class OpenRouterProvider implements ILLMProvider {
  public name = 'OpenRouter';
  private client: OpenAI | null = null;
  private config: ProviderConfig;

  // We can target specific free models or let it fallback
  private readonly DEFAULT_MODEL = 'meta-llama/llama-3.1-8b-instruct:free';

  constructor(config: ProviderConfig) {
    this.config = config;
    if (this.config.apiKey) {
      this.client = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: this.config.apiKey,
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

  public async generate(request: LLMRequest): Promise<LLMResponse> {
    if (!this.client) {
      throw new Error('OpenRouter client not initialized (missing API key)');
    }

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
        model: this.DEFAULT_MODEL,
        messages,
        temperature: request.temperature ?? 0.7,
        response_format: responseFormat,
      });

      const latencyMs = Date.now() - startTime;
      const content = chatCompletion.choices[0]?.message?.content || '';
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
      console.error(`[OpenRouterProvider] Error during generation:`, error);
      throw error;
    }
  }
}
