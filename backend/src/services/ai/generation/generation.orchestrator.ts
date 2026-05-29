import crypto from "crypto";
import type { IAssignment } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";
import { type GeneratedPaperOutput, getDynamicPaperSchemaJSON, getDynamicChunkSchemaJSON } from "../../../utils/validation.js";
import { LLMOrchestrator } from "../llm.orchestrator.js";
import type { LLMRequest, LLMResponse } from "../types.js";
import { ModelCapability } from "../types.js";
import { estimateTokens } from "../utils/token-counter.js";
import {
  GenerationCancelledError,
  LockLostError,
  ChunkGenerationError,
  ConcurrentRunError,
  StaleGenerationError,
} from "../errors.js";
import { resolveStrategy, type PromptStrategy, type ChunkContext } from "../prompts/prompt.strategy.js";
import { buildChunkPlan, type ChunkPlan, type ChunkDefinition } from "./chunk-planner.js";
import {
  acquireLock,
  renewLock,
  releaseLock,
  saveRun,
  loadRun,
  clearRun,
  isRunStale,
  type GenerationRun,
} from "./generation-run.js";
import { aggregateChunks, aggregateSingleChunk, type ChunkResult } from "./aggregator.js";
import { validatePaperIntegrity, validateChunkIntegrity } from "./integrity-validator.js";
import { extractGradeNumber } from "../prompts/prompt.utils.js";

// Phase 5: Module-level singleton — computed once, reused forever.
// Eliminates Zod-to-JSON-Schema compilation overhead from every request.
/**
 * Progress callback type for WebSocket updates.
 */
export type ProgressCallback = (
  message: string,
  completedChunks: number,
  totalChunks: number
) => void;

/**
 * Generation metadata — stored alongside the paper in MongoDB.
 * See ADR-11 for compaction policy.
 */
export interface IGenerationMetadata {
  runId: string;
  strategyId: string;
  promptVersion: string;
  modelsUsed: string[];
  providersUsed: string[];
  totalLatencyMs: number;
  chunkCount: number;
  chunksDetail: {
    chunkId: string;
    modelUsed: string;
    provider: string;
    latencyMs: number;
    promptTokens: number;
    completionTokens: number;
    retryCount: number;
  }[];
  temperature: number;
  executionMode: string;
  qualityPassed: boolean;
  qualityWarningCount: number;
  qualityWarnings: string[];
  generatedAt: Date;
}

/**
 * Unified context that flows through the entire pipeline.
 */
interface GenerationContext {
  assignmentId: string;
  runId: string;
  lockToken: string;
  strategy: PromptStrategy;
  chunkPlan: ChunkPlan;
  completedChunks: ChunkResult[];
  currentChunkIndex: number;
  conceptLedger: ConceptLedger;
  abortSignal?: AbortSignal;
  startedAt: Date;
  metadata: Partial<IGenerationMetadata>;
}

// ── Concept Ledger ──

/**
 * Lightweight cross-chunk concept tracking.
 * Extracts key terms from completed chunks and passes them as avoidance
 * list into subsequent chunk prompts. See ADR-2.
 */
class ConceptLedger {
  private conceptsBySubject: Map<string, Set<string>> = new Map();

  private static readonly STOPWORDS = new Set([
    "the", "is", "in", "of", "to", "and", "a", "an", "for", "on", "at",
    "by", "with", "from", "that", "which", "this", "are", "was", "were",
    "been", "have", "has", "had", "does", "will", "would", "what", "how",
    "when", "where", "why", "following", "given", "find", "calculate",
    "determine", "answer", "question", "value", "options", "correct",
  ]);

  recordChunk(subject: string, questions: any[]): void {
    const existing = this.conceptsBySubject.get(subject) || new Set();
    for (const q of questions) {
      const terms = this.extractKeyTerms(q.questionText || "");
      terms.forEach((t) => existing.add(t));
    }
    this.conceptsBySubject.set(subject, existing);
  }

  getAvoidanceList(subject: string): string[] {
    return Array.from(this.conceptsBySubject.get(subject) || []);
  }

