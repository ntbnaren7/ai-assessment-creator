import { ILLMProvider, LLMRequest, LLMResponse, ModelCapability } from './types.js';

export class AIExhaustedError extends Error {
  constructor(message: string, public readonly errors: any[]) {
    super(message);
    this.name = 'AIExhaustedError';
  }
}

export class LLMOrchestrator {
  private providers: ILLMProvider[] = [];

  constructor(providers: ILLMProvider[]) {
    this.providers = providers;
  }

  /**
   * Generates a response using the fallback chain.
   */
  public async generate(request: LLMRequest): Promise<LLMResponse> {
    const availableProviders = this.providers.filter(p => {
      // Must be configured
      if (!p.isAvailable()) return false;
      // Must support the requested capabilities
      if (request.capabilitiesRequired && !p.supports(request.capabilitiesRequired)) {
        return false;
      }
      return true;
    });

    if (availableProviders.length === 0) {
      throw new Error('No LLM providers available that satisfy the request requirements.');
    }

    const errors: any[] = [];

    // Chain of Responsibility Fallback
    for (const provider of availableProviders) {
      try {
        console.log(`[LLMOrchestrator] Routing request to: ${provider.name}`);
        const response = await provider.generate(request);
        return response;
      } catch (error: any) {
        console.error(`[LLMOrchestrator] Provider ${provider.name} failed:`, error?.message || error);
        errors.push({ provider: provider.name, error });
        // Optionally, check if the error is non-retryable (e.g. 400 Bad Request) 
        // and throw immediately, but for now we fallback on everything.
      }
    }

    // If we reach here, all providers failed
    throw new AIExhaustedError('All available LLM providers failed to generate a response.', errors);
  }

  /**
   * A helper to specifically request and parse JSON from the LLM.
   */
  public async generateJSON<T>(request: LLMRequest): Promise<{ data: T, raw: LLMResponse }> {
    // Inject strict JSON instructions
    const jsonPrompt = request.expectedSchema 
      ? `\n\nIMPORTANT: You must respond ONLY with raw JSON that exactly matches the following schema. Do not include markdown blocks, backticks, or conversational text.\nSchema:\n${JSON.stringify(request.expectedSchema)}`
      : `\n\nIMPORTANT: You must respond ONLY with raw JSON. Do not include markdown blocks, backticks, or conversational text.`;

    const modifiedRequest: LLMRequest = {
      ...request,
      systemPrompt: request.systemPrompt + jsonPrompt,
      capabilitiesRequired: [
        ...(request.capabilitiesRequired || []), 
        ModelCapability.JSON_MODE
      ],
    };

    const response = await this.generate(modifiedRequest);

    try {
      const parsed = this.parseJSON<T>(response.content);
      return { data: parsed, raw: response };
    } catch (error) {
      console.error(`[LLMOrchestrator] Failed to parse JSON from ${response.providerName}. Content:`, response.content);
      throw new Error(`Failed to parse structured JSON from AI response: ${(error as Error).message}`);
    }
  }

  /**
   * Strips markdown fences if the LLM hallucinated them despite instructions.
   */
  private parseJSON<T>(text: string): T {
    let cleanText = text.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.substring(7);
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.substring(3);
    }
    if (cleanText.endsWith('```')) {
      cleanText = cleanText.substring(0, cleanText.length - 3);
    }
    
    return JSON.parse(cleanText.trim()) as T;
  }
}
