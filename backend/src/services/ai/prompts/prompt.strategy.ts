import type { IAssignment } from "../../../models/index.js";
import { ModelTier } from "../models/model-registry.js";

/**
 * Context passed to strategy's buildSystemPrompt when generating a chunk
 * of a larger paper (e.g., one question type section of a multi-section paper).
 */
export interface ChunkContext {
  chunkId: string;
  subject: string;
  sectionLabel: string;
  questionCount: number;
  questionType: string;
  marksPerQuestion: number;
  negativeMarking: number;
  attemptRule: string;
  /** Concepts already covered in prior chunks — avoid repeating */
  avoidanceConcepts: string[];
}

/**
 * Interface that every exam-specific prompt strategy must implement.
 */
export interface PromptStrategy {
  /** Unique identifier for this strategy (e.g., "school-v3") */
  readonly strategyId: string;
  /** Semantic version of this prompt (for metadata tracking) */
  readonly promptVersion: string;

  /**
   * Build the full system prompt for generation.
   * @param assignment - The assignment document
   * @param chunkContext - Optional context when generating a chunk of a larger paper
   */
  buildSystemPrompt(assignment: IAssignment, chunkContext?: ChunkContext): string;

  /** Temperature for this exam type */
  getTemperature(): number;

  /** The ideal model tier for this strategy's cognitive requirements */
  getPreferredTier(): ModelTier;

  /** The lowest acceptable emergency fallback tier */
  getFallbackTier(): ModelTier;

  /** Preferred model ID to try first (null = let orchestrator decide) */
  getPreferredModel(): string | null;

  /** Maximum output tokens to request from the provider */
  getMaxOutputTokens(): number;

  /** Returns per-component token estimates for profiling */
  getPromptProfile(assignment: IAssignment, chunkContext?: ChunkContext): Record<string, number>;

  /** Estimate completion tokens based on question count and types */
  estimateCompletionTokens(assignment: IAssignment, chunkContext?: ChunkContext): number;
}

import { SchoolPromptStrategy } from "./school.prompt.js";
const schoolStrategy = new SchoolPromptStrategy();

/**
 * Resolves the correct prompt strategy based on the assignment's grade and subject.
 * College-level is detected from the grade field (semester/year).
 * Everything else is school.
 */
export async function resolveStrategy(assignment: IAssignment): Promise<PromptStrategy> {
  const grade = (assignment.grade || "").toLowerCase();

  return schoolStrategy;
}
