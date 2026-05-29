import { ILLMProvider, LLMRequest, LLMResponse, ModelCapability } from './types.js';
import { getModels, getModelById, ModelTier, type ModelEntry } from './models/model-registry.js';
import { CapabilityExhaustedError, QuotaCooldownError, NoEligibleModelsError } from './errors.js';
import { logger } from '../../utils/logger.js';
import { CapacityManager, type CapacityStatus } from './capacity.manager.js';

/**
 * Capability-aware LLM orchestrator (v5 — Unified Dynamic Scoring).
 * 
 * All candidate models are scored via a unified formula:
 *   Quality (0.45) + Availability (0.25) + ProviderHealth (0.15) + Latency (0.10) + Cost (0.05)
 * 
 * Tiers exist only as metadata contributing to the Quality score.
 * There is NO hard tier-based routing waterfall.
 * 
 * On 429 errors:
 *   1. The provider is marked degraded in CapacityManager
 *   2. The model is marked with a model-level cooldown
 *   3. The orchestrator immediately tries the next scored candidate
 *   4. NO sleeping occurs inside the orchestrator
 */
export class LLMOrchestrator {
  private providers: Map<string, ILLMProvider> = new Map();
  public readonly capacityManager: CapacityManager;

  // For testing
  public _getModels = getModels;

  constructor(providers: ILLMProvider[], capacityManager?: CapacityManager) {
    for (const p of providers) {
      this.providers.set(p.name.toLowerCase(), p);
    }
    this.capacityManager = capacityManager ?? new CapacityManager();
  }

  /**
   * Generates a response using unified dynamic scoring.
   * Respects capability requirements and health/capacity state.
   */
  public async generate(request: LLMRequest): Promise<LLMResponse> {
    const eligible = this.getEligibleModels(request);

    if (eligible.length === 0) {
      throw new CapabilityExhaustedError(
        request.fallbackTier ?? ModelTier.TIER_3,
        [],
        [{ model: "none", error: "No eligible models found (all disabled, circuit-open, or quota-exhausted)" }]
      );
    }

    const errors: { model: string; error: string }[] = [];

    for (const scoredModel of eligible) {
      const model = scoredModel.model;
      const provider = this.getProviderForModel(model);
      if (!provider) continue;

      // Track routing decision
      logger.info("[ROUTING_DECISION] Selected Model for Generation", {
        requestId: request.requestId || "unknown",
        chunkId: request.chunkId || "unknown",
        workloadType: request.requiredQuestionCapability || "unknown",
        selection: {
          model: model.id,
          provider: model.provider,
          totalScore: scoredModel.score,
        },
        scoreBreakdown: scoredModel.scoreBreakdown,
        rejectedTopContender: eligible.length > 1 ? {
          model: eligible[1].model.id,
          provider: eligible[1].model.provider,
          score: eligible[1].score
        } : null
      });

      this.capacityManager.startRequest(model.provider);

      try {
        // Per-attempt timeout isolation
        const timeoutSignal = AbortSignal.timeout(60000); // 60s hard timeout
        const requestWithTimeout = {
          ...request,
          abortSignal: request.abortSignal || timeoutSignal,
        };

        const callStart = performance.now();
        const response = await provider.generate(requestWithTimeout, model.id);
        const callDuration = Math.round(performance.now() - callStart);

        // Record success in CapacityManager
        const tokensUsed = response.usage?.totalTokens || (request.estimatedCompletionTokens ?? 500);
        this.capacityManager.recordSuccess(model.provider, model.id, tokensUsed);

        logger.info("[PROFILER] Provider Attempt Success", {
          stage: "LLM_GENERATION",
          durationMs: callDuration,
          model: model.id,
          provider: model.provider,
        });

        return response;
      } catch (error: any) {
        if (error instanceof QuotaCooldownError) {
          // Mark both model and provider as degraded — then immediately try next candidate
          this.capacityManager.markModelCooldown(model.id, error.retryAfterMs);
          this.capacityManager.markProviderDegraded(model.provider, error.retryAfterMs);
          this.capacityManager.recordFailure(model.provider);

          logger.warn(`[LLMOrchestrator] Model ${model.id} hit rate limit, marking provider ${model.provider} degraded`, {
            retryAfterMs: error.retryAfterMs,
          });
          errors.push({ model: model.id, error: error.message });
          continue; // Immediately try next model — NO sleep
        }

        const errorMsg = error?.message || String(error);
        const statusCode = error?.status || error?.code || error?.statusCode;
        
        logger.error("[PROFILER] Provider Attempt Failed", {
          stage: "LLM_GENERATION",
          model: model.id,
          provider: model.provider,
          error: errorMsg,
          statusCode: statusCode,
        });

        // Record failure
        this.capacityManager.recordFailure(model.provider);

        errors.push({ model: model.id, error: errorMsg });
      } finally {
        this.capacityManager.endRequest(model.provider);
      }
    }

    // All eligible models failed — HARD REJECT
    throw new CapabilityExhaustedError(
      request.fallbackTier ?? ModelTier.TIER_3,
      eligible.map((sc) => sc.model.id),
      errors
    );
  }

