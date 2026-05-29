import type { IAssignment } from "../../../models/index.js";
import type { ChunkContext } from "./prompt.strategy.js";

/**
 * Shared prompt building blocks used across all strategies.
 * Extracted from the original monolithic buildPrompt() in ai.service.ts.
 */

/**
 * Core specifications block: subject, grade, title, question count, marks, duration.
 */
export function buildSpecsBlock(assignment: IAssignment): string {
  return `SPECIFICATIONS:
- Subject: ${assignment.subject}
- Grade/Level: ${assignment.grade}
- Title: ${assignment.title}
- Total Number of Questions: ${assignment.numberOfQuestions}
- Total Marks: ${assignment.totalMarks}
- Duration: ${assignment.duration}`;
}

/**
 * Question type and count details block.
 * If questionTypeDetails exists, generates per-type instructions.
 * Otherwise falls back to simple list.
 */
export function buildQuestionTypeBlock(assignment: IAssignment): string {
  if (assignment.questionTypeDetails && assignment.questionTypeDetails.length > 0) {
    let block = `QUESTION TYPE BREAKDOWN:\n`;
    for (const detail of assignment.questionTypeDetails) {
      block += `  • ${detail.type}: Generate exactly ${detail.numberOfQuestions} questions, each carrying exactly ${detail.marks} marks. (Section Total: ${detail.numberOfQuestions * detail.marks} marks)\n`;
    }
    return block;
  }

  return `QUESTION TYPES: ${assignment.questionTypes.join(", ")}`;
}

/**
 * Difficulty distribution rules for Short Answer and Long Answer sections.
 */
export function buildDifficultyRules(assignment: IAssignment): string {
  if (!assignment.questionTypeDetails || assignment.questionTypeDetails.length === 0) {
    return "";
  }

  let rules = `DIFFICULTY DISTRIBUTION RULES:\n`;
  let hasRules = false;

  for (const detail of assignment.questionTypeDetails) {
    const type = detail.type;
    const count = detail.numberOfQuestions;

    if (type === "Short Answer Questions") {
      hasRules = true;
      rules += `- Short Answer Questions (${count} questions):\n`;
      if (count === 1) {
        rules += `  Must be "Moderate" difficulty.\n`;
      } else if (count === 2) {
        rules += `  1 "Easy" + 1 "Moderate". No "Hard".\n`;
      } else if (count === 3) {
        rules += `  1 "Easy" + 1 "Moderate" + 1 "Hard".\n`;
      } else {
        rules += `  At least 1 "Hard". Rest: balanced mix of "Easy" and "Moderate".\n`;
      }
    } else if (type === "Long Answer Questions") {
      hasRules = true;
      rules += `- Long Answer Questions (${count} questions):\n`;
      if (count === 1) {
        rules += `  Must be "Moderate" difficulty.\n`;
      } else if (count === 2) {
        rules += `  1 "Moderate" + 1 "Hard". No "Easy".\n`;
      } else if (count === 3) {
        rules += `  1 "Easy" + 1 "Moderate" + 1 "Hard".\n`;
      } else {
        rules += `  At least 1 "Easy". Rest: balanced mix of "Moderate" and "Hard".\n`;
      }
    }
  }

  return hasRules ? rules : "";
}

/**
 * Injected reference material from uploaded files.
 */
export function buildFileContentBlock(assignment: IAssignment): string {
  if (!assignment.fileContent) return "";
  return `
REFERENCE MATERIAL (use this as the primary knowledge base for generating questions):
---
${assignment.fileContent.substring(0, 15000)}
---`;
}

