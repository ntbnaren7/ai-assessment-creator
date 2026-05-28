/* ── Shared TypeScript types ── */

export type QuestionType =
  | "Multiple Choice Questions"
  | "Short Answer Questions"
  | "Diagram/Graph-Based Questions"
  | "Numerical Problems"
  | "Long Answer Questions";

export type Difficulty = "Easy" | "Moderate" | "Hard" | "Challenging";

export type AssignmentStatus = "pending" | "processing" | "completed" | "failed";

/* ── Form Input ── */
export interface CreateAssignmentInput {
  title: string;
  subject: string;
  grade: string;
  dueDate: string;
  questionTypes: QuestionType[];
  numberOfQuestions: number;
  totalMarks: number;
  duration: string;
  additionalInstructions: string;
}

/* ── API Response Models ── */
export interface Question {
  questionNumber: number;
  questionText: string;
  difficulty: Difficulty;
  marks: number;
  questionType: QuestionType;
  options?: string[];
  correctAnswer?: string;
}

export interface Section {
  sectionLabel: string;
  sectionTitle: string;
  instruction: string;
  questions: Question[];
}

export interface GeneratedPaper {
  title: string;
  subject: string;
  totalMarks: number;
  duration: string;
  generalInstructions: string[];
  sections: Section[];
}

export interface Assignment {
  _id: string;
  title: string;
  subject: string;
  grade: string;
  dueDate: string;
  questionTypes: QuestionType[];
  numberOfQuestions: number;
  totalMarks: number;
  duration: string;
  additionalInstructions: string;
  fileContent: string | null;
  status: AssignmentStatus;
  generatedPaper: GeneratedPaper | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: { field: string; message: string }[];
}

export interface StatusUpdate {
  assignmentId: string;
  status: AssignmentStatus;
  message: string;
}