  private extractKeyTerms(text: string): string[] {
    return text
      .toLowerCase()
      .split(/\W+/)
      .filter(
        (w) => w.length > 4 && !ConceptLedger.STOPWORDS.has(w)
      )
      .slice(0, 5); // keep top 5 terms per question
  }
}

// ── Main Orchestrator ──

export class GenerationOrchestrator {
  private llm: LLMOrchestrator;
  private workerId: string;

  constructor(llm: LLMOrchestrator) {
    this.llm = llm;
    this.workerId = `worker-${crypto.randomUUID().substring(0, 8)}`;
  }

  /**
   * Main entry point. Generates a full question paper for the given assignment.
   * Handles: strategy resolution, chunking, distributed locking, crash recovery,
   * cancellation, aggregation, quality evaluation, and metadata generation.
   */
  async generate(
    assignment: IAssignment,
    runId: string,
    progressCallback?: ProgressCallback,
    abortSignal?: AbortSignal,
  ): Promise<{ paper: GeneratedPaperOutput; metadata: IGenerationMetadata }> {
    const assignmentId = (assignment as any)._id?.toString() || "unknown";

    // ── 1. Acquire distributed lock ──
    const lockToken = await this.acquireLockWithRetry(assignmentId);

    try {
      // ── 2. Resolve strategy ──
      const strategy = await resolveStrategy(assignment);
      logger.info("Strategy resolved", { strategyId: strategy.strategyId, assignmentId });

      // ── 3. Build chunk plan ──
      const chunkPlan = buildChunkPlan(assignment);
      logger.info("Chunk plan built", {
        chunks: chunkPlan.chunks.length,
        mode: chunkPlan.executionMode,
      });

      // ── 4. Check for existing run (crash recovery) ──
      let ctx = await this.buildContext(
        assignmentId,
        runId,
        lockToken,
        strategy,
        chunkPlan,
        abortSignal
      );

      // ── 5. Persist run state ──
      await this.persistRunState(ctx);

      // ── 6. Execute generation ──
      if (chunkPlan.chunks.length === 1) {
        return await this.generateSingleChunk(ctx, assignment, progressCallback);
      } else {
        return await this.generateChunked(ctx, assignment, progressCallback);
      }
    } finally {
      // Always release lock
      await releaseLock(assignmentId, lockToken);
    }
  }

  // ── Single Chunk ──

  private async generateSingleChunk(
    ctx: GenerationContext,
    assignment: IAssignment,
    progressCallback?: ProgressCallback,
  ): Promise<{ paper: GeneratedPaperOutput; metadata: IGenerationMetadata }> {
    this.checkAborted(ctx);
    progressCallback?.("Generating question paper...", 0, 1);

    const startTime = Date.now();
    const systemPrompt = ctx.strategy.buildSystemPrompt(assignment);
    const expectedSchema = getDynamicPaperSchemaJSON(assignment.questionTypes);

    // Phase 1: Prompt profiling
    const profile = ctx.strategy.getPromptProfile(assignment);
    const schemaTokens = estimateTokens(JSON.stringify(expectedSchema));
    logger.info("[PROFILER] Prompt Token Breakdown", {
      ...profile,
      schemaInjection: schemaTokens,
      totalSystemPrompt: estimateTokens(systemPrompt),
      totalWithSchema: estimateTokens(systemPrompt) + schemaTokens,
    });

    // Phase 4: Use realistic completion estimate
    const estimatedCompletion = ctx.strategy.estimateCompletionTokens(assignment);
    const maxOutputTokens = ctx.strategy.getMaxOutputTokens();

    const request: LLMRequest = {
      systemPrompt,
      userPrompt: "Generate the assessment JSON now.",
      expectedSchema,
      temperature: ctx.strategy.getTemperature(),
      preferredTier: ctx.strategy.getPreferredTier(),
      fallbackTier: ctx.strategy.getFallbackTier(),
      preferredModelId: ctx.strategy.getPreferredModel() || undefined,
      maxOutputTokens,
      estimatedCompletionTokens: estimatedCompletion,
    };

    // Fresh AbortController per attempt — prevents cascading aborts across fallback models
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(new Error("LLM request timed out")), 180_000); // 3 min

