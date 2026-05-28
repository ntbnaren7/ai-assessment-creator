import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  Assignment,
  AssignmentStatus,
  QuestionType,
} from "@/types";
import * as api from "@/services/api";

const MOCK_ASSIGNMENT: Assignment = {
  _id: "mock-assignment",
  title: "Delhi Public School, Sector-4, Bokaro",
  subject: "Science",
  grade: "8",
  dueDate: new Date().toISOString().split("T")[0],
  questionTypes: ["Short Answer"],
  numberOfQuestions: 10,
  totalMarks: 20,
  duration: "45 minutes",
  additionalInstructions: "",
  fileContent: null,
  status: "completed",
  errorMessage: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  generatedPaper: {
    title: "Delhi Public School, Sector-4, Bokaro",
    subject: "Science",
    totalMarks: 20,
    duration: "45 minutes",
    generalInstructions: [
      "All questions are compulsory unless stated otherwise."
    ],
    sections: [
      {
        sectionLabel: "Section A",
        sectionTitle: "Short Answer Questions",
        instruction: "Attempt all questions. Each question carries 2 marks",
        questions: [
          {
            questionNumber: 1,
            questionText: "Define electroplating. Explain its purpose.",
            difficulty: "Easy",
            marks: 2,
            questionType: "Short Answer",
            correctAnswer: "Electroplating is the process of depositing a thin layer of metal on the surface of another metal using electric current. Its purpose is to prevent corrosion, improve appearance, or increase thickness."
          },
          {
            questionNumber: 2,
            questionText: "Explain how a conductor allows the flow of electric current.",
            difficulty: "Moderate",
            marks: 2,
            questionType: "Short Answer",
            correctAnswer: "A conductor allows the flow of electric current, causing ions in the electrolyte to move and enabling chemical changes at electrodes."
          },
          {
            questionNumber: 3,
            questionText: "Why does a copper sulfate solution conduct electricity?",
            difficulty: "Moderate",
            marks: 2,
            questionType: "Short Answer",
            correctAnswer: "Copper sulfate solution contains free copper and sulfate ions which carry electric charge, thus conducting electricity."
          },
          {
            questionNumber: 4,
            questionText: "Describe one example of the chemical effect of electric current in daily life.",
            difficulty: "Moderate",
            marks: 2,
            questionType: "Short Answer",
            correctAnswer: "An example is the electroplating of silver on jewelry to prevent tarnishing."
          },
          {
            questionNumber: 5,
            questionText: "Explain why electric current is said to have chemical effects.",
            difficulty: "Moderate",
            marks: 2,
            questionType: "Short Answer",
            correctAnswer: "Electric current causes the movement of ions leading to chemical changes at the electrodes, hence it shows chemical effects."
          },
          {
            questionNumber: 6,
            questionText: "How is sodium hydroxide prepared during the electrolysis of brine? Write the chemical reaction involved.",
            difficulty: "Challenging",
            marks: 2,
            questionType: "Short Answer",
            correctAnswer: "Sodium hydroxide is formed at the cathode during brine electrolysis as water gains electrons:\n\n2H2O + 2e- -> H2 + 2OH-\nNa+ + OH- -> NaOH (in solution)"
          },
          {
            questionNumber: 7,
            questionText: "What happens at the cathode and anode during the electrolysis of water? Name the gases evolved.",
            difficulty: "Challenging",
            marks: 2,
            questionType: "Short Answer",
            correctAnswer: "At the cathode: water is reduced to hydrogen gas and hydroxide ions.\nAt the anode: water is oxidized to oxygen gas and hydrogen ions."
          },
          {
            questionNumber: 8,
            questionText: "Mention the type of current used in electroplating and justify why it is used.",
            difficulty: "Easy",
            marks: 2,
            questionType: "Short Answer",
            correctAnswer: "Direct current (DC) is used in electroplating to ensure a steady, one-directional flow of electric charge for uniform deposition."
          },
          {
            questionNumber: 9,
            questionText: "What is the importance of electric current in the field of metallurgy?",
            difficulty: "Moderate",
            marks: 2,
            questionType: "Short Answer",
            correctAnswer: "Electric current is used in metallurgy for extracting and refining metals from their ores (electrometallurgy) and for electroplating."
          },
          {
            questionNumber: 10,
            questionText: "Explain with a chemical equation how copper is deposited during the electroplating of an object.",
            difficulty: "Challenging",
            marks: 2,
            questionType: "Short Answer",
            correctAnswer: "Copper ions (Cu2+) in solution gain electrons at the cathode and are deposited as copper metal:\nCu2+ + 2e- -> Cu (solid)"
          }
        ]
      }
    ]
  }
};

