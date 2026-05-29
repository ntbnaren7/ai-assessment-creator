import { z } from "zod";

export const QuestionTypeEnum = z.enum([
  "Multiple Choice Questions",
  "Short Answer Questions",
  "Long Answer Questions",
  "Diagram/Graph-Based Questions",
  "Numerical Problems",
  "Case Study Questions",
]);

export const QuestionTypeDetailSchema = z.object({
  id: z.string().optional(),
  type: QuestionTypeEnum,
  numberOfQuestions: z.number().int().min(1),
  marks: z.number().int().min(1),
});

export const CreateAssignmentSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters")
    .trim(),
  subject: z
    .string()
    .min(1, "Subject is required")
    .max(100, "Subject must be less than 100 characters")
    .trim(),
  grade: z
    .string()
    .min(1, "Grade is required")
    .trim()
    .refine((val) => {
      const num = parseInt(val, 10);
      return !isNaN(num) && num >= 1 && num <= 12;
    }, "Grade must be a number between 1 and 12"),
  dueDate: z
    .string()
    .min(1, "Due date is required")
    .refine((val) => !isNaN(Date.parse(val)), "Invalid date format"),
  questionTypes: z
    .array(QuestionTypeEnum)
    .min(1, "At least one question type is required"),
  numberOfQuestions: z
    .number()
    .int("Number of questions must be a whole number")
    .min(1, "At least 1 question is required")
    .max(50, "Maximum 50 questions allowed"),
  totalMarks: z
    .number()
    .int("Total marks must be a whole number")
    .min(1, "Total marks must be at least 1")
    .max(100, "Maximum 100 marks allowed"),
  duration: z
    .string()
    .min(1, "Duration is required")
    .max(50, "Duration must be less than 50 characters")
    .trim(),
  additionalInstructions: z
    .string()
    .max(2000, "Additional instructions must be less than 2000 characters")
    .trim()
    .optional()
    .default(""),
  questionTypeDetails: z
    .array(QuestionTypeDetailSchema)
    .optional(),
});

export type CreateAssignmentInput = z.infer<typeof CreateAssignmentSchema>;

/* ── Layer 4: Post-Generation Output Validation ── */

const DifficultyEnum = z.enum(["Easy", "Moderate", "Hard"]);

const BaseQuestionSchema = z.object({
  questionNumber: z.number().int().min(1),
  questionText: z.string().min(1, "Question text cannot be empty"),
  difficulty: DifficultyEnum,
  marks: z.number().int().min(1),
});

// ── School Schemas ──
const SchoolMCQSchema = BaseQuestionSchema.extend({
  questionType: z.literal("Multiple Choice Questions"),
  options: z.array(z.string()).length(4, "MCQs must have exactly 4 options"),
  correctAnswer: z.string().min(1),
}).strict();

const SchoolShortAnswerSchema = BaseQuestionSchema.extend({
  questionType: z.literal("Short Answer Questions"),
  correctAnswer: z.string().min(1, "Short Answer Questions require a concise correct answer"),
}).strict();

const SchoolLongAnswerSchema = BaseQuestionSchema.extend({
  questionType: z.literal("Long Answer Questions"),
}).strict();

const SchoolNumericalSchema = BaseQuestionSchema.extend({
  questionType: z.literal("Numerical Problems"),
}).strict();

const SchoolDiagramSchema = BaseQuestionSchema.extend({
  questionType: z.literal("Diagram/Graph-Based Questions"),
}).strict();

const SchoolCaseStudySchema = BaseQuestionSchema.extend({
  questionType: z.literal("Case Study Questions"),
}).strict();

export const SchoolGeneratedQuestionSchema = z.discriminatedUnion("questionType", [
  SchoolMCQSchema,
  SchoolShortAnswerSchema,
  SchoolLongAnswerSchema,
  SchoolNumericalSchema,
  SchoolDiagramSchema,
  SchoolCaseStudySchema,
]);

