import { GoogleGenAI } from "@google/genai";
import { config } from "../config/index.js";
import type { IAssignment } from "../models/index.js";
import {
  GeneratedPaperSchema,
  type GeneratedPaperOutput,
} from "../utils/validation.js";

const genai = new GoogleGenAI({ apiKey: config.geminiApiKey });

/**
 * Builds a highly structured prompt from assignment parameters.
 */
function buildPrompt(assignment: IAssignment): string {
  const questionTypesList = assignment.questionTypes.join(", ");

  let prompt = `You are an expert academic examination paper creator. Generate a structured question paper based on the following specifications.

SPECIFICATIONS:
- Subject: ${assignment.subject}
- Grade/Level: ${assignment.grade}
- Title: ${assignment.title}
- Total Number of Questions: ${assignment.numberOfQuestions}
- Total Marks: ${assignment.totalMarks}
- Duration: ${assignment.duration}
- Question Types Required: ${questionTypesList}
`;

  if (assignment.additionalInstructions) {
    prompt += `- Additional Instructions from Teacher: ${assignment.additionalInstructions}\n`;
  }

  if (assignment.fileContent) {
    prompt += `
REFERENCE MATERIAL (use this as the knowledge base for generating questions):
---
${assignment.fileContent.substring(0, 15000)}
---
`;
  }

  prompt += `
RULES:
1. Divide the paper into sections (A, B, C, etc.) grouped by question type or difficulty.
2. Each section MUST have a clear instruction (e.g., "Attempt all questions", "Choose any 3").
3. Assign difficulty levels: "Easy", "Moderate", or "Hard" to each question.
4. Distribute marks logically so they sum to exactly ${assignment.totalMarks}.
5. For MCQ questions, provide exactly 4 options labeled (a), (b), (c), (d).
6. Ensure questions are pedagogically sound, clear, and unambiguous.
7. Cover a broad range of topics within the subject.

RESPOND WITH ONLY VALID JSON in the following exact structure (no markdown, no code fences):
{
  "title": "string - the paper title",
  "subject": "${assignment.subject}",
  "totalMarks": ${assignment.totalMarks},
  "duration": "${assignment.duration}",
  "generalInstructions": ["array of 3-5 general instructions for students"],
  "sections": [
    {
      "sectionLabel": "A",
      "sectionTitle": "Section A",
      "instruction": "string - section instruction",
      "questions": [
        {
          "questionNumber": 1,
          "questionText": "string - the question",
          "difficulty": "Easy | Moderate | Hard",
          "marks": number,
          "questionType": "MCQ | Short Answer | Long Answer | True/False | Fill in the Blanks",
          "options": ["only for MCQ - array of 4 options"] 
        }
      ]
    }
  ]
}`;

  return prompt;
}

/**
 * Parses raw Gemini response text into a JSON object.
 * Handles both clean JSON mode responses and markdown-fenced fallbacks.
 */
function parseGeminiResponse(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text);
  } catch {
    // Fallback: attempt to extract JSON from potential markdown fences
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch?.[1]) {
      return JSON.parse(jsonMatch[1].trim());
    }
    throw new Error("Failed to parse Gemini response as JSON");
  }
}

/**
 * Calls the Gemini API with a structured prompt, parses and validates
 * the JSON response against the GeneratedPaperSchema (Layer 4 validation).
 */
export async function generateQuestionPaper(
  assignment: IAssignment
): Promise<GeneratedPaperOutput> {
  const prompt = buildPrompt(assignment);

  const response = await genai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.7,
      maxOutputTokens: 8192,
    },
  });

  const text = response.text;

  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  // Stage 3: Parse raw JSON
  const parsed = parseGeminiResponse(text);

  // Stage 4: Validate against GeneratedPaperSchema (Layer 4)
  const result = GeneratedPaperSchema.safeParse(parsed);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`AI output validation failed: ${issues}`);
  }

  return result.data;
}

