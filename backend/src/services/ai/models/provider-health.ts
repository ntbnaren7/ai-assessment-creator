import { logger } from "../../../utils/logger.js";

/**
 * Provider health tracking with time-windowed metrics and circuit breakers.
 * 
 * ARCHITECTURAL NOTE (ADR-4): This is INSTANCE-LOCAL by design.
 * Each worker process maintains its own health state. If running multiple
 * workers, each learns independently. This is acceptable for assignment scale
 * (typically 1 worker). For multi-worker deployments, migrate to Redis-shared
 * health state in v1.1.
 */

// ── Types ──

export interface HealthEvent {
  timestamp: number;
  type: "success" | "failure" | "timeout" | "malformed";
  latencyMs: number;
}

export interface ProviderHealthMetrics {
  failureRate: number;       // 0.0 - 1.0
  malformedRate: number;     // JSON parse failures / total
  timeoutRate: number;       // timeouts / total
  latencyP95: number;        // ms
  requestCount: number;      // events in window
  isQuotaExhausted: boolean;
  circuitState: CircuitState;
}

export type CircuitState = "closed" | "open" | "half-open";

interface CircuitBreaker {
  state: CircuitState;
  consecutiveFailures: number;
  lastStateChangeAt: number;
  cooldownMs: number;         // escalates: 60s → 120s → 240s...
}

interface QuotaState {
  requestsToday: number;
  dayStart: number;           // epoch ms of current day start (UTC midnight)
  estimatedLimit: number;
}

// ── Constants ──

const WINDOW_MS = 15 * 60 * 1000;              // 15-minute sliding window
const DEFAULT_COOLDOWN_MS = 60 * 1000;          // initial circuit breaker cooldown
const MAX_COOLDOWN_MS = 5 * 60 * 1000;          // max 5 min cooldown
const CONSECUTIVE_FAILURE_THRESHOLD = 3;
const MALFORMED_RATE_THRESHOLD = 0.5;

/** Estimated daily RPD limits for free tiers */
const DEFAULT_QUOTA_LIMITS: Record<string, number> = {
  // Groq
  "deepseek-r1-distill-llama-70b": 1000,
  "llama-3.3-70b-versatile": 1000,
  "qwen3-32b": 14400,
  "llama-4-scout-17b-16e-instruct": 14400,
  // OpenRouter
  "deepseek/deepseek-v4-flash:free": 500,
  "nvidia/nemotron-3-super:free": 500,
  "google/gemma-4-31b:free": 500,
  "meta-llama/llama-3.1-8b-instruct:free": 500,
  // Cohere
  "command-r-08-2024": 1000,
};

// ── Provider Health Tracker ──

export class ProviderHealthTracker {
  private events: Map<string, HealthEvent[]> = new Map();
  private circuits: Map<string, CircuitBreaker> = new Map();
  private quotas: Map<string, QuotaState> = new Map();

  /**
   * Record a health event for a model.
   */
  record(modelId: string, event: HealthEvent): void {
    // Append event
    const modelEvents = this.events.get(modelId) || [];
    modelEvents.push(event);
    this.events.set(modelId, modelEvents);

    // Prune old events outside window
    this.pruneEvents(modelId);

    // Update circuit breaker
    this.updateCircuit(modelId, event);

    // Update quota
    this.updateQuota(modelId, event);
  }

  /**
   * Get aggregated health metrics for a model.
   */
  getMetrics(modelId: string): ProviderHealthMetrics {
    const recent = this.getEventsInWindow(modelId);
    const total = recent.length;

    if (total === 0) {
      return {
        failureRate: 0,
        malformedRate: 0,
        timeoutRate: 0,
        latencyP95: 0,
        requestCount: 0,
        isQuotaExhausted: this.isQuotaExhausted(modelId),
        circuitState: this.getCircuitState(modelId),
      };
    }

    const failures = recent.filter((e) => e.type === "failure").length;
    const malformed = recent.filter((e) => e.type === "malformed").length;
    const timeouts = recent.filter((e) => e.type === "timeout").length;
    const latencies = recent.map((e) => e.latencyMs).sort((a, b) => a - b);
    const p95Index = Math.min(Math.floor(total * 0.95), total - 1);

    return {
      failureRate: failures / total,
      malformedRate: malformed / total,
      timeoutRate: timeouts / total,
      latencyP95: latencies[p95Index] || 0,
      requestCount: total,
      isQuotaExhausted: this.isQuotaExhausted(modelId),
      circuitState: this.getCircuitState(modelId),
    };
  }

  /**
   * Check if a model is available (circuit closed or half-open AND quota not exhausted).
   */
  isModelAvailable(modelId: string): boolean {
    const circuitState = this.getCircuitState(modelId);
    if (circuitState === "open") return false;
    if (this.isQuotaExhausted(modelId)) return false;
    return true;
  }