export function buildAnswerKeyRules(chunkContext?: ChunkContext): string {
  if (chunkContext) {
    const qType = chunkContext.questionType.toLowerCase();
    const needsAnswerKey = qType.includes("multiple choice") || qType.includes("mcq") || qType.includes("short answer");

    if (needsAnswerKey) {
      if (qType.includes("multiple choice") || qType.includes("mcq")) {
        return `ANSWER KEY RULES:
For every MCQ question, provide a \`correctAnswer\` field with the correct option text and label (e.g., "(a) covalent bond").`;
      }
      return `ANSWER KEY RULES:
For every Short Answer question, provide a \`correctAnswer\` field with brief key phrases. Keep it extremely concise.`;
    }

    // Long Answer, Numerical, Diagram, etc. — no answer key
    return `ANSWER KEY RULES:
Do NOT generate any answer keys for this section. Omit the \`correctAnswer\` field entirely from every question object.`;
  }

  // Global fallback (single-chunk, no context): answer keys only for MCQ and Short Answer
  return `ANSWER KEY RULES:
Answer keys are required ONLY for Multiple Choice Questions and Short Answer Questions.
- MCQ: The correct option text with label (e.g., "(a) covalent bond").
- Short Answer: Brief key phrases.
- For ALL other question types (Long Answer, Numerical, Diagram, etc.): Omit the \`correctAnswer\` field entirely.`;
}


/**
 * Standard school paper structure rules.
 */
export function buildSchoolStructureRules(): string {
  return `PAPER STRUCTURE RULES:
1. Divide the paper into sections (A, B, C, etc.) grouped by question type.
2. Each section MUST have a clear instruction (e.g., "Attempt all questions", "Choose any 3").`;
}

/**
 * JSON output format compliance instructions.
 */
export function buildOutputSchemaRules(chunkContext?: ChunkContext): string {
  let answerKeyRule = `- Answer keys (correctAnswer) are ONLY permitted for MCQs and Short Answers.
- For Long Answer, Numerical, and Diagram questions, generate the question ONLY.`;

  if (chunkContext) {
    const qType = chunkContext.questionType.toLowerCase();
    const needsAnswerKey = qType.includes("multiple choice") || qType.includes("mcq") || qType.includes("short answer");
    if (!needsAnswerKey) {
      answerKeyRule = `- Generate the question ONLY. Do not include any answer key fields.`;
    } else {
      answerKeyRule = `- Answer keys (correctAnswer) MUST be provided.`;
    }
  }

  return `OUTPUT RULES (STRICT MODE):
- Respond ONLY with valid JSON matching the schema.
- NEVER include "explanation", "rationale", "feedback", or step-by-step reasoning.
${answerKeyRule}
- Marks across all questions MUST sum to totalMarks.`;
}

/**
 * Universal anti-pattern guardrails to prevent generic AI-sounding output.
 */
export function buildAntiPatternRules(): string {
  return `CONSTRAINTS:
- ≤20% MCQs start "Which of the following"
- correct answer length ≈ distractor length
- distribute correct across a/b/c/d evenly
- distractors = plausible wrong reasoning paths
- no AI phrases ("Let's explore", "It's important to note")
- no trivially eliminable distractors
- questions must read as human-written`;
}

/**
 * Concept avoidance instruction for chunked generation.
 * Injects the ConceptLedger's avoidance list into the prompt.
 */
export function buildConceptAvoidanceBlock(avoidanceList: string[]): string {
  if (avoidanceList.length === 0) return "";
  return `
CONCEPT AVOIDANCE (CRITICAL):
The following topics/concepts have already been covered in previously generated sections.
Do NOT repeat these concepts. Generate questions covering DIFFERENT topics from the syllabus.
Already covered: ${avoidanceList.join(", ")}`;
}

/**
 * Additional instructions from teacher, if present.
 */
export function buildAdditionalInstructionsBlock(assignment: IAssignment): string {
  if (!assignment.additionalInstructions) return "";
  return `ADDITIONAL INSTRUCTIONS FROM TEACHER: ${assignment.additionalInstructions}`;
}


/**
 * Extract numeric grade from grade string (e.g., "Grade 10" → 10).
 */
export function extractGradeNumber(assignment: IAssignment): number | null {
  const match = assignment.grade?.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
