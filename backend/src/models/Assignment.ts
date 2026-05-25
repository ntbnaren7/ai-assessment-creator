import mongoose, { Schema, Document } from "mongoose";

/* ── Sub-schemas ── */

const QuestionSchema = new Schema(
  {
    questionNumber: { type: Number, required: true },
    questionText: { type: String, required: true },
    difficulty: {
      type: String,
      enum: ["Easy", "Moderate", "Hard"],
      required: true,
    },
    marks: { type: Number, required: true, min: 1 },
    questionType: {
      type: String,
      enum: ["MCQ", "Short Answer", "Long Answer", "True/False", "Fill in the Blanks"],
      required: true,
    },
    options: { type: [String], default: undefined }, // Only for MCQ
    correctAnswer: { type: String, default: undefined }, // Optional: for answer key
  },
  { _id: false }
);

const SectionSchema = new Schema(
  {
    sectionLabel: { type: String, required: true }, // "A", "B", "C"
    sectionTitle: { type: String, required: true }, // "Section A"
    instruction: { type: String, required: true }, // "Attempt all questions"
    questions: { type: [QuestionSchema], required: true },
  },
  { _id: false }
);

/* ── Generated Paper sub-schema ── */

const GeneratedPaperSchema = new Schema(
  {
    title: { type: String, required: true },
    subject: { type: String, required: true },
    totalMarks: { type: Number, required: true },
    duration: { type: String, required: true },
    generalInstructions: { type: [String], required: true },
    sections: { type: [SectionSchema], required: true },
  },
  { _id: false }
);

/* ── Main Assignment document ── */

export interface IAssignment extends Document {
  title: string;
  subject: string;
  grade: string;
  dueDate: Date;
  questionTypes: string[];
  numberOfQuestions: number;
  totalMarks: number;
  duration: string;
  additionalInstructions: string;
  fileContent: string | null; // Extracted text from uploaded file
  status: "pending" | "processing" | "completed" | "failed";
  generatedPaper: typeof GeneratedPaperSchema | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const AssignmentSchema = new Schema<IAssignment>(
  {
    title: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    grade: { type: String, required: true, trim: true },
    dueDate: { type: Date, required: true },
    questionTypes: {
      type: [String],
      required: true,
      validate: {
        validator: (v: string[]) => v.length > 0,
        message: "At least one question type is required",
      },
    },
    numberOfQuestions: { type: Number, required: true, min: 1, max: 100 },
    totalMarks: { type: Number, required: true, min: 1, max: 500 },
    duration: { type: String, required: true, trim: true },
    additionalInstructions: { type: String, default: "", trim: true },
    fileContent: { type: String, default: null },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    generatedPaper: { type: GeneratedPaperSchema, default: null },
    errorMessage: { type: String, default: null },
  },
  {
    timestamps: true,
  }
);

export const Assignment = mongoose.model<IAssignment>("Assignment", AssignmentSchema);
