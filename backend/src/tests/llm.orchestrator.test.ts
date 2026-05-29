import { describe, it, beforeEach, mock } from 'node:test';
import * as assert from 'node:assert';
import { LLMOrchestrator } from '../services/ai/llm.orchestrator.js';
import * as registry from '../services/ai/models/model-registry.js';
import { ModelTier } from '../services/ai/models/model-registry.js';
import { NoEligibleModelsError } from '../services/ai/errors.js';
import { LLMRequest } from '../services/ai/types.js';
import { CapacityManager } from '../services/ai/capacity.manager.js';

describe('LLMOrchestrator - Unified Dynamic Scoring & Multi-Provider Routing', () => {
  let orchestrator: any;
  let capacityManager: CapacityManager;

  beforeEach(() => {
    capacityManager = new CapacityManager();
    orchestrator = new LLMOrchestrator([], capacityManager);

    // Mock getProviderForModel
    orchestrator.getProviderForModel = () => ({
      isAvailable: () => true
    });
  });

  const mockTier1Model = {
    id: 'tier1-model',
    provider: 'groq',
    tier: ModelTier.TIER_1,
    capabilities: { reasoning: 7, structuredJson: 8, mathematicalReasoning: 7 },
    generation: {
      supportsMCQ: true,
      supportsLongAnswerQuestionGeneration: true,
      supportsLongAnswerAnswerGeneration: true,
    },
    maxTokensPerMinute: 100000,
    isFree: true,
  };

  const mockTier1CohereModel = {
    id: 'command-r-plus',
    provider: 'cohere',
    tier: ModelTier.TIER_1,
    capabilities: { reasoning: 8, structuredJson: 9, mathematicalReasoning: 7 },
    generation: {
      supportsMCQ: true,
      supportsLongAnswerQuestionGeneration: true,
      supportsLongAnswerAnswerGeneration: true,
    },
    maxTokensPerMinute: 100000,
    isFree: true,
  };

  const mockTier3Model = {
    id: 'tier3-model',
    provider: 'groq',
    tier: ModelTier.TIER_3,
    capabilities: { reasoning: 5, structuredJson: 6, mathematicalReasoning: 5 },
    generation: {
      supportsMCQ: true,
      supportsLongAnswerQuestionGeneration: true,
      supportsLongAnswerAnswerGeneration: false, // Fails answer generation
    },
    maxTokensPerMinute: 10000,
    isFree: true,
  };

  const createRequest = (overrides: Partial<LLMRequest> = {}): LLMRequest => ({
    systemPrompt: 'System',
    userPrompt: 'User',
    estimatedCompletionTokens: 100,
    ...overrides
  });

  it('Scenario A: Tier-1 in cooldown, Tier-3 available -> Generation succeeds', () => {
    orchestrator._getModels = () => [mockTier1Model, mockTier3Model];
    // Put tier1 model's provider in cooldown via CapacityManager
    capacityManager.markModelCooldown('tier1-model', 60000);

    const eligible = orchestrator.getEligibleModels(createRequest({
      requiredQuestionCapability: 'Multiple Choice Questions'
    }));

    // Tier 3 should be ranked first because Tier 1 is in cooldown
    assert.ok(eligible.length > 0);
    assert.strictEqual(eligible[0].model.id, 'tier3-model');
    assert.strictEqual((eligible[0].model as any)._isDegraded, false);
  });

  it('Scenario B: Capability mismatch, Fallback allowed -> Generation succeeds in degraded mode', () => {
    orchestrator._getModels = () => [mockTier3Model];

    // Request requires Long Answer Answer Generation, which Tier 3 lacks
    const eligible = orchestrator.getEligibleModels(createRequest({
      requiredQuestionCapability: 'Long Answer Questions',
      requiredWorkload: 'answer-generation',
      allowCapabilityDegradation: true
    }));

    assert.strictEqual(eligible.length, 1);
    assert.strictEqual(eligible[0].model.id, 'tier3-model');
    // Model should be flagged as degraded
    assert.strictEqual((eligible[0].model as any)._isDegraded, true);
  });

  it('Scenario C: Candidate pool collapse -> Recovery layer throws NoEligibleModelsError', () => {
    orchestrator._getModels = () => [mockTier3Model];

    // Request requires capability but DOES NOT allow degradation
    assert.throws(() => orchestrator.getEligibleModels(createRequest({
      requiredQuestionCapability: 'Long Answer Questions',
      requiredWorkload: 'answer-generation',
      allowCapabilityDegradation: false
    })), NoEligibleModelsError);
  });

  it('Scenario D: All providers exhausted -> Clear terminal failure', () => {
    orchestrator._getModels = () => [mockTier1Model, mockTier3Model];

    // Both providers unavailable
    orchestrator.getProviderForModel = () => ({
      isAvailable: () => false
    });

    assert.throws(() => orchestrator.getEligibleModels(createRequest()), NoEligibleModelsError);
  });

  it('Scenario E: Groq degraded -> Cohere model selected', () => {
    orchestrator._getModels = () => [mockTier1Model, mockTier1CohereModel];

    // Mock: Cohere provider available
    orchestrator.getProviderForModel = (model: any) => ({
      isAvailable: () => true
    });

    // Mark Groq as degraded
    capacityManager.markProviderDegraded('groq', 60000);

    const eligible = orchestrator.getEligibleModels(createRequest({
      requiredQuestionCapability: 'Multiple Choice Questions'
    }));

    assert.ok(eligible.length > 0);
    // Cohere model should be ranked first since Groq is degraded
    assert.strictEqual(eligible[0].model.id, 'command-r-plus');
  });

  it('Scenario F: Provider diversity -> Higher-quality model from healthy provider wins', () => {
    orchestrator._getModels = () => [mockTier1Model, mockTier1CohereModel, mockTier3Model];

    orchestrator.getProviderForModel = () => ({
      isAvailable: () => true
    });

    const eligible = orchestrator.getEligibleModels(createRequest({
      requiredQuestionCapability: 'Multiple Choice Questions'
    }));

    // Both Tier 1 models should be available, Cohere should score higher (reasoning: 8 vs 7)
    assert.ok(eligible.length >= 2);
    assert.strictEqual(eligible[0].model.id, 'command-r-plus');
    assert.strictEqual(eligible[1].model.id, 'tier1-model');
  });
});
