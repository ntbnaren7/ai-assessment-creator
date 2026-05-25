import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type {
  Assignment,
  AssignmentStatus,
  CreateAssignmentInput,
  QuestionType,
} from "@/types";
import * as api from "@/services/api";

/* ── Form State Slice ── */
interface FormState {
  title: string;
  subject: string;
  grade: string;
  dueDate: string;
  questionTypes: QuestionType[];
  numberOfQuestions: number;
  totalMarks: number;
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
  toggleQuestionType: (type: QuestionType) => void;
  setFile: (file: File | null) => void;
  setErrors: (errors: Record<string, string>) => void;
  resetForm: () => void;

  // Submission
  isSubmitting: boolean;
  submitError: string | null;
  submitAssignment: () => Promise<string | null>;

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

const initialFormState: FormState = {
  title: "",
  subject: "",
  grade: "",
  dueDate: "",
  questionTypes: [],
  numberOfQuestions: 10,
  totalMarks: 50,
  duration: "1 Hour",
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

      toggleQuestionType: (type) =>
        set(
          (state) => {
            const types = state.form.questionTypes.includes(type)
              ? state.form.questionTypes.filter((t) => t !== type)
              : [...state.form.questionTypes, type];
            return {
              form: {
                ...state.form,
                questionTypes: types,
                errors: { ...state.form.errors, questionTypes: "" },
              },
            };
          },
          false,
          "toggleQuestionType"
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
        set({ form: { ...initialFormState } }, false, "resetForm"),

      // ── Submission ──
      isSubmitting: false,
      submitError: null,

      submitAssignment: async () => {
        const { form } = get();

        // Client-side validation
        const errors: Record<string, string> = {};
        if (!form.title.trim()) errors.title = "Title is required";
        if (!form.subject.trim()) errors.subject = "Subject is required";
        if (!form.grade.trim()) errors.grade = "Grade is required";
        if (!form.dueDate) errors.dueDate = "Due date is required";
        if (form.questionTypes.length === 0)
          errors.questionTypes = "Select at least one question type";
        if (form.numberOfQuestions < 1 || form.numberOfQuestions > 100)
          errors.numberOfQuestions = "Must be between 1 and 100";
        if (form.totalMarks < 1 || form.totalMarks > 500)
          errors.totalMarks = "Must be between 1 and 500";
        if (!form.duration.trim()) errors.duration = "Duration is required";

        if (Object.keys(errors).length > 0) {
          set({ form: { ...form, errors } }, false, "validationFailed");
          return null;
        }

        set({ isSubmitting: true, submitError: null }, false, "submitStart");

        try {
          const formData = new FormData();
          formData.append("title", form.title);
          formData.append("subject", form.subject);
          formData.append("grade", form.grade);
          formData.append("dueDate", form.dueDate);
          formData.append("questionTypes", JSON.stringify(form.questionTypes));
          formData.append("numberOfQuestions", String(form.numberOfQuestions));
          formData.append("totalMarks", String(form.totalMarks));
          formData.append("duration", form.duration);
          formData.append("additionalInstructions", form.additionalInstructions);
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
