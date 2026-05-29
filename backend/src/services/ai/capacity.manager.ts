import { logger } from "../../utils/logger.js";
import type { ModelEntry } from "./models/model-registry.js";

/**
 * Unified Capacity Manager
 * 
 * Single source of truth for provider/model capacity state.
 * Merges the responsibilities of the old ProviderCooldownManager and TpmTracker
 * into one coherent system with provider-level health awareness.
 * 
 * This is a PURE STATE engine. It does NOT own waiting, sleeping, or scheduling.
 * The GenerationOrchestrator reads capacity state and decides what to do.
 */

// ── Types ──

export interface CapacityStatus {
  available: boolean;
  remainingTPM: number;
  remainingRPM: number;
  maxTPM: number;
  maxRPM: number;
  cooldownUntil: number;       // epoch ms, 0 if not cooling down
  retryAfterMs: number;        // ms until cooldown expires, 0 if available
  healthScore: number;         // 0.0 (dead) to 1.0 (perfect)
  recentFailureRate: number;   // 0.0 to 1.0 within rolling window
  malformedRate: number;       // 0.0 to 1.0 within rolling window
  providerDegraded: boolean;   // true if the entire provider is marked degraded
  canServeRequest: boolean;    // true if admission control passes
  admissionReason?: string;    // Reason if admission control fails
}

interface ProviderState {
  cooldownUntil: number;
  consecutiveFailures: number;
  totalRequests: number;        // rolling window
  totalFailures: number;        // rolling window
  totalMalformed: number;       // rolling window
  lastRequestAt: number;
  inflightRequests: number;
}

interface ModelTPMState {
  usageEntries: { timestamp: number; tokens: number }[];
}

// ── Constants ──

const TPM_WINDOW_MS = 60_000;    // 60s sliding window for TPM
const HEALTH_WINDOW_MS = 300_000; // 5-minute rolling window for health scoring
const PROVIDER_DEGRADATION_MS = 60_000; // Default provider degradation duration

const DEFAULT_LIMITS: Record<string, { maxTPM: number; maxRPM: number; contextWindow: number }> = {
  // Groq
  "llama-3.3-70b-versatile":              { maxTPM: 12_000, maxRPM: 30, contextWindow: 128_000 },
  "llama-3.1-8b-instant":                 { maxTPM: 6_000,  maxRPM: 30, contextWindow: 8_000 },
  // OpenRouter
  "deepseek/deepseek-v4-flash:free":      { maxTPM: 100_000, maxRPM: 200, contextWindow: 64_000 },
  "meta-llama/llama-3.3-70b-instruct:free": { maxTPM: 100_000, maxRPM: 200, contextWindow: 128_000 },
  // Cohere
  "command-r-08-2024":                    { maxTPM: 100_000, maxRPM: 20, contextWindow: 128_000 },
};

// ── Capacity Manager ──

export class CapacityManager {
  private providerStates: Map<string, ProviderState> = new Map();
  private modelTPM: Map<string, ModelTPMState> = new Map();
  private modelCooldowns: Map<string, number> = new Map(); // modelId -> cooldownUntil

