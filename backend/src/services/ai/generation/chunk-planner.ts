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

function buildSingleChunkPlan(assignment: IAssignment): ChunkPlan {
  const qType = assignment.questionTypes?.[0] || "MCQ";
  const marks = assignment.totalMarks / assignment.numberOfQuestions;

  return {
    chunks: [
      {
        chunkId: "single-0",
        subject: assignment.subject,
        sectionLabel: "Full Paper",
        questionCount: assignment.numberOfQuestions,
        questionType: qType,
        marksPerQuestion: Math.round(marks),
        negativeMarking: 0,
        attemptRule: "Attempt all questions",
      },
    ],
    executionMode: "sequential",
    delayBetweenChunksMs: 0,
    totalExpectedQuestions: assignment.numberOfQuestions,
  };
}

function buildMultiTypePlan(
  assignment: IAssignment,
  details: NonNullable<IAssignment["questionTypeDetails"]>,
): ChunkPlan {
  const sectionLabels = "ABCDEFGHIJ".split("");
  const chunks: ChunkDefinition[] = details.map((d, i) => ({
    chunkId: `type-${i}`,
    subject: assignment.subject,
    sectionLabel: sectionLabels[i] || `Section ${i + 1}`,
    questionCount: d.numberOfQuestions,
    questionType: d.type,
    marksPerQuestion: d.marks,
    negativeMarking: 0,
    attemptRule: "Attempt all questions",
  }));

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
