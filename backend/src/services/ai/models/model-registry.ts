import { logger } from "../../../utils/logger.js";

/**
 * Model tier classification.
 * Tier 1: High capability — reasoning models, 70B+, complex synthesis.
 * Tier 2: Medium — 27-32B, solid instruction following.
 * Tier 3: Low — 8-9B, simple tasks only.
 */
export enum ModelTier {
  TIER_1 = 1,
  TIER_2 = 2,
  TIER_3 = 3,
}

/**
 * Static capability scores per model (v1: informational only, v1.1: used for routing).
 * Each score is 0-10.
 */
export interface ModelCapabilityScore {
  reasoning: number;
  structuredJson: number;
  mathematicalReasoning: number;
}

export interface ModelEntry {
  id: string;
  provider: "groq" | "openrouter" | "cohere";
  tier: ModelTier;
  maxOutputTokens: number;
  capabilities: ModelCapabilityScore;
  isFree: boolean;
  disabled: boolean;
}

/**
 * The model registry. All models are free-tier.
 * Order within tiers matters — preferred models listed first.
 */
const MODEL_REGISTRY: ModelEntry[] = [
  // ── Groq Tier 1 ──
  {
    id: "deepseek-r1-distill-llama-70b",
    provider: "groq",
    tier: ModelTier.TIER_1,
    maxOutputTokens: 16384,
    capabilities: { reasoning: 9, structuredJson: 6, mathematicalReasoning: 9 },
    isFree: true,
    disabled: false,
  },
  {
    id: "llama-3.3-70b-versatile",
    provider: "groq",
    tier: ModelTier.TIER_1,
    maxOutputTokens: 16384,
    capabilities: { reasoning: 7, structuredJson: 8, mathematicalReasoning: 7 },
    isFree: true,
    disabled: false,
  },

  // ── Groq Tier 2 ──
  {
    id: "qwen3-32b",
    provider: "groq",
    tier: ModelTier.TIER_2,
    maxOutputTokens: 16384,
    capabilities: { reasoning: 7, structuredJson: 9, mathematicalReasoning: 7 },
    isFree: true,
    disabled: false,
  },
  {
    id: "llama-4-scout-17b-16e-instruct",
    provider: "groq",
    tier: ModelTier.TIER_2,
    maxOutputTokens: 16384,
    capabilities: { reasoning: 5, structuredJson: 7, mathematicalReasoning: 5 },
    isFree: true,
    disabled: false,
  },

  // ── OpenRouter Tier 1 ──
  {
    id: "deepseek/deepseek-v4-flash:free",
    provider: "openrouter",
    tier: ModelTier.TIER_1,
    maxOutputTokens: 384000,
    capabilities: { reasoning: 8, structuredJson: 8, mathematicalReasoning: 8 },
    isFree: true,
    disabled: false,
  },
  {
    id: "nvidia/nemotron-3-super:free",
    provider: "openrouter",
    tier: ModelTier.TIER_1,
    maxOutputTokens: 32768,
    capabilities: { reasoning: 7, structuredJson: 7, mathematicalReasoning: 7 },
    isFree: true,
    disabled: false,
  },

  // ── OpenRouter Tier 2 ──
  {
    id: "google/gemma-4-31b:free",
    provider: "openrouter",
    tier: ModelTier.TIER_2,
    maxOutputTokens: 16384,
    capabilities: { reasoning: 6, structuredJson: 8, mathematicalReasoning: 6 },
    isFree: true,
    disabled: false,
  },

  // ── OpenRouter Tier 3 ──
  {
    id: "meta-llama/llama-3.1-8b-instruct:free",
    provider: "openrouter",
    tier: ModelTier.TIER_3,
    maxOutputTokens: 8192,
    capabilities: { reasoning: 3, structuredJson: 5, mathematicalReasoning: 3 },
    isFree: true,
    disabled: false,
  },

  // ── Cohere Tier 2 (last resort) ──
  {
    id: "command-r-08-2024",
    provider: "cohere",
    tier: ModelTier.TIER_2,
    maxOutputTokens: 4096,
    capabilities: { reasoning: 5, structuredJson: 6, mathematicalReasoning: 4 },
    isFree: true,
    disabled: false,
  },
];

/**
 * Returns all models, optionally filtered by minimum tier and enabled status.
 */
export function getModels(options?: {
  minimumTier?: ModelTier;
  provider?: string;
  enabledOnly?: boolean;
}): ModelEntry[] {
  let models = [...MODEL_REGISTRY];

  if (options?.enabledOnly !== false) {
    models = models.filter((m) => !m.disabled);
  }
  if (options?.minimumTier !== undefined) {
    models = models.filter((m) => m.tier <= options.minimumTier!);
  }
  if (options?.provider) {
    models = models.filter((m) => m.provider === options.provider);
  }

  return models;
}

/**
 * Get a specific model entry by ID.
 */
export function getModelById(id: string): ModelEntry | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id);
}

/**
 * Get all models for a specific provider.
 */
export function getModelsForProvider(provider: string): ModelEntry[] {
  return MODEL_REGISTRY.filter((m) => m.provider === provider && !m.disabled);
}

/**
 * Disable a model (e.g., when startup validation fails or circuit breaker opens).
 */
export function disableModel(id: string, reason: string): void {
  const model = MODEL_REGISTRY.find((m) => m.id === id);
  if (model) {
    model.disabled = true;
    logger.warn("Model disabled", { modelId: id, reason });
  }
}

/**
 * Re-enable a model (e.g., circuit breaker recovery).
 */
export function enableModel(id: string): void {
  const model = MODEL_REGISTRY.find((m) => m.id === id);
  if (model) {
    model.disabled = false;
    logger.info("Model re-enabled", { modelId: id });
  }
}

/**
 * Validate the model registry on startup.
 * Checks which providers are available and disables models with missing API keys.
 * Called once from server bootstrap (index.ts).
 */
export function validateRegistry(availableProviders: Set<string>): void {
  for (const model of MODEL_REGISTRY) {
    if (!availableProviders.has(model.provider)) {
      model.disabled = true;
      logger.warn("Model disabled: provider API key missing", {
        modelId: model.id,
        provider: model.provider,
      });
    }
  }

  const enabledTier1 = MODEL_REGISTRY.filter(
    (m) => !m.disabled && m.tier === ModelTier.TIER_1
  );
  const enabledTier2 = MODEL_REGISTRY.filter(
    (m) => !m.disabled && m.tier <= ModelTier.TIER_2
  );

  if (enabledTier1.length === 0) {
    logger.error(
      "CRITICAL: No Tier 1 models available. JEE Advanced / NEET generation will fail."
    );
  }
  if (enabledTier2.length === 0) {
    logger.error(
      "CRITICAL: No Tier 1/2 models available. Only School 1-5 papers can be generated."
    );
  }

  logger.info("Model registry validated", {
    total: MODEL_REGISTRY.length,
    enabled: MODEL_REGISTRY.filter((m) => !m.disabled).length,
    tier1: enabledTier1.length,
    tier2: enabledTier2.length,
  });
}
