import type { IAssignment } from "../../../models/index.js";
import { extractGradeNumber, isCollegeLevel } from "../prompts/prompt.utils.js";

/**
 * Chunk planner: splits large workloads into smaller generation units.
 * Each chunk is an independent LLM call that produces a portion of the paper.
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
  isMockPaper: boolean;
}

// ── Planner ──

/**
 * Builds a chunk plan based on the assignment type and size.
 * 
 * Non-mock papers: single chunk (the whole paper).
 * Mock papers: split by subject × section for complex multi-subject patterns.
 */
export function buildChunkPlan(assignment: IAssignment): ChunkPlan {
  // Currently, all school and college papers are built as a single chunk.
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
    isMockPaper: false,
  };
}

// ── Helpers ──

function isMockPaper(assignment: IAssignment): boolean {
  const title = (assignment.title || "").toLowerCase();
  const subject = (assignment.subject || "").toLowerCase();
  const instructions = (assignment.additionalInstructions || "").toLowerCase();

  return (
    title.includes("mock") ||
    subject.includes("mock") ||
    instructions.includes("mock paper") ||
    instructions.includes("full test") ||
    assignment.numberOfQuestions >= 50  // heuristic: 50+ questions implies mock
  );
}
