/**
 * Typed error classes for the AI generation pipeline.
 * Each error carries contextual data for logging and observability.
 */

/** All models at or above the required tier failed. Worker should NOT retry with weaker models. */
export class CapabilityExhaustedError extends Error {
  constructor(
    public readonly minimumTier: number,
    public readonly attemptedModels: string[],
    public readonly errors: { model: string; error: string }[]
  ) {
    super(
      `All eligible models (Tier ${minimumTier}+) failed. Attempted: ${attemptedModels.join(", ")}`
    );
    this.name = "CapabilityExhaustedError";
  }
}

/** A specific chunk failed after all retries within the orchestrator. */
export class ChunkGenerationError extends Error {
  constructor(
    public readonly chunkId: string,
    public readonly attemptsMade: number,
    public readonly lastError: string
  ) {
    super(
      `Chunk "${chunkId}" failed after ${attemptsMade} attempts: ${lastError}`
    );
    this.name = "ChunkGenerationError";
  }
}

/** AbortSignal fired — teacher regenerated or cancelled. */
export class GenerationCancelledError extends Error {
  constructor(
    public readonly assignmentId: string,
    public readonly completedChunks: number
  ) {
    super(
      `Generation cancelled for assignment ${assignmentId} after ${completedChunks} chunks`
    );
    this.name = "GenerationCancelledError";
  }
}

/** Newer generation run exists — this run's results should be discarded. */
export class StaleGenerationError extends Error {
  constructor(
    public readonly assignmentId: string,
    public readonly runId: string
  ) {
    super(
      `Stale generation run ${runId} for assignment ${assignmentId} — newer run exists`
    );
    this.name = "StaleGenerationError";
  }
}

/** Another worker is actively running generation for this assignment. */
export class ConcurrentRunError extends Error {
  constructor(
    public readonly assignmentId: string,
    public readonly existingRunId: string
  ) {
    super(
      `Concurrent generation detected for assignment ${assignmentId} — run ${existingRunId} is active`
    );
    this.name = "ConcurrentRunError";
  }
}

/** Distributed lock was lost during generation (another worker stole it or it expired). */
export class LockLostError extends Error {
  constructor(
    public readonly assignmentId: string,
    public readonly runId: string
  ) {
    super(
      `Lock lost for assignment ${assignmentId} during run ${runId} — aborting`
    );
    this.name = "LockLostError";
  }
}

/** All providers hit their daily free-tier quota. */
export class QuotaExhaustedError extends Error {
  constructor(
    public readonly providers: string[]
  ) {
    super(
      `Daily quota exhausted for all providers: ${providers.join(", ")}`
    );
    this.name = "QuotaExhaustedError";
  }
}