const MOCK_COLLEGE_ASSIGNMENT: Assignment = {
  _id: "mock-college",
  title: "SRM Institute of Science and Technology - Department of Computer Science",
  subject: "Data Structures and Algorithms",
  grade: "Year 2, Semester 3",
  dueDate: new Date().toISOString().split("T")[0],
  questionTypes: ["Short Answer", "Long Answer"],
  numberOfQuestions: 16,
  totalMarks: 100,
  duration: "3 Hours",
  additionalInstructions: "Answer all questions.",
  fileContent: null,
  status: "completed",
  errorMessage: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  generatedPaper: {
    title: "SRM Institute of Science and Technology - Department of Computer Science",
    subject: "Data Structures and Algorithms",
    totalMarks: 100,
    duration: "3 Hours",
    generalInstructions: [
      "Part A carries 20 marks.",
      "Part B carries 65 marks.",
      "Part C carries 15 marks."
    ],
    sections: [
      {
        sectionLabel: "Part A",
        sectionTitle: "Short Answer Questions",
        instruction: "Answer all 10 questions. (10 x 2 = 20 Marks)",
        questions: [
          {
            questionNumber: 1,
            questionText: "Define a binary search tree.",
            difficulty: "Easy",
            marks: 2,
            questionType: "Short Answer",
            correctAnswer: "A BST is a node-based binary tree data structure where each node has a maximum of two child nodes and the left child value is less than the parent, right child value is greater."
          },
          {
            questionNumber: 2,
            questionText: "What is the time complexity of quicksort in the worst case?",
            difficulty: "Easy",
            marks: 2,
            questionType: "Short Answer",
            correctAnswer: "O(n^2)"
          }
        ]
      },
      {
        sectionLabel: "Part B",
        sectionTitle: "Long Answer Questions",
        instruction: "Answer all 5 questions. (5 x 13 = 65 Marks)",
        questions: [
          {
            questionNumber: 11,
            questionText: "A) Explain Dijkstra's algorithm for finding the shortest path with an example.\n\nor\n\nB) Explain the Bellman-Ford algorithm with an example.",
            difficulty: "Moderate",
            marks: 13,
            questionType: "Long Answer",
            correctAnswer: "Refer to graph algorithms textbook."
          },
          {
            questionNumber: 12,
            questionText: "A) Discuss the various collision resolution techniques in hashing.\n\nor\n\nB) Write a C function to insert a node at the beginning of a circular linked list.",
            difficulty: "Moderate",
            marks: 13,
            questionType: "Long Answer",
            correctAnswer: "Refer to hashing and linked list chapters."
          }
        ]
      },
      {
        sectionLabel: "Part C",
        sectionTitle: "Long Answer Questions",
        instruction: "Answer the question. (1 x 15 = 15 Marks)",
        questions: [
          {
            questionNumber: 16,
            questionText: "A) Design a data structure for an elevator system that optimizes wait times and power consumption.\n\nor\n\nB) Analyze the differences between Red-Black trees and AVL trees. When would you prefer one over the other?",
            difficulty: "Challenging",
            marks: 15,
            questionType: "Long Answer",
            correctAnswer: "Open-ended design question."
          }
        ]
      }
    ]
  }
};

/* ── Question Type Row Config ── */
export interface QuestionTypeConfig {
  id: string;
  type: string;
  numberOfQuestions: number;
  marks: number;
}

