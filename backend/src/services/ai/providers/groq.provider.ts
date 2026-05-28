import { Groq } from 'groq-sdk';
import { ILLMProvider, LLMRequest, LLMResponse, ModelCapability, ProviderConfig } from '../types.js';

export class GroqProvider implements ILLMProvider {
  public name = 'Groq';
  private client: Groq | null = null;
  private config: ProviderConfig;

  // The default models we will use
  private readonly DEFAULT_MODEL = 'llama-3.3-70b-versatile'; 
  
  constructor(config: ProviderConfig) {
    this.config = config;
    if (this.config.apiKey) {
      this.client = new Groq({ apiKey: this.config.apiKey });
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

  public async generate(request: LLMRequest): Promise<LLMResponse> {
    if (!this.client) {
      throw new Error('Groq client not initialized (missing API key)');
    }

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
        model: this.DEFAULT_MODEL,
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
      console.error(`[GroqProvider] Error during generation:`, error);
      throw error;
    }
  }
}