    const onParentAbort = () => abortController.abort(new Error("Generation cancelled"));
    if (ctx.abortSignal && !ctx.abortSignal.aborted) {
      ctx.abortSignal.addEventListener('abort', onParentAbort, { once: true });
    }
    request.abortSignal = abortController.signal;

    let result;
    try {
      result = await this.llm.generateJSON<GeneratedPaperOutput>(request);
    } finally {
      clearTimeout(timeoutId);
      ctx.abortSignal?.removeEventListener('abort', onParentAbort);
    }
    const latencyMs = Date.now() - startTime;

    // Post-process college section labels
    const paper = this.postProcessSectionLabels(result.data, assignment);

    // Build single chunk result for aggregation
    const chunkResult: ChunkResult = {
      chunkId: "single-0",
      sections: paper.sections,
      modelUsed: result.raw.modelUsed,
      provider: result.raw.providerName,
      latencyMs,
      promptTokens: result.raw.usage?.promptTokens || 0,
      completionTokens: result.raw.usage?.completionTokens || 0,
      retryCount: 0,
    };

    const { paper: validatedPaper, qualityReport } = aggregateSingleChunk(chunkResult, paper);

    // ── Validate Generation Integrity ──
    validatePaperIntegrity(assignment, validatedPaper);

    // Build metadata
    const metadata = this.buildMetadata(ctx, [chunkResult], qualityReport);

    // Cleanup
    await clearRun(ctx.assignmentId);
    progressCallback?.("Paper generated successfully", 1, 1);