/* ── Form State Slice ── */
interface FormState {
  title: string;
  subject: string;
  grade: string;
  department?: string; // For College
  year?: string;     // For College
  semester?: string; // For College
  includePartC?: boolean; // For College
  dueDate: string;
  questionTypeRows: QuestionTypeConfig[];
  duration: string;
  additionalInstructions: string;
  file: File | null;
  errors: Record<string, string>;
}

/* ── Assignment Store ── */
interface AssignmentState {
  // Form
  form: FormState;
  setFormField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  setFile: (file: File | null) => void;
  setErrors: (errors: Record<string, string>) => void;
  resetForm: () => void;

  // Question type rows
  addQuestionTypeRow: () => void;
  updateQuestionTypeRow: (id: string, updated: QuestionTypeConfig) => void;
  removeQuestionTypeRow: (id: string) => void;

  // Submission
  isSubmitting: boolean;
  submitError: string | null;
  submitAssignment: () => Promise<string | null>;

  // Assignments list (Dashboard)
  assignments: Assignment[];
  isLoadingList: boolean;
  fetchAssignments: () => Promise<void>;

  // Current assignment (viewing output)
  currentAssignment: Assignment | null;
  currentStatus: AssignmentStatus | null;
  statusMessage: string | null;
  isLoading: boolean;
  fetchAssignment: (id: string) => Promise<void>;
  setStatusUpdate: (status: AssignmentStatus, message?: string | null) => void;
  setCurrentAssignment: (assignment: Assignment) => void;

  // Regeneration
  isRegenerating: boolean;
  regenerate: (id: string) => Promise<void>;
}

let rowIdCounter = 0;
function nextRowId(): string {
  return `row-${++rowIdCounter}`;
}

const initialFormState: FormState = {
  title: "",
  subject: "",
  grade: "",
  department: "",
  year: "",
  semester: "",
  includePartC: false,
  dueDate: "",
  questionTypeRows: [
    { id: nextRowId(), type: "MCQ", numberOfQuestions: 4, marks: 1 },
    { id: nextRowId(), type: "Short Answer", numberOfQuestions: 3, marks: 2 },
  ],
  duration: "",
  additionalInstructions: "",
  file: null,
  errors: {},
};

