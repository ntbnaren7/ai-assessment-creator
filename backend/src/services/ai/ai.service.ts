import { config } from "../../config/index.js";
import type { IAssignment } from "../../models/index.js";
import { GeneratedPaperSchema, type GeneratedPaperOutput } from "../../utils/validation.js";
import { LLMOrchestrator } from "./llm.orchestrator.js";
import { GroqProvider } from "./providers/groq.provider.js";
import { OpenRouterProvider } from "./providers/openrouter.provider.js";
import { CohereProvider } from "./providers/cohere.provider.js";
import type { LLMRequest } from "./types.js";
import { zodToJsonSchema } from "zod-to-json-schema";

// Initialize providers with their respective API keys
const providers = [];

if (config.groqApiKey) {
  providers.push(new GroqProvider({ apiKey: config.groqApiKey }));
}
if (config.openRouterApiKey) {
  providers.push(new OpenRouterProvider({ apiKey: config.openRouterApiKey }));
}
if (config.cohereApiKey) {
  providers.push(new CohereProvider({ apiKey: config.cohereApiKey }));
}

const orchestrator = new LLMOrchestrator(providers);

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
`;

  if (assignment.questionTypeDetails && assignment.questionTypeDetails.length > 0) {
    prompt += `- Question Types & Counts:\n`;
    for (const detail of assignment.questionTypeDetails) {
      prompt += `  * ${detail.type}: Generate exactly ${detail.numberOfQuestions} questions, each carrying exactly ${detail.marks} marks. (Total Section Marks: ${detail.numberOfQuestions * detail.marks})\n`;
    }
    
    prompt += `\nDIFFICULTY DISTRIBUTION RULES FOR SECTIONS:\n`;
    for (const detail of assignment.questionTypeDetails) {
      const type = detail.type;
      const count = detail.numberOfQuestions;
      if (type === "Short Answer") {
        prompt += `- For "Short Answer" section (generating ${count} questions):\n`;
        if (count === 1) {
          prompt += `  * The question MUST have "Moderate" difficulty.\n`;
        } else if (count === 2) {
          prompt += `  * Generate exactly 1 "Easy" and 1 "Moderate" question. Avoid "Hard" difficulty.\n`;
        } else if (count === 3) {
          prompt += `  * Generate exactly 1 "Easy", 1 "Moderate", and 1 "Hard" question (1 of each difficulty).\n`;
        } else {
          prompt += `  * At least 1 question MUST have "Hard" difficulty, and the rest should be a balanced mix of "Easy" and "Moderate" difficulties.\n`;
        }
      } else if (type === "Long Answer") {
        prompt += `- For "Long Answer" section (generating ${count} questions):\n`;
        if (count === 1) {
          prompt += `  * The question MUST have "Moderate" difficulty.\n`;
        } else if (count === 2) {
          prompt += `  * Generate exactly 1 "Moderate" and 1 "Hard" question. Avoid "Easy" difficulty.\n`;
        } else if (count === 3) {
          prompt += `  * Generate exactly 1 "Easy", 1 "Moderate", and 1 "Hard" question (1 of each difficulty).\n`;
        } else {
          prompt += `  * At least 1 question MUST have "Easy" difficulty, and the rest should be a balanced mix of "Moderate" and "Hard" difficulties.\n`;
        }
      }
    }
    prompt += "\n";
  } else {
    prompt += `- Question Types Required: ${questionTypesList}\n`;
  }

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
8. For EVERY question (including MCQ, Short Answer, Long Answer, True/False, Fill in the Blanks), you MUST provide a non-empty \`correctAnswer\` field.
   - For MCQ: Provide the correct option text or label (e.g., "(a) covalent bond").
   - For True/False: Provide "True" or "False".
   - For Fill in the Blanks: Provide the correct blank value.
   - For Short Answer & Long Answer: The \`correctAnswer\` MUST consist of exactly X distinct key points or sentences, where X is the number of marks allotted to that question (e.g., if the question is worth 3 marks, provide exactly 3 sentences or key points). Format them clearly (e.g. as numbered points "1. ... \n2. ...").`;

  return prompt;
}

/**
 * Calls the AI Layer with a structured prompt, parses and validates
 * the JSON response against the GeneratedPaperSchema (Layer 4 validation).
 */
export async function generateQuestionPaper(
  assignment: IAssignment
): Promise<GeneratedPaperOutput> {
  const systemPrompt = buildPrompt(assignment);
  
  // We use zod-to-json-schema to get the expected JSON schema to feed into the prompt
  const expectedSchema = zodToJsonSchema(GeneratedPaperSchema, "GeneratedPaper");

  const request: LLMRequest = {
    systemPrompt: systemPrompt,
    userPrompt: "Generate the assessment JSON now.",
    expectedSchema: expectedSchema,
    temperature: 0.7,
  };

  // Generate structured JSON using the orchestrator fallback chain
  const result = await orchestrator.generateJSON<GeneratedPaperOutput>(request);

  // Validate the parsed output against our Zod schema
  const validation = GeneratedPaperSchema.safeParse(result.data);

  if (!validation.success) {
    const issues = validation.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`AI output validation failed: ${issues}`);
  }

  const paper = validation.data;

  // Dynamic Section Labeling Post-Processing
  const sections = paper.sections;
  if (sections && sections.length > 0) {
    const hasObjective = sections.some((s) =>
      s.questions.some((q) =>
        ["MCQ", "True/False", "Fill in the Blanks"].includes(q.questionType)
      )
    );
    const hasShort = sections.some((s) =>
      s.questions.some((q) => q.questionType === "Short Answer")
    );
    const hasLong = sections.some((s) =>
      s.questions.some((q) => q.questionType === "Long Answer")
    );

    const objectiveLabel = "A";
    const shortLabel = hasObjective ? "B" : "A";

    let longLabel = "A";
    if (hasObjective && hasShort) {
      longLabel = "C";
    } else if (hasObjective || hasShort) {
      longLabel = "B";
    } else {
      longLabel = "A";
    }

    for (const section of sections) {
      const firstQType = section.questions[0]?.questionType;
      if (
        firstQType &&
        ["MCQ", "True/False", "Fill in the Blanks"].includes(firstQType)
      ) {
        section.sectionLabel = objectiveLabel;
      } else if (firstQType === "Short Answer") {
        section.sectionLabel = shortLabel;
      } else if (firstQType === "Long Answer") {
        section.sectionLabel = longLabel;
      }
    }
  }

  return paper;
}
