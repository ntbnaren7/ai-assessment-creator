import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  Assignment,
  AssignmentStatus,
  QuestionType,
} from "@/types";
import * as api from "@/services/api";

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
  setStatusUpdate: (status: AssignmentStatus, message: string) => void;
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
  dueDate: "",
  questionTypeRows: [
    { id: nextRowId(), type: "Multiple Choice Questions", numberOfQuestions: 4, marks: 1 },
    { id: nextRowId(), type: "Short Questions", numberOfQuestions: 3, marks: 2 },
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
                { id: nextRowId(), type: "Multiple Choice Questions", numberOfQuestions: 5, marks: 1 },
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
                r.id === id ? updated : r
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
        if (!form.dueDate) errors.dueDate = "Due date is required";
        if (form.questionTypeRows.length === 0)
          errors.questionTypes = "Add at least one question type";

        if (Object.keys(errors).length > 0) {
          set({ form: { ...form, errors } }, false, "validationFailed");
          return null;
        }

        set({ isSubmitting: true, submitError: null }, false, "submitStart");

        try {
          const formData = new FormData();
          formData.append("title", form.title || "Untitled Assignment");
          formData.append("subject", form.subject || "General");
          formData.append("grade", form.grade || "");
          formData.append("dueDate", form.dueDate);

          // Build question types from rows
          const questionTypes = form.questionTypeRows.map((r) => r.type);
          formData.append("questionTypes", JSON.stringify(questionTypes));

          // Sum up questions and marks
          const totalQuestions = form.questionTypeRows.reduce((s, r) => s + r.numberOfQuestions, 0);
          const totalMarks = form.questionTypeRows.reduce((s, r) => s + r.numberOfQuestions * r.marks, 0);
          formData.append("numberOfQuestions", String(totalQuestions));
          formData.append("totalMarks", String(totalMarks));
          formData.append("duration", form.duration || "1 Hour");
          formData.append("additionalInstructions", form.additionalInstructions);

          // Include row details as structured JSON for the backend prompt
          formData.append("questionTypeDetails", JSON.stringify(form.questionTypeRows));

          if (form.file) {
            formData.append("file", form.file);
          }

          const result = (await api.createAssignment(formData)) as {
            success: boolean;
            data: { assignmentId: string };
          };

          set({ isSubmitting: false }, false, "submitSuccess");
          return result.data.assignmentId;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Failed to create assignment";
          set({ isSubmitting: false, submitError: message }, false, "submitError");
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
          const message =
            error instanceof Error ? error.message : "Failed to fetch assignment";
          set(
            { isLoading: false, statusMessage: message },
            false,
            "fetchError"
          );
        }
      },

      setStatusUpdate: (status, message) =>
        set({ currentStatus: status, statusMessage: message }, false, "statusUpdate"),

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
