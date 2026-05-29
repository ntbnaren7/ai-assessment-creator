import { IAssignment } from "../../../models/index.js";
import { GeneratedPaperOutput } from "../../../utils/validation.js";
import { logger } from "../../../utils/logger.js";

export class GenerationIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationIntegrityError";
  }
}

/**
 * Validates the generated paper structure against the original assignment constraints.
 * Fails fast if the LLM hallucinated the wrong number of questions or marks,
 * preventing corrupted partial data from being saved.
 */

export function validateChunkIntegrity(chunk: any, sectionData: any): void {
  const generatedTotalQuestions = sectionData.sections?.reduce((acc: number, s: any) => acc + (s.questions?.length || 0), 0) || 0;
  let generatedTotalMarks = 0;
  for (const s of sectionData.sections || []) {
    for (const q of s.questions || []) {
      generatedTotalMarks += q.marks;
    }
  }

  const requestedQuestions = chunk.questionCount;
  const requestedMarks = chunk.questionCount * chunk.marksPerQuestion;

  if (generatedTotalQuestions !== requestedQuestions) {
    throw new GenerationIntegrityError(`Chunk integrity failure: Requested ${requestedQuestions} questions, Generated ${generatedTotalQuestions}`);
  }

  if (generatedTotalMarks !== requestedMarks) {
    throw new GenerationIntegrityError(`Chunk integrity failure: Requested ${requestedMarks} marks, Generated ${generatedTotalMarks}`);
  }
}

export function validatePaperIntegrity(assignment: IAssignment, paper: GeneratedPaperOutput): void {
  let generatedTotalQuestions = 0;
  let generatedTotalMarks = 0;

  for (const section of paper.sections) {
    generatedTotalQuestions += section.questions.length;
    for (const q of section.questions) {
      generatedTotalMarks += q.marks;
    }
  }

  // ── 1. Validate Total Counts ──
  if (generatedTotalQuestions !== assignment.numberOfQuestions) {
    throw new GenerationIntegrityError(`Question count mismatch. Requested: ${assignment.numberOfQuestions}, Generated: ${generatedTotalQuestions}`);
  }

  if (generatedTotalMarks !== assignment.totalMarks) {
    throw new GenerationIntegrityError(`Total marks mismatch. Requested: ${assignment.totalMarks}, Generated: ${generatedTotalMarks}`);
  }

  // ── 2. Validate Question Types (if specific details exist) ──
  if (assignment.questionTypeDetails && assignment.questionTypeDetails.length > 0) {
    const typeCounts: Record<string, number> = {};
    for (const section of paper.sections) {
      for (const q of section.questions) {
        typeCounts[q.questionType] = (typeCounts[q.questionType] || 0) + 1;
      }
    }

    for (const detail of assignment.questionTypeDetails) {
      const generatedCount = typeCounts[detail.type] || 0;
      if (generatedCount !== detail.numberOfQuestions) {
        throw new GenerationIntegrityError(`Type count mismatch for ${detail.type}. Requested: ${detail.numberOfQuestions}, Generated: ${generatedCount}`);
      }
    }
  }

  logger.info("Paper integrity validation passed", {
    stage: "INTEGRITY_VALIDATION",
    status: "PASS",
    questions: generatedTotalQuestions,
    marks: generatedTotalMarks
  });
}
