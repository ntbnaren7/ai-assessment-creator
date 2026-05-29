import type { IAssignment } from "../../../models/index.js";

/**
 * Chunk planner: splits generation workloads into smaller units.
 * Each chunk is an independent LLM call that produces a portion of the paper.
 *
 * When `questionTypeDetails` is available (the user defined multiple question
 * types in the form), each type becomes its own chunk so that:
 *   1. Each LLM call produces a smaller, more focused JSON response.
 *   2. Output token limits are far less likely to be hit.
 *   3. The aggregator re-numbers and merges sections automatically.
 *
 * When only a single question type is present, the paper is generated
 * as a single chunk (no overhead from merging).
 */

// ── Types ──

export interface ChunkDefinition {
  chunkId: string;
  subject: string;
  sectionLabel: string;
  questionCount: number;
  questionType: string;
  marksPerQuestion: number;
  negativeMarking: number;
  attemptRule: string;
}

export interface ChunkPlan {
  chunks: ChunkDefinition[];
  executionMode: "sequential" | "limited-parallel";
  delayBetweenChunksMs: number;
  totalExpectedQuestions: number;
}

// ── Planner ──

/**
 * Builds a chunk plan based on the assignment's question type details.
 *
 * Multiple question types → one chunk per type (section-by-section).
 * Single / missing details → single chunk (whole paper in one call).
 */
export function buildChunkPlan(assignment: IAssignment): ChunkPlan {
  const details = assignment.questionTypeDetails;

  // If we have granular per-type info with more than one type, split by type
  if (details && details.length > 1) {
    return buildMultiTypePlan(assignment, details);
  }

  // Fallback: single chunk
  return buildSingleChunkPlan(assignment);
}

// ── Plan Builders ──

const MAX_QUESTIONS_PER_CHUNK = 10;

function splitIntoSubChunks(
  baseDefinition: Omit<ChunkDefinition, "chunkId" | "questionCount">,
  totalQuestions: number,
  baseChunkId: string
): ChunkDefinition[] {
  const subChunks: ChunkDefinition[] = [];
  let remaining = totalQuestions;
  let partIdx = 1;

  while (remaining > 0) {
    const count = Math.min(remaining, MAX_QUESTIONS_PER_CHUNK);
    subChunks.push({
      ...baseDefinition,
      chunkId: `${baseChunkId}-part${partIdx}`,
      questionCount: count,
    });
    remaining -= count;
    partIdx++;
  }

  return subChunks;
}

function buildSingleChunkPlan(assignment: IAssignment): ChunkPlan {
  const qType = assignment.questionTypes?.[0] || "MCQ";
  const marks = assignment.totalMarks / assignment.numberOfQuestions;

  const baseDef = {
    subject: assignment.subject,
    sectionLabel: "Full Paper",
    questionType: qType,
    marksPerQuestion: Math.round(marks),
    negativeMarking: 0,
    attemptRule: "Attempt all questions",
  };

  const chunks = splitIntoSubChunks(baseDef, assignment.numberOfQuestions, "single");

  return {
    chunks,
    executionMode: "sequential",
    delayBetweenChunksMs: 500,
    totalExpectedQuestions: assignment.numberOfQuestions,
  };
}

function buildMultiTypePlan(
  assignment: IAssignment,
  details: NonNullable<IAssignment["questionTypeDetails"]>,
): ChunkPlan {
  const sectionLabels = "ABCDEFGHIJ".split("");
  const chunks: ChunkDefinition[] = [];

  details.forEach((d, i) => {
    const baseDef = {
      subject: assignment.subject,
      sectionLabel: sectionLabels[i] || `Section ${i + 1}`,
      questionType: d.type,
      marksPerQuestion: d.marks,
      negativeMarking: 0,
      attemptRule: "Attempt all questions",
    };

    chunks.push(...splitIntoSubChunks(baseDef, d.numberOfQuestions, `type-${i}`));
  });

  const totalExpectedQuestions = details.reduce(
    (sum, d) => sum + d.numberOfQuestions,
    0,
  );

  return {
    chunks,
    executionMode: "sequential",
    delayBetweenChunksMs: 500, // small delay to avoid rate-limits
    totalExpectedQuestions,
  };
}