  /**
   * A helper to specifically request and parse JSON from the LLM.
   */
  public async generateJSON<T>(request: LLMRequest): Promise<{ data: T, raw: LLMResponse }> {
    const jsonPrompt = request.expectedSchema 
      ? `\n\nOutput JSON matching this schema exactly:\n${JSON.stringify(request.expectedSchema)}`
      : `\n\nRespond with valid JSON only.`;

    const modifiedRequest: LLMRequest = {
      ...request,
      systemPrompt: request.systemPrompt + jsonPrompt,
      capabilitiesRequired: [
        ...(request.capabilitiesRequired || []), 
        ModelCapability.JSON_MODE
      ],
    };

    const generateStart = performance.now();
    const response = await this.generate(modifiedRequest);
    const generateDuration = Math.round(performance.now() - generateStart);

    try {
      const parseStart = performance.now();
      const parsed = this.parseJSON<T>(response.content);
      const parseDuration = Math.round(performance.now() - parseStart);
      
      logger.info("[PROFILER] JSON Parsing Completed", {
        stage: "JSON_PARSING",
        latencyMs: parseDuration,
      });

      return { data: parsed, raw: response };
    } catch (error) {
      // Record malformed output
      this.capacityManager.recordMalformed(response.providerName);
      
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
   * Unified Dynamic Scoring — replaces the old tier-waterfall routing.
   * 
   * Empirical Scoring formula:
   *   Base Quality * Empirical Success Rate * Load Penalty * Cost Multiplier
   */
  public getEligibleModels(request: LLMRequest): { model: ModelEntry; score: number; scoreBreakdown: any }[] {
    const requiredCap = request.requiredQuestionCapability;
    const requiredWorkload = request.requiredWorkload;
    const allowDegradation = request.allowCapabilityDegradation ?? true;
    
    const initialCandidates = this._getModels({ enabledOnly: true });

    type ScoredModel = { model: ModelEntry; score: number; scoreBreakdown?: any; rejectedReason?: string; degraded: boolean };
    const scoredCandidates: ScoredModel[] = [];

    const estimatedCompletion = request.estimatedCompletionTokens || request.maxOutputTokens || 2000;
    const estimatedPromptTokens = 1000; // Rough estimate if not provided

    for (const model of initialCandidates) {
      let rejectedReason: string | undefined;
      let degraded = false;

      // ── Hard Exclusions ──
      const provider = this.getProviderForModel(model);
      if (!provider || !provider.isAvailable()) {
        rejectedReason = "Provider unavailable";
        scoredCandidates.push({ model, score: -1000, rejectedReason, degraded });
        continue;
      }

      // Check Capacity and Admission
      const capacity = this.capacityManager.getCapacityStatus(
        model.provider, 
        model.id, 
        estimatedPromptTokens, 
        estimatedCompletion
      );

      if (capacity.healthScore === 0) {
        rejectedReason = "Model hard disabled (Health score 0)";
        scoredCandidates.push({ model, score: -1000, rejectedReason, degraded });
        continue;
      }

      if (!capacity.canServeRequest) {
        rejectedReason = `Admission Control Failed: ${capacity.admissionReason}`;
        scoredCandidates.push({ model, score: -1000, rejectedReason, degraded });
        continue;
      }

      // ── Capability Check ──
      let capabilityMatch = true;
      if (requiredCap && model.generation) {
        switch (requiredCap) {
          case 'Multiple Choice Questions': capabilityMatch = model.generation.supportsMCQ; break;
          case 'Short Answer Questions': capabilityMatch = model.generation.supportsShortAnswer; break;
          case 'Long Answer Questions':
            if (requiredWorkload === 'question-generation') {
              capabilityMatch = model.generation.supportsLongAnswerQuestionGeneration;
            } else if (requiredWorkload === 'answer-generation') {
              capabilityMatch = model.generation.supportsLongAnswerAnswerGeneration;
            } else {
              capabilityMatch = false;
            }
            break;
          case 'Case Study Questions': capabilityMatch = model.generation.supportsCaseStudy; break;
          case 'Numerical Problems': capabilityMatch = model.generation.supportsNumerical; break;
          default: capabilityMatch = true;
        }
      }

      if (!capabilityMatch && !allowDegradation) {
        rejectedReason = `Capability Mismatch: Missing ${requiredCap} for workload ${requiredWorkload}`;
        scoredCandidates.push({ model, score: -1000, rejectedReason, degraded: true });
        continue;
      }
      if (!capabilityMatch) degraded = true;

      // ── Empirical Scoring ──

      // 1. Base Quality (0-100)
      let baseQuality = 50;
      if (model.tier === ModelTier.TIER_1) baseQuality += 30;
      else if (model.tier === ModelTier.TIER_2) baseQuality += 15;
      
      if (capabilityMatch) baseQuality += 10;
      baseQuality += Math.min(10, model.capabilities.reasoning);
      if (request.preferredModelId === model.id) baseQuality += 10;

      // 2. Empirical Success Rate Multiplier (0.0 - 1.0)
      // Health score already integrates failure rate and malformed rate
      const empiricalMultiplier = capacity.healthScore; 

      // 3. Provider Load Penalty (0.0 - 1.0)
      const providerLoad = this.capacityManager.getProviderLoad(model.provider);
      const loadPenalty = 1.0 - (providerLoad * 0.5); // Max 50% penalty for full load

      // 4. Availability / Cooldown Multiplier
      let availabilityMultiplier = 1.0;
      if (!capacity.available) {
        availabilityMultiplier = 0.1; // Huge penalty if in cooldown, basically putting it at the bottom
      }

      // 5. Cost Multiplier
      const costMultiplier = model.isFree ? 1.1 : 1.0; // 10% bonus for free models

      const totalScore = Math.round(baseQuality * empiricalMultiplier * loadPenalty * availabilityMultiplier * costMultiplier);

      const scoreBreakdown = {
        baseQuality,
        empiricalMultiplier,
        loadPenalty,
        availabilityMultiplier,
        costMultiplier
      };

      scoredCandidates.push({ model, score: totalScore, scoreBreakdown, rejectedReason, degraded });
    }

    // Filter valid and sort by score descending
    const validCandidates = scoredCandidates.filter(sc => !sc.rejectedReason);
    validCandidates.sort((a, b) => b.score - a.score);

    // Telemetry
    const rejections = scoredCandidates.filter(sc => sc.rejectedReason).map(sc => ({ model: sc.model.id, reason: sc.rejectedReason! }));
    logger.info("[MODEL_POOL_TELEMETRY] Candidate Pool Filtration", {
      Initial: initialCandidates.length,
      Accepted: validCandidates.length,
      Rejected: rejections.length,
      FinalPool: validCandidates.map(sc => ({ model: sc.model.id, score: sc.score, degraded: sc.degraded, provider: sc.model.provider }))
    });

    if (rejections.length > 0) {
      rejections.forEach(rej => logger.info(`[MODEL_POOL_TELEMETRY] Model Rejected: ${rej.model} | Reason: ${rej.reason}`));
    }

    if (validCandidates.length === 0) {
      throw new NoEligibleModelsError(
        "Candidate pool collapsed to zero.",
        rejections
      );
    }

    return validCandidates.map(sc => {
      (sc.model as any)._isDegraded = sc.degraded;
      return {
        model: sc.model,
        score: sc.score,
        scoreBreakdown: sc.scoreBreakdown
      };
    });
  }

  /**
   * Map a model entry to its provider instance.
   */
  private getProviderForModel(model: ModelEntry): ILLMProvider | undefined {
    return this.providers.get(model.provider);
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
