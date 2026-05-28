import { ILLMProvider, LLMRequest, LLMResponse, ModelCapability } from './types.js';
import { getModels, getModelById, ModelTier, type ModelEntry } from './models/model-registry.js';
import { ProviderHealthTracker, type HealthEvent } from './models/provider-health.js';
import { CapabilityExhaustedError } from './errors.js';
import { logger } from '../../utils/logger.js';

/**
 * Capability-aware LLM orchestrator.
 * 
 * Replaces the old blind fallback chain with:
 * 1. Filter models by tier + health + quota
 * 2. Sort: preferred → tier → health
 * 3. Try each eligible model
 * 4. Hard reject if all eligible models fail (never degrade below minimum tier)
 */
export class LLMOrchestrator {
  private providers: Map<string, ILLMProvider> = new Map();
  public readonly healthTracker: ProviderHealthTracker;

  constructor(providers: ILLMProvider[]) {
    for (const p of providers) {
      this.providers.set(p.name.toLowerCase(), p);
    }
    this.healthTracker = new ProviderHealthTracker();
  }

  /**
   * Generates a response using capability-aware routing.
   * Respects minimumTier, preferredModelId, and health state.
   */
  public async generate(request: LLMRequest): Promise<LLMResponse> {
    const eligible = this.getEligibleModels(request);

    if (eligible.length === 0) {
      throw new CapabilityExhaustedError(
        request.minimumTier ?? ModelTier.TIER_3,
        [],
        [{ model: "none", error: "No eligible models found (all disabled, circuit-open, or quota-exhausted)" }]
      );
    }

    const errors: { model: string; error: string }[] = [];

    for (const model of eligible) {
      const provider = this.getProviderForModel(model);
      if (!provider) continue;

      try {
        logger.info("[LLMOrchestrator] Routing to model", {
          model: model.id,
          provider: model.provider,
          tier: model.tier,
        });

        const response = await provider.generate(request, model.id);

        // Record success
        this.healthTracker.record(model.id, {
          timestamp: Date.now(),
          type: "success",
          latencyMs: response.latencyMs || 0,
        });

        return response;
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        logger.error("[LLMOrchestrator] Model failed", {
          model: model.id,
          provider: model.provider,
          error: errorMsg,
        });

        // Record failure
        const eventType = this.classifyError(error);
        this.healthTracker.record(model.id, {
          timestamp: Date.now(),
          type: eventType,
          latencyMs: 0,
        });

        errors.push({ model: model.id, error: errorMsg });
      }
    }

    // All eligible models failed — HARD REJECT
    throw new CapabilityExhaustedError(
      request.minimumTier ?? ModelTier.TIER_3,
      eligible.map((m) => m.id),
      errors
    );
  }

  /**
   * A helper to specifically request and parse JSON from the LLM.
   */
  public async generateJSON<T>(request: LLMRequest): Promise<{ data: T, raw: LLMResponse }> {
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
      // Record malformed output
      this.healthTracker.record(response.modelUsed, {
        timestamp: Date.now(),
        type: "malformed",
        latencyMs: response.latencyMs || 0,
      });
      
      logger.error("[LLMOrchestrator] Failed to parse JSON", {
        provider: response.providerName,
        model: response.modelUsed,
        contentLength: response.content?.length,
      });
      throw new Error(`Failed to parse structured JSON from AI response: ${(error as Error).message}`);
    }
  }

  // ── Private helpers ──

  /**
   * Get eligible models sorted by preference:
   * 1. Preferred model (if specified, eligible, and healthy)
   * 2. By tier ascending (best first)
   * 3. By health (healthiest first within same tier)
   */
  private getEligibleModels(request: LLMRequest): ModelEntry[] {
    const minimumTier = request.minimumTier ?? ModelTier.TIER_3;
    
    // Get all enabled models at or above minimum tier
    const candidates = getModels({
      minimumTier,
      enabledOnly: true,
    });

    // Filter by provider availability and health
    const eligible = candidates.filter((model) => {
      const provider = this.getProviderForModel(model);
      if (!provider || !provider.isAvailable()) return false;
      if (!this.healthTracker.isModelAvailable(model.id)) return false;
      return true;
    });

    // Sort: preferred first → tier ascending → health
    const preferredId = request.preferredModelId;
    eligible.sort((a, b) => {
      // Preferred model always first
      if (preferredId) {
        if (a.id === preferredId && b.id !== preferredId) return -1;
        if (b.id === preferredId && a.id !== preferredId) return 1;
      }
      // Then by tier (lower = better)
      if (a.tier !== b.tier) return a.tier - b.tier;

      // Then by Provider Class (stable > opportunistic > experimental)
      const classWeight = { "stable": 1, "opportunistic": 2, "experimental": 3 };
      const aWeight = classWeight[a.providerClass] || 4;
      const bWeight = classWeight[b.providerClass] || 4;
      if (aWeight !== bWeight) return aWeight - bWeight;

      // Within same tier and class, prefer healthier models
      const aMetrics = this.healthTracker.getMetrics(a.id);
      const bMetrics = this.healthTracker.getMetrics(b.id);
      return aMetrics.failureRate - bMetrics.failureRate;
    });

    return eligible;
  }

  /**
   * Map a model entry to its provider instance.
   */
  private getProviderForModel(model: ModelEntry): ILLMProvider | undefined {
    // Provider names in the Map are lowercase: "groq", "openrouter", "cohere"
    return this.providers.get(model.provider);
  }

  /**
   * Classify an error for health tracking.
   */
  private classifyError(error: any): HealthEvent["type"] {
    const message = (error?.message || "").toLowerCase();
    if (message.includes("timeout") || message.includes("timed out")) return "timeout";
    if (message.includes("rate limit") || message.includes("429")) return "failure";
    return "failure";
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