  /**
   * Get the full capacity status for a model, incorporating provider-level state and admission control.
   */
  getCapacityStatus(
    providerId: string, 
    modelId: string,
    estimatedPromptTokens: number,
    estimatedCompletionTokens: number
  ): CapacityStatus {
    const providerState = this.getOrCreateProviderState(providerId);
    const now = Date.now();

    // Provider-level degradation
    const providerDegraded = providerState.cooldownUntil > now;

    // Model-level cooldown
    const modelCooldownUntil = this.modelCooldowns.get(modelId) ?? 0;
    const effectiveCooldownUntil = Math.max(
      providerDegraded ? providerState.cooldownUntil : 0,
      modelCooldownUntil,
    );
    const retryAfterMs = Math.max(0, effectiveCooldownUntil - now);
    const available = effectiveCooldownUntil <= now;

    // TPM
    const limits = DEFAULT_LIMITS[modelId] ?? { maxTPM: 50_000, maxRPM: 100, contextWindow: 32_000 };
    const currentTPM = this.getCurrentTPM(modelId);
    const remainingTPM = Math.max(0, limits.maxTPM - currentTPM);

    // Admission Control
    const totalTokens = estimatedPromptTokens + estimatedCompletionTokens;
    let canServeRequest = true;
    let admissionReason: string | undefined;

    if (totalTokens + currentTPM > limits.maxTPM) {
      canServeRequest = false;
      admissionReason = `Total ${totalTokens} + usage ${currentTPM} exceeds TPM limit ${limits.maxTPM}`;
    } else if (totalTokens > limits.contextWindow) {
      canServeRequest = false;
      admissionReason = `Total ${totalTokens} exceeds context window ${limits.contextWindow}`;
    }

    // Health score (0.0 to 1.0)
    const { failureRate, malformedRate, healthScore } = this.computeHealth(providerState, now);

    return {
      available,
      remainingTPM,
      remainingRPM: limits.maxRPM, // RPM tracking is coarse; refine later
      maxTPM: limits.maxTPM,
      maxRPM: limits.maxRPM,
      cooldownUntil: effectiveCooldownUntil,
      retryAfterMs,
      healthScore,
      recentFailureRate: failureRate,
      malformedRate,
      providerDegraded,
      canServeRequest,
      admissionReason,
    };
  }

  /**
   * Mark an entire provider as degraded (e.g., after a 429 from any model on that provider).
   * All models on this provider will be penalized until the cooldown expires.
   */
  markProviderDegraded(providerId: string, retryAfterMs?: number): void {
    const state = this.getOrCreateProviderState(providerId);
    const duration = retryAfterMs ?? PROVIDER_DEGRADATION_MS;
    state.cooldownUntil = Date.now() + duration;
    state.consecutiveFailures++;

    logger.warn("[CAPACITY] Provider marked degraded", {
      providerId,
      cooldownUntil: new Date(state.cooldownUntil).toISOString(),
      durationMs: duration,
      consecutiveFailures: state.consecutiveFailures,
    });
  }

  /**
   * Mark a specific model as cooling down (e.g., model-specific 429 with retry-after).
   */
  markModelCooldown(modelId: string, retryAfterMs: number): void {
    const cooldownUntil = Date.now() + retryAfterMs;
    this.modelCooldowns.set(modelId, cooldownUntil);

    logger.warn("[CAPACITY] Model placed in cooldown", {
      modelId,
      retryAfterMs,
      cooldownUntil: new Date(cooldownUntil).toISOString(),
    });
  }

  /**
   * Called when a request starts routing to a provider.
   */
  startRequest(providerId: string): void {
    const state = this.getOrCreateProviderState(providerId);
    state.inflightRequests++;
    state.lastRequestAt = Date.now();
  }

  /**
   * Called when a request finishes (success or failure) to decrement inflight.
   */
  endRequest(providerId: string): void {
    const state = this.getOrCreateProviderState(providerId);
    state.inflightRequests = Math.max(0, state.inflightRequests - 1);
  }

  /**
   * Record a successful request. Resets consecutive failure counter.
   */
  recordSuccess(providerId: string, modelId: string, tokensUsed: number): void {
    const state = this.getOrCreateProviderState(providerId);
    state.consecutiveFailures = 0;
    state.totalRequests++;
    state.lastRequestAt = Date.now();

    // Record TPM usage
    this.recordTPMUsage(modelId, tokensUsed);
  }

  /**
   * Record a malformed response (JSON parse failure).
   */
  recordMalformed(providerId: string): void {
    const state = this.getOrCreateProviderState(providerId);
    state.totalMalformed++;
    state.totalRequests++;
    state.lastRequestAt = Date.now();
  }

