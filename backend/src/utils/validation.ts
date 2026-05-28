import { z } from "zod";

export const QuestionTypeEnum = z.enum([
  "Multiple Choice Questions",
  "Short Answer Questions",
  "Long Answer Questions",
  "Diagram/Graph-Based Questions",
  "Numerical Problems",
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
    .max(50, "Grade must be less than 50 characters")
    .trim(),
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

export const GeneratedQuestionSchema = z
  .object({
    questionNumber: z.number().int().min(1),
    questionText: z.string().min(1, "Question text cannot be empty"),
    difficulty: DifficultyEnum,
    marks: z.number().int().min(1),
    questionType: z.string().min(1),
    options: z.array(z.string()).optional(),
    correctAnswer: z.string().optional(),
  })
  .passthrough();

export const GeneratedSectionSchema = z
  .object({
    sectionLabel: z.string().min(1),
    sectionTitle: z.string().min(1),
    instruction: z.string().min(1),
    questions: z
      .array(GeneratedQuestionSchema)
      .min(1, "Each section must contain at least one question"),
  })
  .passthrough();

export const GeneratedPaperSchema = z
  .object({
    title: z.string().min(1),
    subject: z.string().min(1),
    totalMarks: z.number().int().min(1),
    duration: z.string().min(1),
    generalInstructions: z
      .array(z.string())
      .min(1, "At least one general instruction is required"),
    sections: z
      .array(GeneratedSectionSchema)
      .min(1, "At least one section is required"),
  })
  .passthrough();

export type GeneratedPaperOutput = z.infer<typeof GeneratedPaperSchema>;