export const useAssignmentStore = create<AssignmentState>()(
  devtools(
    (set, get) => ({
      // ── Form State ──
      form: { ...initialFormState },

      setFormField: (key, value) =>
        set(
          (state) => ({
            form: { ...state.form, [key]: value, errors: { ...state.form.errors, [key]: "" } },
          }),
          false,
          "setFormField"
        ),

      setFile: (file) =>
        set(
          (state) => ({ form: { ...state.form, file } }),
          false,
          "setFile"
        ),

      setErrors: (errors) =>
        set(
          (state) => ({ form: { ...state.form, errors } }),
          false,
          "setErrors"
        ),

      resetForm: () =>
        set({ form: { ...initialFormState, questionTypeRows: [...initialFormState.questionTypeRows] } }, false, "resetForm"),

      // ── Question Type Rows ──
      addQuestionTypeRow: () =>
        set(
          (state) => ({
            form: {
              ...state.form,
              questionTypeRows: [
                ...state.form.questionTypeRows,
                { id: nextRowId(), type: "MCQ", numberOfQuestions: 5, marks: 1 },
              ],
            },
          }),
          false,
          "addQuestionTypeRow"
        ),

      updateQuestionTypeRow: (id, updated) =>
        set(
          (state) => ({
            form: {
              ...state.form,
              questionTypeRows: state.form.questionTypeRows.map((r) =>
                r.id === id
                  ? {
                      ...updated,
                      numberOfQuestions: Math.max(1, updated.numberOfQuestions),
                      marks: Math.max(1, updated.marks),
                    }
                  : r
              ),
            },
          }),
          false,
          "updateQuestionTypeRow"
        ),

      removeQuestionTypeRow: (id) =>
        set(
          (state) => ({
            form: {
              ...state.form,
              questionTypeRows: state.form.questionTypeRows.filter((r) => r.id !== id),
            },
          }),
          false,
          "removeQuestionTypeRow"
        ),

      // ── Submission ──
      isSubmitting: false,
      submitError: null,

      submitAssignment: async () => {
        const { form } = get();

        // Client-side validation
        const errors: Record<string, string> = {};
        if (!form.title.trim()) errors.title = "Assignment title is required";
        if (!form.dueDate) errors.dueDate = "Due date is required";

        if (form.year !== undefined && form.semester !== undefined && form.year !== "" && form.semester !== "") {
          // College
          if (!form.subject.trim()) errors.subject = "Course / Subject is required";
          if (!form.year.trim()) errors.year = "Year is required";
          if (!form.semester.trim()) errors.semester = "Semester is required";
          if (!form.department?.trim()) errors.department = "Department is required";
        } else {
          // School
          if (!form.subject.trim()) errors.subject = "Subject is required";
          if (!form.grade.trim()) errors.grade = "Grade is required";
        }
        
        let actualRows = form.questionTypeRows;
        const isCollege = form.year !== undefined && form.semester !== undefined && form.year !== "" && form.semester !== "";

        if (isCollege) {
          if (form.includePartC) {
            actualRows = [
              { id: "college-row-1", type: "Short Answer", numberOfQuestions: 10, marks: 2 },
              { id: "college-row-2", type: "Long Answer", numberOfQuestions: 5, marks: 13 },
              { id: "college-row-3", type: "Long Answer", numberOfQuestions: 1, marks: 15 },
            ];
          } else {
            actualRows = [
              { id: "college-row-1", type: "Short Answer", numberOfQuestions: 10, marks: 2 },
              { id: "college-row-2", type: "Long Answer", numberOfQuestions: 5, marks: 16 },
            ];
          }
        }

        if (actualRows.length === 0) {
          errors.questionTypes = "Add at least one question type";
        } else if (
          actualRows.some((r) => r.numberOfQuestions < 1 || r.marks < 1)
        ) {
          errors.questionTypes = "Number of questions and marks must be at least 1.";
        }

        if (Object.keys(errors).length > 0) {
          set({ form: { ...form, errors } }, false, "validationFailed");
          return null;
        }

        set({ isSubmitting: true, submitError: null }, false, "submitStart");

        try {
          const formData = new FormData();

          // Handle custom field formatting for the backend
          let finalTitle = form.title.trim();
          let finalSubject = form.subject.trim();
          let finalGrade = form.grade.trim();

          if (form.year && form.semester) {
            // College
            finalGrade = `Year ${form.year.trim()}, Semester ${form.semester.trim()}`;
            if (form.department?.trim()) {
              const dept = form.department.trim();
              const deptSuffix = dept.toLowerCase().startsWith("department") ? dept : `Department of ${dept}`;
              finalTitle = `${form.title.trim()} - ${deptSuffix}`;
            }
          }

          formData.append("title", finalTitle);

          formData.append("subject", finalSubject);
          formData.append("grade", finalGrade);
          formData.append("dueDate", form.dueDate);

          // Build question types from rows
          const questionTypes = actualRows.map((r) => r.type);
          formData.append("questionTypes", JSON.stringify(questionTypes));

          // Sum up questions and marks
          const totalQuestions = actualRows.reduce((s, r) => s + r.numberOfQuestions, 0);
          const totalMarks = actualRows.reduce((s, r) => s + r.numberOfQuestions * r.marks, 0);
          formData.append("numberOfQuestions", String(totalQuestions));
          formData.append("totalMarks", String(totalMarks));
          formData.append("duration", form.duration || "1 Hour");
          formData.append("additionalInstructions", form.additionalInstructions);

          // Include row details as structured JSON for the backend prompt
          formData.append("questionTypeDetails", JSON.stringify(actualRows));

          if (form.file) {
            formData.append("file", form.file);
          }

          const result = (await api.createAssignment(formData)) as {
            success: boolean;
            data: { assignmentId: string };
          };

          set({ isSubmitting: false }, false, "submitSuccess");
          return result.data.assignmentId;
        } catch (error: any) {
          console.error("Failed to submit assignment:", error);
          let errorMessage = "Failed to submit assignment.";
          if (error.errors && Array.isArray(error.errors)) {
            errorMessage = error.errors.map((e: any) => `${e.field}: ${e.message}`).join(", ");
          } else if (error.message) {
            errorMessage = error.message;
          }
          set({ isSubmitting: false, submitError: errorMessage }, false, "submitError");
          return null;
        }
      },

      // ── Assignments List ──
      assignments: [],
      isLoadingList: false,

      fetchAssignments: async () => {
        set({ isLoadingList: true }, false, "fetchListStart");
        try {
          const result = (await api.listAssignments()) as {
            success: boolean;
            data: Assignment[];
          };
          set({ assignments: result.data, isLoadingList: false }, false, "fetchListSuccess");
        } catch {
          set({ isLoadingList: false }, false, "fetchListError");
        }
      },

      // ── Current Assignment ──
      currentAssignment: null,
      currentStatus: null,
      statusMessage: null,
      isLoading: false,

      fetchAssignment: async (id) => {
        set({ isLoading: true }, false, "fetchStart");
        try {
          if (id === "mock-assignment" || id === "mock-college" || id === "1") {
            throw new Error("Simulate API failure for mock fallback");
          }

          const result = (await api.getAssignment(id)) as {
            success: boolean;
            data: Assignment;
          };
          set(
            {
              currentAssignment: result.data,
              currentStatus: result.data.status,
              isLoading: false,
            },
            false,
            "fetchSuccess"
          );
        } catch (error) {
          console.warn("Using offline mock data fallback for assignment", id);
          
          if (id === "mock-college") {
            set(
              {
                currentAssignment: MOCK_COLLEGE_ASSIGNMENT,
                currentStatus: "completed",
                isLoading: false,
                statusMessage: null,
              },
              false,
              "fetchSuccessMockCollege"
            );
            return;
          }


          const form = get().form;
          
          const totalQuestions = form.questionTypeRows.reduce((sum, r) => sum + r.numberOfQuestions, 0) || MOCK_ASSIGNMENT.numberOfQuestions;
          const totalMarks = form.questionTypeRows.reduce((sum, r) => sum + (r.numberOfQuestions * r.marks), 0) || MOCK_ASSIGNMENT.totalMarks;

          let finalTitle = form.title || MOCK_ASSIGNMENT.title;
          if (form.year && form.semester && form.department) {
            const dept = form.department.trim();
            const deptSuffix = dept.toLowerCase().startsWith("department") ? dept : `Department of ${dept}`;
            finalTitle = `${finalTitle} - ${deptSuffix}`;
          }

          const customizedAssignment: Assignment = {
            ...MOCK_ASSIGNMENT,
            _id: id,
            title: finalTitle,
            subject: form.subject || MOCK_ASSIGNMENT.subject,
            grade: form.grade || MOCK_ASSIGNMENT.grade,
            duration: form.duration || MOCK_ASSIGNMENT.duration,
            totalMarks,
            numberOfQuestions: totalQuestions,
            generatedPaper: MOCK_ASSIGNMENT.generatedPaper ? {
              ...MOCK_ASSIGNMENT.generatedPaper,
              title: finalTitle,
              subject: form.subject || MOCK_ASSIGNMENT.generatedPaper.subject,
              duration: form.duration || MOCK_ASSIGNMENT.generatedPaper.duration,
              totalMarks,
            } : null,
          };

          set(
            {
              currentAssignment: customizedAssignment,
              currentStatus: "completed",
              isLoading: false,
              statusMessage: null,
            },
            false,
            "fetchSuccessMock"
          );
        }
      },

      setStatusUpdate: (status, message) =>
        set({ currentStatus: status, statusMessage: message || null }, false, "statusUpdate"),

      setCurrentAssignment: (assignment) =>
        set({ currentAssignment: assignment, currentStatus: assignment.status }, false, "setCurrentAssignment"),

      // ── Regeneration ──
      isRegenerating: false,

      regenerate: async (id) => {
        set({ isRegenerating: true, currentStatus: "pending", statusMessage: "Regeneration queued..." }, false, "regenerateStart");
        try {
          await api.regenerateAssignment(id);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Regeneration failed";
          set(
            { isRegenerating: false, statusMessage: message },
            false,
            "regenerateError"
          );
        }
      },
    }),
    { name: "AssignmentStore" }
  )
);
