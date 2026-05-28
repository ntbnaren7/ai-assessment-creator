import type { IAssignment } from "../../../models/index.js";
import { ModelTier } from "../models/model-registry.js";

/**
 * Context passed to strategy's buildSystemPrompt when generating a chunk
 * of a larger paper (e.g., one subject of a NEET mock).
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
  /** Unique identifier for this strategy (e.g., "jee-advanced-v1") */
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

  /** Minimum model tier required — orchestrator will hard-reject below this */
  getMinimumTier(): ModelTier;

  /** Preferred model ID to try first (null = let orchestrator decide) */
  getPreferredModel(): string | null;

  /** Maximum output tokens to request from the provider */
  getMaxOutputTokens(): number;
}

import { SchoolPromptStrategy } from "./school.prompt.js";
import { CollegePromptStrategy } from "./college.prompt.js";
import { NeetPromptStrategy } from "./neet.prompt.js";
import { JeeMainPromptStrategy } from "./jee-main.prompt.js";
import { JeeAdvancedPromptStrategy } from "./jee-advanced.prompt.js";

// ── Strategy Resolver ──

const schoolStrategy = new SchoolPromptStrategy();
const collegeStrategy = new CollegePromptStrategy();
const neetStrategy = new NeetPromptStrategy();
const jeeMainStrategy = new JeeMainPromptStrategy();
const jeeAdvancedStrategy = new JeeAdvancedPromptStrategy();

/**
 * Resolves the correct prompt strategy based on the assignment's grade and subject.
 * Competitive exams are detected from the subject field.
 * College-level is detected from the grade field (semester/year).
 * Everything else is school.
 */
export async function resolveStrategy(assignment: IAssignment): Promise<PromptStrategy> {
  const subject = (assignment.subject || "").toLowerCase();
  const grade = (assignment.grade || "").toLowerCase();

  // ── Competitive exam detection ──
  if (subject.includes("jee advanced") || subject.includes("jee-advanced")) {
    return jeeAdvancedStrategy;
  }
  if (subject.includes("jee main") || subject.includes("jee-main") || subject.includes("jee mains")) {
    return jeeMainStrategy;
  }
  if (subject.includes("neet")) {
    return neetStrategy;
  }

  // ── College detection ──
  if (grade.includes("semester") || grade.includes("year")) {
    return collegeStrategy;
  }

  // ── Default: School ──
  return schoolStrategy;
}