  /**
   * Get the current circuit state, accounting for cooldown transitions.
   */
  getCircuitState(modelId: string): CircuitState {
    const circuit = this.circuits.get(modelId);
    if (!circuit) return "closed";

    if (circuit.state === "open") {
      // Check if cooldown has elapsed → transition to half-open
      const elapsed = Date.now() - circuit.lastStateChangeAt;
      if (elapsed >= circuit.cooldownMs) {
        circuit.state = "half-open";
        circuit.lastStateChangeAt = Date.now();
        logger.info("Circuit breaker half-open (cooldown elapsed)", {
          modelId,
          cooldownMs: circuit.cooldownMs,
        });
      }
    }

    return circuit.state;
  }

  /**
   * Check if model has exhausted its estimated daily quota.
   */
  private isQuotaExhausted(modelId: string): boolean {
    const quota = this.getOrCreateQuota(modelId);
    this.resetQuotaIfNewDay(quota);
    return quota.requestsToday >= quota.estimatedLimit;
  }

  // ── Private helpers ──

  private getEventsInWindow(modelId: string): HealthEvent[] {
    const all = this.events.get(modelId) || [];
    const cutoff = Date.now() - WINDOW_MS;
    return all.filter((e) => e.timestamp >= cutoff);
  }

  private pruneEvents(modelId: string): void {
    const all = this.events.get(modelId);
    if (!all) return;
    const cutoff = Date.now() - WINDOW_MS;
    const pruned = all.filter((e) => e.timestamp >= cutoff);
    this.events.set(modelId, pruned);
  }

  private updateCircuit(modelId: string, event: HealthEvent): void {
    const circuit = this.getOrCreateCircuit(modelId);

    if (event.type === "success") {
      if (circuit.state === "half-open") {
        // Half-open success → close circuit
        circuit.state = "closed";
        circuit.consecutiveFailures = 0;
        circuit.cooldownMs = DEFAULT_COOLDOWN_MS;
        circuit.lastStateChangeAt = Date.now();
        logger.info("Circuit breaker closed (recovery success)", { modelId });
      } else {
        circuit.consecutiveFailures = 0;
      }
    } else {
      circuit.consecutiveFailures++;

      if (circuit.state === "half-open") {
        // Half-open failure → back to open with escalated cooldown
        circuit.state = "open";
        circuit.cooldownMs = Math.min(circuit.cooldownMs * 2, MAX_COOLDOWN_MS);
        circuit.lastStateChangeAt = Date.now();
        logger.warn("Circuit breaker re-opened (half-open failure)", {
          modelId,
          cooldownMs: circuit.cooldownMs,
        });
      } else if (circuit.consecutiveFailures >= CONSECUTIVE_FAILURE_THRESHOLD) {
        circuit.state = "open";
        circuit.lastStateChangeAt = Date.now();
        logger.warn("Circuit breaker opened (consecutive failures)", {
          modelId,
          failures: circuit.consecutiveFailures,
        });
      }

      // Also check malformed rate
      const metrics = this.getMetrics(modelId);
      if (
        metrics.requestCount >= 4 &&
        metrics.malformedRate > MALFORMED_RATE_THRESHOLD
      ) {
        circuit.state = "open";
        circuit.lastStateChangeAt = Date.now();
        logger.warn("Circuit breaker opened (high malformed rate)", {
          modelId,
          malformedRate: metrics.malformedRate,
        });
      }
    }
  }

  private updateQuota(modelId: string, _event: HealthEvent): void {
    const quota = this.getOrCreateQuota(modelId);
    this.resetQuotaIfNewDay(quota);
    quota.requestsToday++;

    if (quota.requestsToday >= quota.estimatedLimit * 0.9) {
      logger.warn("Provider approaching daily quota", {
        modelId,
        used: quota.requestsToday,
        limit: quota.estimatedLimit,
      });
    }

    if (quota.requestsToday >= quota.estimatedLimit) {
      logger.warn("Provider daily quota exhausted", {
        modelId,
        used: quota.requestsToday,
      });
    }
  }

  private getOrCreateCircuit(modelId: string): CircuitBreaker {
    let circuit = this.circuits.get(modelId);
    if (!circuit) {
      circuit = {
        state: "closed",
        consecutiveFailures: 0,
        lastStateChangeAt: Date.now(),
        cooldownMs: DEFAULT_COOLDOWN_MS,
      };
      this.circuits.set(modelId, circuit);
    }
    return circuit;
  }

  private getOrCreateQuota(modelId: string): QuotaState {
    let quota = this.quotas.get(modelId);
    if (!quota) {
      quota = {
        requestsToday: 0,
        dayStart: this.getUTCMidnight(),
        estimatedLimit: DEFAULT_QUOTA_LIMITS[modelId] || 500,
      };
      this.quotas.set(modelId, quota);
    }
    return quota;
  }

  private resetQuotaIfNewDay(quota: QuotaState): void {
    const currentMidnight = this.getUTCMidnight();
    if (currentMidnight > quota.dayStart) {
      quota.requestsToday = 0;
      quota.dayStart = currentMidnight;
    }
  }

  private getUTCMidnight(): number {
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  }
}
