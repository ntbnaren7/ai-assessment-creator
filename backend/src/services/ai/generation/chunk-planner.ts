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
 * Mock papers: split by subject × section for NEET/JEE patterns.
 */
export function buildChunkPlan(assignment: IAssignment): ChunkPlan {
  const subject = (assignment.subject || "").toLowerCase();

  // ── NEET Mock ──
  if (subject.includes("neet") && isMockPaper(assignment)) {
    return buildNeetMockPlan(assignment);
  }

  // ── JEE Main Mock ──
  if ((subject.includes("jee main") || subject.includes("jee-main") || subject.includes("jee mains")) 
       && isMockPaper(assignment)) {
    return buildJeeMainMockPlan(assignment);
  }

  // ── JEE Advanced Mock ──
  if ((subject.includes("jee advanced") || subject.includes("jee-advanced")) 
       && isMockPaper(assignment)) {
    return buildJeeAdvancedMockPlan(assignment);
  }

  // ── Non-mock: single chunk ──
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

function buildNeetMockPlan(_assignment: IAssignment): ChunkPlan {
  // NEET: 180 questions = 45 Physics + 45 Chemistry + 90 Biology (45 Botany + 45 Zoology)
  // Each subject: Section A (35 MCQ, attempt all) + Section B (15 MCQ, attempt 10)
  const subjects = [
    { name: "Physics", short: "PHY" },
    { name: "Chemistry", short: "CHE" },
    { name: "Botany", short: "BOT" },
    { name: "Zoology", short: "ZOO" },
  ];

  const chunks: ChunkDefinition[] = [];

  for (const subj of subjects) {
    // Section A: 35 questions, attempt all
    chunks.push({
      chunkId: `neet-${subj.short}-A`,
      subject: subj.name,
      sectionLabel: `${subj.name} - Section A`,
      questionCount: 35,
      questionType: "MCQ",
      marksPerQuestion: 4,
      negativeMarking: -1,
      attemptRule: "Attempt all 35 questions",
    });

    // Section B: 15 questions, attempt any 10
    chunks.push({
      chunkId: `neet-${subj.short}-B`,
      subject: subj.name,
      sectionLabel: `${subj.name} - Section B`,
      questionCount: 15,
      questionType: "MCQ",
      marksPerQuestion: 4,
      negativeMarking: -1,
      attemptRule: "Attempt any 10 out of 15 questions",
    });
  }

  return {
    chunks,
    executionMode: "sequential",
    delayBetweenChunksMs: 2500,
    totalExpectedQuestions: 200,  // 4 subjects × 50 = 200 (students attempt 180)
    isMockPaper: true,
  };
}

function buildJeeMainMockPlan(_assignment: IAssignment): ChunkPlan {
  // JEE Main: 75 questions = 25 per subject (Physics, Chemistry, Maths)
  // Each subject: Section A (20 MCQ) + Section B (5 Numerical, attempt all)
  const subjects = ["Physics", "Chemistry", "Mathematics"];
  const chunks: ChunkDefinition[] = [];

  for (const subj of subjects) {
    chunks.push({
      chunkId: `jee-main-${subj.substring(0, 3).toUpperCase()}-A`,
      subject: subj,
      sectionLabel: `${subj} - Section A`,
      questionCount: 20,
      questionType: "MCQ",
      marksPerQuestion: 4,
      negativeMarking: -1,
      attemptRule: "Attempt all 20 questions",
    });

    chunks.push({
      chunkId: `jee-main-${subj.substring(0, 3).toUpperCase()}-B`,
      subject: subj,
      sectionLabel: `${subj} - Section B`,
      questionCount: 5,
      questionType: "Numerical Answer",
      marksPerQuestion: 4,
      negativeMarking: 0,
      attemptRule: "Attempt all 5 questions",
    });
  }

  return {
    chunks,
    executionMode: "sequential",
    delayBetweenChunksMs: 2500,
    totalExpectedQuestions: 75,
    isMockPaper: true,
  };
}

function buildJeeAdvancedMockPlan(_assignment: IAssignment): ChunkPlan {
  // JEE Advanced: Paper 1 + Paper 2, each with 3 subjects
  const subjects = ["Physics", "Chemistry", "Mathematics"];
  const chunks: ChunkDefinition[] = [];

  for (const paper of ["Paper 1", "Paper 2"]) {
    for (const subj of subjects) {
      const paperId = paper.replace(" ", "");
      chunks.push({
        chunkId: `jee-adv-${paperId}-${subj.substring(0, 3).toUpperCase()}`,
        subject: subj,
        sectionLabel: `${paper} - ${subj}`,
        questionCount: 9,
        questionType: "Mixed (Single/Multiple Correct MCQ + Numerical)",
        marksPerQuestion: 4,
        negativeMarking: -1,
        attemptRule: "Attempt all questions",
      });
    }
  }

  return {
    chunks,
    executionMode: "sequential",
    delayBetweenChunksMs: 3000,
    totalExpectedQuestions: 54,
    isMockPaper: true,
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