  /**
   * Record a failed request. Increments consecutive failure counter.
   */
  recordFailure(providerId: string): void {
    const state = this.getOrCreateProviderState(providerId);
    state.consecutiveFailures++;
    state.totalFailures++;
    state.totalRequests++;
    state.lastRequestAt = Date.now();
  }

  /**
   * Record token usage for TPM tracking.
   */
  recordTPMUsage(modelId: string, tokens: number): void {
    if (!this.modelTPM.has(modelId)) {
      this.modelTPM.set(modelId, { usageEntries: [] });
    }
    const state = this.modelTPM.get(modelId)!;
    state.usageEntries.push({ timestamp: Date.now(), tokens });
    this.pruneTPM(modelId);
  }

  /**
   * Get current TPM usage for a model (tokens consumed in the last 60s).
   */
  getCurrentTPM(modelId: string): number {
    this.pruneTPM(modelId);
    const state = this.modelTPM.get(modelId);
    if (!state) return 0;
    return state.usageEntries.reduce((sum, e) => sum + e.tokens, 0);
  }

  /**
   * Get the provider load as a ratio (0.0 = idle, 1.0 = fully utilized).
   * Used by the scoring system for load balancing.
   */
  getProviderLoad(providerId: string): number {
    const state = this.getOrCreateProviderState(providerId);
    const now = Date.now();
    
    // If degraded, load = 1.0 (fully utilized / unavailable)
    if (state.cooldownUntil > now) return 1.0;

    // Use inflight concurrency as primary load signal (assume 10 requests is "fully loaded" per provider per worker)
    const MAX_CONCURRENCY = 10;
    const concurrentRatio = Math.min(1.0, state.inflightRequests / MAX_CONCURRENCY);
    
    if (concurrentRatio > 0) {
      return concurrentRatio;
    }

    // Fallback: recent activity intensity if nothing inflight
    const timeSinceLastRequest = now - state.lastRequestAt;
    if (timeSinceLastRequest > 30_000) return 0.0; // idle for 30s+
    if (timeSinceLastRequest > 10_000) return 0.2;
    if (timeSinceLastRequest > 5_000) return 0.4;
    return 0.7; // very recent activity
  }

  // ── Private Helpers ──

  private getOrCreateProviderState(providerId: string): ProviderState {
    if (!this.providerStates.has(providerId)) {
      this.providerStates.set(providerId, {
        cooldownUntil: 0,
        consecutiveFailures: 0,
        totalRequests: 0,
        totalFailures: 0,
        totalMalformed: 0,
        lastRequestAt: 0,
        inflightRequests: 0,
      });
    }
    return this.providerStates.get(providerId)!;
  }

  private pruneTPM(modelId: string): void {
    const state = this.modelTPM.get(modelId);
    if (!state) return;
    const cutoff = Date.now() - TPM_WINDOW_MS;
    state.usageEntries = state.usageEntries.filter(e => e.timestamp > cutoff);
  }

  private computeHealth(state: ProviderState, now: number): { failureRate: number; malformedRate: number; healthScore: number } {
    if (state.totalRequests === 0) {
      return { failureRate: 0, malformedRate: 0, healthScore: 1.0 };
    }

    const failureRate = state.totalFailures / state.totalRequests;
    const malformedRate = state.totalMalformed / state.totalRequests;
    
    // Health score: penalize consecutive failures heavily, and malformed outputs
    let healthScore = 1.0 - failureRate - (malformedRate * 0.5);

    // Extra penalty for consecutive failures
    if (state.consecutiveFailures >= 3) healthScore *= 0.5;
    else if (state.consecutiveFailures >= 2) healthScore *= 0.7;

    // Extra penalty if currently degraded
    if (state.cooldownUntil > now) healthScore *= 0.3;

    // Circuit Open Simulation: high failure or malformed rate means health goes to 0
    if (failureRate > 0.5 || malformedRate > 0.5) healthScore = 0;

    return { failureRate, malformedRate, healthScore: Math.max(0, Math.min(1, healthScore)) };
  }
}
