import type { IAssignment } from "../../../models/index.js";

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

    if (type === "Short Answer") {
      hasRules = true;
      rules += `- Short Answer (${count} questions):\n`;
      if (count === 1) {
        rules += `  Must be "Moderate" difficulty.\n`;
      } else if (count === 2) {
        rules += `  1 "Easy" + 1 "Moderate". No "Hard".\n`;
      } else if (count === 3) {
        rules += `  1 "Easy" + 1 "Moderate" + 1 "Hard".\n`;
      } else {
        rules += `  At least 1 "Hard". Rest: balanced mix of "Easy" and "Moderate".\n`;
      }
    } else if (type === "Long Answer") {
      hasRules = true;
      rules += `- Long Answer (${count} questions):\n`;
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

/**
 * Rules for how the correctAnswer field should be formatted.
 */
export function buildAnswerKeyRules(isCollege: boolean): string {
  return `ANSWER KEY RULES:
For EVERY question, you MUST provide a non-empty \`correctAnswer\` field:
- MCQ: The correct option text with label (e.g., "(a) covalent bond").
- True/False: "True" or "False".
- Fill in the Blanks: The correct value.
- Short Answer & Long Answer: ${isCollege
    ? `Unless it is a choice question, the`
    : `The`} \`correctAnswer\` MUST consist of exactly X distinct key points, where X = marks allotted. Format as numbered points "1. ...\\n2. ...".`;
}

/**
 * Rules for college-specific Part A/B/C structure with internal choice.
 */
export function buildCollegeStructureRules(): string {
  return `COLLEGE PAPER STRUCTURE RULES:
1. Organize into sections named "Part A", "Part B", and optionally "Part C".
2. Part B (and Part C) Long Answer questions MUST have internal either/or choice:
   A) [Question text for choice A]
   or
   B) [Question text for choice B]
3. Section instruction must be simple (e.g., "Answer all 10 questions.") — no marks calculation in instruction.
4. The correctAnswer for choice questions MUST cover BOTH choices labeled clearly.`;
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
export function buildOutputSchemaRules(): string {
  return `OUTPUT FORMAT:
You MUST respond with ONLY a valid JSON object matching this exact structure:
{
  "title": "string",
  "subject": "string",
  "totalMarks": number,
  "duration": "string",
  "generalInstructions": ["string"],
  "sections": [
    {
      "sectionLabel": "A",
      "sectionTitle": "string",
      "instruction": "string",
      "questions": [
        {
          "questionNumber": 1,
          "questionText": "string",
          "difficulty": "Easy" | "Moderate" | "Hard",
          "marks": number,
          "questionType": "string",
          "options": ["(a) ...", "(b) ...", "(c) ...", "(d) ..."],
          "correctAnswer": "string"
        }
      ]
    }
  ]
}

CRITICAL JSON RULES:
- Output ONLY the JSON. No markdown, no code fences, no explanation.
- All string values must be properly escaped.
- The "options" field is only for MCQ questions.
- Marks across all questions MUST sum to the specified totalMarks.`;
}

/**
 * Universal anti-pattern guardrails to prevent generic AI-sounding output.
 */
export function buildAntiPatternRules(): string {
  return `QUALITY GUARDRAILS (MANDATORY):
- Do NOT start questions with "Which of the following" for more than 20% of MCQs.
- Do NOT make the correct answer obviously longer than distractors.
- Do NOT cluster correct answers on the same option letter (distribute across a/b/c/d).
- Do NOT use AI-sounding phrases: "Let's explore", "It's important to note", "In this context".
- Do NOT create distractors that are trivially eliminable (e.g., absurd values, unrelated terms).
- Every distractor must represent a plausible wrong reasoning path.
- Questions must feel like they were written by a human examiner, not generated by AI.`;
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
 * Detect if assignment is college-level based on grade string.
 */
export function isCollegeLevel(assignment: IAssignment): boolean {
  if (!assignment.grade) return false;
  const grade = assignment.grade.toLowerCase();
  return grade.includes("semester") || grade.includes("year");
}

/**
 * Extract numeric grade from grade string (e.g., "Grade 10" → 10).
 * Returns null for college-level or unrecognized formats.
 */
export function extractGradeNumber(assignment: IAssignment): number | null {
  if (isCollegeLevel(assignment)) return null;
  const match = assignment.grade?.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