    return { paper: validatedPaper, metadata };
  }

  // ── Chunked Generation (Multi-Type) ──

  private async generateChunked(
    ctx: GenerationContext,
    assignment: IAssignment,
    progressCallback?: ProgressCallback,
  ): Promise<{ paper: GeneratedPaperOutput; metadata: IGenerationMetadata }> {
    const totalChunks = ctx.chunkPlan.chunks.length;

    for (let i = ctx.currentChunkIndex; i < totalChunks; i++) {
      this.checkAborted(ctx);

      const chunk = ctx.chunkPlan.chunks[i];
      ctx.currentChunkIndex = i;

      progressCallback?.(
        `Generating ${chunk.sectionLabel} (${i + 1}/${totalChunks})...`,
        i,
        totalChunks
      );

      // Generate this chunk
      const chunkResult = await this.generateOneChunk(ctx, assignment, chunk);
      ctx.completedChunks.push(chunkResult);

      // Record concepts for cross-chunk dedup
      const chunkQuestions = chunkResult.sections.flatMap((s: any) => s.questions || []);
      ctx.conceptLedger.recordChunk(chunk.subject, chunkQuestions);

      // Update run state in Redis
      await this.updateRunState(ctx, chunk.chunkId);

      // Renew lock after each chunk
      const renewed = await renewLock(ctx.assignmentId, ctx.lockToken);
      if (!renewed) {
        throw new LockLostError(ctx.assignmentId, ctx.runId);
      }

      // Rate-limit delay
      if (i < totalChunks - 1 && ctx.chunkPlan.delayBetweenChunksMs > 0) {
        await this.delay(ctx.chunkPlan.delayBetweenChunksMs);
      }
    }

    // ── Batch Recovery Pass ──
    progressCallback?.("Running batch recovery for missing questions...", totalChunks, totalChunks);
    
    for (let i = 0; i < ctx.completedChunks.length; i++) {
      const chunkResult = ctx.completedChunks[i];
      const chunkPlan = ctx.chunkPlan.chunks.find((c) => c.chunkId === chunkResult.chunkId);
      
      if (!chunkPlan) continue;
      
      const generatedCount = chunkResult.sections.reduce((acc: number, s: any) => acc + (s.questions?.length || 0), 0);
      const missingCount = chunkPlan.questionCount - generatedCount;
      
      if (missingCount > 0) {
        logger.info(`[OutputRecoveryManager] Chunk ${chunkPlan.chunkId} fell short by ${missingCount} questions. Triggering recovery.`);
        
        // Construct a modified chunk plan just for the missing questions
        const recoveryChunk = { ...chunkPlan, questionCount: missingCount };
        
        try {
          const recoveryResult = await this.generateOneChunk(ctx, assignment, recoveryChunk);
          const recoverySections = recoveryResult.sections || [];
          
          if (chunkResult.sections.length > 0 && recoverySections.length > 0) {
            chunkResult.sections[0].questions.push(...(recoverySections[0].questions as any[]));
          } else if (chunkResult.sections.length === 0 && recoverySections.length > 0) {
            chunkResult.sections = recoverySections;
          }
          
          logger.info(`[OutputRecoveryManager] Recovered questions for ${chunkPlan.chunkId}.`);
        } catch (error) {
          logger.error(`[OutputRecoveryManager] Recovery failed for ${chunkPlan.chunkId}:`, { error: (error as Error).message });
        }
      }

      // ── Final Chunk Integrity Check ──
      // Enforce strict matching; any mismatch fails the benchmark
      validateChunkIntegrity(chunkPlan, chunkResult);
    }

    // ── Aggregate ──
    progressCallback?.("Assembling final paper...", totalChunks, totalChunks);

    const { paper, qualityReport } = aggregateChunks(ctx.completedChunks, {
      title: assignment.title,
      subject: assignment.subject,
      totalMarks: assignment.totalMarks,
      duration: assignment.duration,
    });

    // ── Validate Generation Integrity ──
    validatePaperIntegrity(assignment, paper);

    // Build metadata
    const metadata = this.buildMetadata(ctx, ctx.completedChunks, qualityReport);

    // Cleanup
    await clearRun(ctx.assignmentId);
    progressCallback?.("Paper generated successfully", totalChunks, totalChunks);

    return { paper, metadata };
  }

  /**
   * Generate a single chunk with retries.
   */
  private async generateOneChunk(
    ctx: GenerationContext,
    assignment: IAssignment,
    chunk: ChunkDefinition,
  ): Promise<ChunkResult> {
    const MAX_RETRIES = 2;
    let lastError = "";

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const startTime = Date.now();

      try {
        // Build chunk-specific prompt
        const chunkContext: ChunkContext = {
          chunkId: chunk.chunkId,
          subject: chunk.subject,
          sectionLabel: chunk.sectionLabel,
          questionCount: chunk.questionCount,
          questionType: chunk.questionType,
          marksPerQuestion: chunk.marksPerQuestion,
          negativeMarking: chunk.negativeMarking,
          attemptRule: chunk.attemptRule,
          avoidanceConcepts: ctx.conceptLedger.getAvoidanceList(chunk.subject),
        };

        const systemPrompt = ctx.strategy.buildSystemPrompt(assignment, chunkContext);
        
        const expectedSchema = getDynamicChunkSchemaJSON([chunk.questionType]);

        const estimatedCompletion = ctx.strategy.estimateCompletionTokens(assignment, chunkContext);
        // SAFETY BUFFER: Give 50% extra completion room without overallocating the physical token runway (which trips TPM limits)
        const maxOutputTokens = Math.ceil(estimatedCompletion * 1.5);

        const request: LLMRequest = {
          systemPrompt,
          userPrompt: `Generate EXACTLY ${chunk.questionCount} questions for the "${chunk.sectionLabel}" section as a JSON paper. All questions in this section MUST have the "questionType" field set strictly to "${chunk.questionType}". Only include this section.`,
          expectedSchema,
          temperature: ctx.strategy.getTemperature(),
          preferredTier: ctx.strategy.getPreferredTier(),
          fallbackTier: ctx.strategy.getFallbackTier(),
          requiredQuestionCapability: chunk.questionType,
          requiredWorkload: 'question-generation',
          allowCapabilityDegradation: true,
          preferredModelId: ctx.strategy.getPreferredModel() || undefined,
          maxOutputTokens,
          estimatedCompletionTokens: estimatedCompletion,
          requestId: ctx.runId,
          chunkId: chunk.chunkId,
        };

        const promptTokensEstimate = estimateTokens(request.systemPrompt) + estimateTokens(request.userPrompt);
        const schemaTokensEstimate = expectedSchema ? estimateTokens(JSON.stringify(expectedSchema)) : 0;
        
        logger.info("[CHUNK_TELEMETRY] Chunk Context Analyzed", {
          chunkId: chunk.chunkId,
          questionType: chunk.questionType,
          questionCount: chunk.questionCount,
          promptTokensBeforeSend: promptTokensEstimate,
          schemaTokens: schemaTokensEstimate,
          estimatedCompletionTokens: estimatedCompletion,
          maxTokensRequested: maxOutputTokens
        });

        // Fresh AbortController per retry attempt — isolates timeout from fallback chain
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(new Error("LLM request timed out")), 180_000);

        const onParentAbort = () => abortController.abort(new Error("Generation cancelled"));
        if (ctx.abortSignal && !ctx.abortSignal.aborted) {
          ctx.abortSignal.addEventListener('abort', onParentAbort, { once: true });
        }
        request.abortSignal = abortController.signal;

        let result;
        try {
          result = await this.llm.generateJSON<any>(request);
        } finally {
          clearTimeout(timeoutId);
          ctx.abortSignal?.removeEventListener('abort', onParentAbort);
        }
        const latencyMs = Date.now() - startTime;

        // Extract sections from LLM response
        let sections = result.data.sections;
        
        // Fallback extraction logic: if the LLM returned an array directly or omitted the root wrapper
        if (!sections && Array.isArray(result.data)) {
          if (result.data.length > 0 && result.data[0].questions) {
            sections = result.data; // It's an array of sections
          } else {
            // It's an array of questions directly
            sections = [{
              sectionLabel: chunk.sectionLabel,
              sectionTitle: `Part ${chunk.sectionLabel}`,
              instruction: "Answer the following questions:",
              questions: result.data
            }];
          }
        } else if (!sections && result.data?.questions) {
          // It returned a single section object directly
          sections = [result.data];
        }
        
        // Return the extracted sections. Batch recovery will handle shortfalls.
        const generatedCount = sections.reduce((acc: number, s: any) => acc + (s.questions?.length || 0), 0);
        
        if (generatedCount === 0) {
          throw new Error("Zero questions extracted from response.");
        }
        
        if (generatedCount > chunk.questionCount) {
          throw new Error(`Overgenerated: Expected ${chunk.questionCount}, got ${generatedCount}.`);
        }


        return {
          chunkId: chunk.chunkId,
          sections,
          modelUsed: result.raw.modelUsed,
          provider: result.raw.providerName,
          latencyMs,
          promptTokens: result.raw.usage?.promptTokens || 0,
          completionTokens: result.raw.usage?.completionTokens || 0,
          retryCount: attempt,
        };
      } catch (error: any) {
        lastError = error?.message || String(error);
        logger.warn("Chunk generation attempt failed", {
          chunkId: chunk.chunkId,
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES + 1,
          error: lastError,
        });

        if (attempt < MAX_RETRIES) {
          await this.delay(1000 * (attempt + 1)); // backoff: 1s, 2s
        }
      }
    }

    throw new ChunkGenerationError(chunk.chunkId, MAX_RETRIES + 1, lastError);
  }

  // ── Context & State Management ──

  private async buildContext(
    assignmentId: string,
    runId: string,
    lockToken: string,
    strategy: PromptStrategy,
    chunkPlan: ChunkPlan,
    abortSignal?: AbortSignal,
  ): Promise<GenerationContext> {
    // Check for existing run (crash recovery)
    const existingRun = await loadRun(assignmentId);

    if (existingRun && isRunStale(existingRun)) {
      logger.info("Recovering stale generation run", {
        staleRunId: existingRun.runId,
        completedChunks: existingRun.completedChunkIds.length,
        totalChunks: existingRun.totalChunks,
      });

      // Resume from where it left off
      const completedChunks: ChunkResult[] = existingRun.completedChunkResults
        ? JSON.parse(existingRun.completedChunkResults)
        : [];

      // Rebuild concept ledger from completed chunks
      const ledger = new ConceptLedger();
      for (let i = 0; i < completedChunks.length; i++) {
        const chunkDef = chunkPlan.chunks[i];
        const questions = completedChunks[i]?.sections?.flatMap((s: any) => s.questions || []) || [];
        ledger.recordChunk(chunkDef?.subject || "", questions);
      }

      return {
        assignmentId,
        runId,
        lockToken,
        strategy,
        chunkPlan,
        completedChunks,
        currentChunkIndex: completedChunks.length,
        conceptLedger: ledger,
        abortSignal,
        startedAt: new Date(existingRun.startedAt),
        metadata: {
          runId,
          strategyId: strategy.strategyId,
          promptVersion: strategy.promptVersion,
        },
      };
    }

    // Fresh context
    return {
      assignmentId,
      runId,
      lockToken,
      strategy,
      chunkPlan,
      completedChunks: [],
      currentChunkIndex: 0,
      conceptLedger: new ConceptLedger(),
      abortSignal,
      startedAt: new Date(),
      metadata: {
        runId,
        strategyId: strategy.strategyId,
        promptVersion: strategy.promptVersion,
      },
    };
  }

  private async persistRunState(ctx: GenerationContext): Promise<void> {
    const run: GenerationRun = {
      runId: ctx.runId,
      assignmentId: ctx.assignmentId,
      status: "active",
      strategyId: ctx.strategy.strategyId,
      completedChunkIds: ctx.completedChunks.map((c) => c.chunkId),
      completedChunkResults: JSON.stringify(ctx.completedChunks),
      currentChunkId: null,
      totalChunks: ctx.chunkPlan.chunks.length,
      startedAt: ctx.startedAt.getTime(),
      updatedAt: Date.now(),
      workerId: this.workerId,
      lockToken: ctx.lockToken,
    };
    await saveRun(run);
  }

  private async updateRunState(ctx: GenerationContext, completedChunkId: string): Promise<void> {
    const run: GenerationRun = {
      runId: ctx.runId,
      assignmentId: ctx.assignmentId,
      status: "active",
      strategyId: ctx.strategy.strategyId,
      completedChunkIds: ctx.completedChunks.map((c) => c.chunkId),
      completedChunkResults: JSON.stringify(ctx.completedChunks),
      currentChunkId: completedChunkId,
      totalChunks: ctx.chunkPlan.chunks.length,
      startedAt: ctx.startedAt.getTime(),
      updatedAt: Date.now(),
      workerId: this.workerId,
      lockToken: ctx.lockToken,
    };
    await saveRun(run);
  }

  // ── Lock Acquisition ──

  private async acquireLockWithRetry(assignmentId: string): Promise<string> {
    // Try acquiring lock
    const lockToken = await acquireLock(assignmentId);
    if (lockToken) return lockToken;

    // Lock held — check if the run is stale
    const existingRun = await loadRun(assignmentId);
    if (existingRun && !isRunStale(existingRun)) {
      // Another worker is genuinely running — don't interfere
      throw new ConcurrentRunError(assignmentId, existingRun.runId);
    }

    // Stale run — wait for lock TTL to expire, then retry
    logger.info("Waiting for stale lock to expire", { assignmentId });
    await this.delay(5000); // wait 5s

    const retryToken = await acquireLock(assignmentId);
    if (retryToken) return retryToken;

    // Still can't get it — someone else got it first
    throw new ConcurrentRunError(assignmentId, existingRun?.runId || "unknown");
  }

  // ── Metadata ──

  private buildMetadata(
    ctx: GenerationContext,
    chunks: ChunkResult[],
    qualityReport: { passed: boolean; warningCount: number; warnings: { message: string }[] },
  ): IGenerationMetadata {
    const modelsUsed = [...new Set(chunks.map((c) => c.modelUsed))];
    const providersUsed = [...new Set(chunks.map((c) => c.provider))];
    const totalLatencyMs = chunks.reduce((sum, c) => sum + c.latencyMs, 0);

    // Cap chunksDetail at 20 entries (ADR-11)
    const chunksDetail = chunks.slice(0, 20).map((c) => ({
      chunkId: c.chunkId,
      modelUsed: c.modelUsed,
      provider: c.provider,
      latencyMs: c.latencyMs,
      promptTokens: c.promptTokens,
      completionTokens: c.completionTokens,
      retryCount: c.retryCount,
    }));

    // Cap quality warnings at 50, each at 200 chars (ADR-11)
    const qualityWarnings = qualityReport.warnings
      .slice(0, 50)
      .map((w) => w.message.substring(0, 200));

    return {
      runId: ctx.runId,
      strategyId: ctx.strategy.strategyId,
      promptVersion: ctx.strategy.promptVersion,
      modelsUsed,
      providersUsed,
      totalLatencyMs,
      chunkCount: chunks.length,
      chunksDetail,
      temperature: ctx.strategy.getTemperature(),
      executionMode: ctx.chunkPlan.executionMode,
      qualityPassed: qualityReport.passed,
      qualityWarningCount: qualityReport.warningCount,
      qualityWarnings,
      generatedAt: new Date(),
    };
  }

  // ── Post-Processing ──

  /**
   * Dynamic section labeling.
   */
  private postProcessSectionLabels(paper: GeneratedPaperOutput, assignment: IAssignment): GeneratedPaperOutput {
    const sections = paper.sections;
    if (!sections || sections.length === 0) return paper;

    // Sanitize question types generated by AI to match strict DB enum
    const typeMapping: Record<string, string> = {
      "MCQ": "Multiple Choice Questions",
      "Short Answer": "Short Answer Questions",
      "Long Answer": "Long Answer Questions",
      "Numerical": "Numerical Problems",
      "Diagram": "Diagram/Graph-Based Questions",
      "Diagram/Graph": "Diagram/Graph-Based Questions"
    };

    for (const section of sections) {
      for (const q of section.questions) {
        if (typeMapping[q.questionType]) {
          // @ts-ignore - TS complains about assigning a string to the discriminated union literal, but we know it's valid
          q.questionType = typeMapping[q.questionType];
        }
      }
    }

    const getGroupRank = (type: string | undefined): number => {
      if (!type) return 99;
      if (["Multiple Choice Questions", "MCQ", "True/False", "Fill in the Blanks"].includes(type)) return 1;
      if (type === "Short Answer Questions") return 2;
      if (["Long Answer Questions", "Numerical Problems"].includes(type)) return 3;
      if (["Diagram/Graph-Based Questions", "Diagram/Graph"].includes(type)) return 4;
      return 99;
    };

    // Determine the rank of each section based on its first question
    const sectionRanks = sections.map((section) => getGroupRank(section.questions[0]?.questionType));

    // Extract unique valid ranks, sort them
    const uniqueRanks = Array.from(new Set(sectionRanks)).filter((r) => r !== 99).sort((a, b) => a - b);

    // Map each rank to a letter (A, B, C...)
    const rankToLetter = new Map<number, string>();
    uniqueRanks.forEach((rank, index) => {
      rankToLetter.set(rank, String.fromCharCode(65 + index)); // 65 is 'A'
    });

    // Apply the mapped letter to each section
    for (let i = 0; i < sections.length; i++) {
      const rank = sectionRanks[i];
      if (rank !== 99 && rankToLetter.has(rank)) {
        sections[i].sectionLabel = rankToLetter.get(rank)!;
      }
    }

    return paper;
  }

  // ── Helpers ──

  private checkAborted(ctx: GenerationContext): void {
    if (ctx.abortSignal?.aborted) {
      throw new GenerationCancelledError(
        ctx.assignmentId,
        ctx.completedChunks.length
      );
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
