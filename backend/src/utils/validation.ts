import { z } from "zod";

export const QuestionTypeEnum = z.enum([
  "MCQ",
  "Short Answer",
  "Long Answer",
  "True/False",
  "Fill in the Blanks",
]);

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
    .max(100, "Maximum 100 questions allowed"),
  totalMarks: z
    .number()
    .int("Total marks must be a whole number")
    .min(1, "Total marks must be at least 1")
    .max(500, "Maximum 500 marks allowed"),
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
});

export type CreateAssignmentInput = z.infer<typeof CreateAssignmentSchema>;
