import crypto from "crypto";
import type { IAssignment } from "../../../models/index.js";
import { logger } from "../../../utils/logger.js";
import { GeneratedPaperSchema, type GeneratedPaperOutput } from "../../../utils/validation.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { LLMOrchestrator } from "../llm.orchestrator.js";
import type { LLMRequest, LLMResponse } from "../types.js";
import { ModelCapability } from "../types.js";
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
import { isCollegeLevel } from "../prompts/prompt.utils.js";

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
        isMock: chunkPlan.isMockPaper,
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
      if (chunkPlan.chunks.length === 1 && !chunkPlan.isMockPaper) {
        return await this.generateSingleChunk(ctx, assignment, progressCallback);
      } else {
        return await this.generateChunked(ctx, assignment, progressCallback);
      }
    } finally {
      // Always release lock
      await releaseLock(assignmentId, lockToken);
    }
  }

  // ── Single Chunk (Non-Mock) ──

  private async generateSingleChunk(
    ctx: GenerationContext,
    assignment: IAssignment,
    progressCallback?: ProgressCallback,
  ): Promise<{ paper: GeneratedPaperOutput; metadata: IGenerationMetadata }> {
    this.checkAborted(ctx);
    progressCallback?.("Generating question paper...", 0, 1);

    const startTime = Date.now();
    const systemPrompt = ctx.strategy.buildSystemPrompt(assignment);
    const expectedSchema = zodToJsonSchema(GeneratedPaperSchema, "GeneratedPaper");

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(new Error("LLM request timed out")), 90_000); // 90s timeout

    if (ctx.abortSignal) {
      ctx.abortSignal.addEventListener('abort', () => abortController.abort(new Error("Generation cancelled")));
    }

    const request: LLMRequest = {
      systemPrompt,
      userPrompt: "Generate the assessment JSON now.",
      expectedSchema,
      temperature: ctx.strategy.getTemperature(),
      minimumTier: ctx.strategy.getMinimumTier(),
      preferredModelId: ctx.strategy.getPreferredModel() || undefined,
      maxOutputTokens: ctx.strategy.getMaxOutputTokens(),
      abortSignal: abortController.signal,
    };

    let result;
    try {
      result = await this.llm.generateJSON<GeneratedPaperOutput>(request);
    } finally {
      clearTimeout(timeoutId);
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

    // Build metadata
    const metadata = this.buildMetadata(ctx, [chunkResult], qualityReport);

    // Cleanup
    await clearRun(ctx.assignmentId);
    progressCallback?.("Paper generated successfully", 1, 1);

    return { paper: validatedPaper, metadata };
  }

  // ── Chunked Generation (Mock Papers) ──

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

    // ── Aggregate ──
    progressCallback?.("Assembling final paper...", totalChunks, totalChunks);

    const { paper, qualityReport } = aggregateChunks(ctx.completedChunks, {
      title: assignment.title,
      subject: assignment.subject,
      totalMarks: assignment.totalMarks,
      duration: assignment.duration,
    });

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
        const expectedSchema = zodToJsonSchema(GeneratedPaperSchema, "GeneratedPaper");

        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(new Error("LLM request timed out")), 90_000);

        if (ctx.abortSignal) {
          ctx.abortSignal.addEventListener('abort', () => abortController.abort(new Error("Generation cancelled")));
        }

        const request: LLMRequest = {
          systemPrompt,
          userPrompt: `Generate EXACTLY ${chunk.questionCount} questions for the "${chunk.sectionLabel}" section as a JSON paper. Only include this section.`,
          expectedSchema,
          temperature: ctx.strategy.getTemperature(),
          minimumTier: ctx.strategy.getMinimumTier(),
          preferredModelId: ctx.strategy.getPreferredModel() || undefined,
          maxOutputTokens: ctx.strategy.getMaxOutputTokens(),
          abortSignal: abortController.signal,
        };

        let result;
        try {
          result = await this.llm.generateJSON<GeneratedPaperOutput>(request);
        } finally {
          clearTimeout(timeoutId);
        }
        const latencyMs = Date.now() - startTime;

        // Extract sections from LLM response
        const sections = result.data.sections || [];

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
   * Dynamic section labeling for non-college papers.
   * Preserved from original ai.service.ts logic.
   */
  private postProcessSectionLabels(paper: GeneratedPaperOutput, assignment: IAssignment): GeneratedPaperOutput {
    if (isCollegeLevel(assignment)) return paper;

    const sections = paper.sections;
    if (!sections || sections.length === 0) return paper;

    const hasObjective = sections.some((s) =>
      s.questions.some((q) =>
        ["MCQ", "True/False", "Fill in the Blanks"].includes(q.questionType)
      )
    );
    const hasShort = sections.some((s) =>
      s.questions.some((q) => q.questionType === "Short Answer")
    );
    const hasLong = sections.some((s) =>
      s.questions.some((q) => q.questionType === "Long Answer")
    );

    const objectiveLabel = "A";
    const shortLabel = hasObjective ? "B" : "A";
    let longLabel = "A";
    if (hasObjective && hasShort) longLabel = "C";
    else if (hasObjective || hasShort) longLabel = "B";

    for (const section of sections) {
      const firstQType = section.questions[0]?.questionType;
      if (firstQType && ["MCQ", "True/False", "Fill in the Blanks"].includes(firstQType)) {
        section.sectionLabel = objectiveLabel;
      } else if (firstQType === "Short Answer") {
        section.sectionLabel = shortLabel;
      } else if (firstQType === "Long Answer") {
        section.sectionLabel = longLabel;
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