export const SchoolGeneratedSectionSchema = z
  .object({
    sectionLabel: z.string().min(1),
    sectionTitle: z.string().min(1),
    instruction: z.string().min(1),
    questions: z
      .array(SchoolGeneratedQuestionSchema)
      .min(1, "Each section must contain at least one question"),
  })
  .strict();

export const SchoolGeneratedPaperSchema = z
  .object({
    schemaVersion: z.literal("v1"),
    title: z.string().min(1),
    subject: z.string().min(1),
    totalMarks: z.number().int().min(1),
    duration: z.string().min(1),
    generalInstructions: z
      .array(z.string())
      .min(1, "At least one general instruction is required"),
    sections: z
      .array(SchoolGeneratedSectionSchema)
      .min(1, "At least one section is required"),
  })
  .strict();

// Default types for generic passing around
export type GeneratedPaperOutput = z.infer<typeof SchoolGeneratedPaperSchema>;

import { zodToJsonSchema } from "zod-to-json-schema";

const SchoolSchemaMap: Record<string, z.ZodTypeAny> = {
  "Multiple Choice Questions": SchoolMCQSchema,
  "Short Answer Questions": SchoolShortAnswerSchema,
  "Long Answer Questions": SchoolLongAnswerSchema,
  "Case Study Questions": SchoolCaseStudySchema,
  "Numerical Problems": SchoolNumericalSchema,
  "Diagram/Graph-Based Questions": SchoolDiagramSchema,
};

export function getDynamicPaperSchemaJSON(requestedTypes: string[]): any {
  const map = SchoolSchemaMap;
  
  // Get only the schemas requested, defaulting to all if none requested or found
  const activeSchemas = requestedTypes
    .map(t => map[t])
    .filter(Boolean) as z.ZodTypeAny[];

  if (activeSchemas.length === 0) {
    // Fallback to full schema if filtering fails
    return zodToJsonSchema(SchoolGeneratedPaperSchema, "GeneratedPaper");
  }

  const DynamicQuestionSchema = z.discriminatedUnion("questionType", activeSchemas as any);
  
  const DynamicSectionSchema = z.object({
    sectionLabel: z.string().min(1),
    sectionTitle: z.string().min(1),
    instruction: z.string().min(1),
    questions: z.array(DynamicQuestionSchema).min(1),
  }).strict();

  const DynamicPaperSchema = z.object({
    schemaVersion: z.literal("v1"),
    title: z.string().min(1),
    subject: z.string().min(1),
    totalMarks: z.number().int().min(1),
    duration: z.string().min(1),
    generalInstructions: z.array(z.string()).min(1),
    sections: z.array(DynamicSectionSchema).min(1),
  }).strict();

  return zodToJsonSchema(DynamicPaperSchema, "GeneratedPaper");
}

export function getDynamicChunkSchemaJSON(requestedTypes: string[]): any {
  const map = SchoolSchemaMap;
  
  const activeSchemas = requestedTypes
    .map(t => map[t])
    .filter(Boolean) as z.ZodTypeAny[];

  if (activeSchemas.length === 0) {
    // Fallback to full schema if filtering fails
    return zodToJsonSchema(
      z.object({ sections: z.array(SchoolGeneratedSectionSchema) }).strict(),
      "GeneratedChunk"
    );
  }

  const DynamicQuestionSchema = z.discriminatedUnion("questionType", activeSchemas as any);
  
  const DynamicSectionSchema = z.object({
    sectionLabel: z.string().min(1),
    sectionTitle: z.string().min(1),
    instruction: z.string().min(1),
    questions: z.array(DynamicQuestionSchema).min(1),
  }).strict();

  const DynamicChunkSchema = z.object({
    sections: z.array(DynamicSectionSchema).min(1),
  }).strict();

  return zodToJsonSchema(DynamicChunkSchema, "GeneratedChunk");
}
