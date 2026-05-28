import React, { useCallback, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FileDropzone } from "@/components/create/FileDropzone";
import { QuestionTypeRow } from "@/components/create/QuestionTypeRow";
import { useAssignmentStore } from "@/store/useAssignmentStore";

interface CompetitiveAssessmentFormProps {
  onCancel: () => void;
}

const EXAM_TYPES = ["JEE Mains", "JEE Advanced", "NEET", "NEET Advanced"];

const EXAM_SUBJECTS: Record<string, string[]> = {
  "JEE Mains": ["Physics", "Chemistry", "Mathematics"],
  "JEE Advanced": ["Physics", "Chemistry", "Mathematics"],
  "NEET": ["Physics", "Chemistry", "Biology", "Botany", "Zoology"],
  "NEET Advanced": ["Physics", "Chemistry", "Biology", "Botany", "Zoology"],
};

export function CompetitiveAssessmentForm({ onCancel }: CompetitiveAssessmentFormProps) {
  const router = useRouter();
  
  const {
    form,
    setFormField,
    setFile,
    addQuestionTypeRow,
    updateQuestionTypeRow,
    removeQuestionTypeRow,
    isSubmitting,
    submitError,
    submitAssignment,
  } = useAssignmentStore();

  // Initialize competitive specific fields
  useEffect(() => {
    if (!form.examType || !EXAM_TYPES.includes(form.examType)) {
      setFormField("examType", EXAM_TYPES[0]);
      setFormField("subject", EXAM_SUBJECTS[EXAM_TYPES[0]][0]);
    }
    // Clear college fields
    setFormField("year", "");
    setFormField("semester", "");
    setFormField("department", "");
  }, [form.examType, setFormField]);

  // Handle Exam Type change
  const handleExamTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newExamType = e.target.value;
    setFormField("examType", newExamType);
    setFormField("subject", EXAM_SUBJECTS[newExamType]?.[0] || "");
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const assignmentId = await submitAssignment();
      if (assignmentId) {
        router.push(`/output/${assignmentId}`);
      }
    },
    [submitAssignment, router]
  );

  const availableSubjects = form.examType ? EXAM_SUBJECTS[form.examType] || [] : [];

  return (
    <form onSubmit={handleSubmit}>
      <div className="card create-card animate-fadeIn">
        <div className="create-card-header">
          <h4>Competitive Exam Details</h4>
          <p>Set up assessment for competitive entrance exams</p>
        </div>

        {/* Title */}
        <div className="form-group">
          <label className="form-label" htmlFor="title">
            Title (Institution / Coaching Name)
          </label>
          <input
            id="title"
            className={`form-input-text ${form.errors.title ? "error" : ""}`}
            type="text"
            value={form.title}
            onChange={(e) => setFormField("title", e.target.value)}
            placeholder="e.g. Allen Career Institute Mock Test"
          />
          {form.errors.title && (
            <span className="form-error">{form.errors.title}</span>
          )}
        </div>

        {/* File Upload */}
        <FileDropzone file={form.file} onFileChange={setFile} />

        <div className="form-grid-three-col">
          {/* Exam Type */}
          <div className="form-group">
            <label className="form-label" htmlFor="examType">
              Exam Type
            </label>
            <select
              id="examType"
              className={`form-input-select ${form.errors.examType ? "error" : ""}`}
              value={form.examType}
              onChange={handleExamTypeChange}
            >
              {EXAM_TYPES.map(exam => (
                <option key={exam} value={exam}>{exam}</option>
              ))}
            </select>
            {form.errors.examType && (
              <span className="form-error">{form.errors.examType}</span>
            )}
          </div>

          {/* Subject */}
          <div className="form-group">
            <label className="form-label" htmlFor="subject">
              Subject
            </label>
            <select
              id="subject"
              className={`form-input-select ${form.errors.subject ? "error" : ""}`}
              value={form.subject}
              onChange={(e) => setFormField("subject", e.target.value)}
              disabled={availableSubjects.length === 0}
            >
              {availableSubjects.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
            {form.errors.subject && (
              <span className="form-error">{form.errors.subject}</span>
            )}
          </div>

          {/* Due Date */}
          <div className="form-group">
            <label className="form-label" htmlFor="dueDate">
              Due Date
            </label>
            <div className="date-input-container">
              <input
                id="dueDate"
                className={`form-input-date ${form.errors.dueDate ? "error" : ""} ${!form.dueDate ? "empty" : ""}`}
                type="date"
                value={form.dueDate}
                onChange={(e) => setFormField("dueDate", e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                placeholder="DD-MM-YYYY"
              />
              <span className="date-calendar-icon">
                <Image src="/assets/icons/icon-calendar.svg" alt="Calendar" width={20} height={20} />
              </span>
            </div>
            {form.errors.dueDate && (
              <span className="form-error">{form.errors.dueDate}</span>
            )}
          </div>
        </div>

        {/* Question Types Builder */}
        <div className="question-types-section">
          <div className="question-type-header">
            <span>Question Type</span>
            <span />
            <span style={{ textAlign: "center" }}>No. of Questions</span>
            <span style={{ textAlign: "center" }}>Marks</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {form.questionTypeRows.map((row) => (
              <QuestionTypeRow
                key={row.id}
                config={row}
                onChange={(updated) => updateQuestionTypeRow(row.id, updated)}
                onRemove={() => removeQuestionTypeRow(row.id)}
              />
            ))}
          </div>

          <div className="question-types-footer-row">
            <button
              type="button"
              className="btn-add-type"
              onClick={addQuestionTypeRow}
            >
              <Image src="/assets/icons/icon-add-circle.svg" alt="" width={24} height={24} />
              Add Question Type
            </button>
            <div className="totals-summary">
              <div>Total Questions : {form.questionTypeRows.reduce((sum, row) => sum + row.numberOfQuestions, 0)}</div>
              <div>Total Marks : {form.questionTypeRows.reduce((sum, row) => sum + (row.numberOfQuestions * row.marks), 0)}</div>
            </div>
          </div>

          {form.errors.questionTypes && (
            <span className="form-error">{form.errors.questionTypes}</span>
          )}
        </div>

        {/* Additional Information */}
        <div className="form-group">
          <label className="form-label" htmlFor="additionalInstructions">
            Additional Information (For better output)
          </label>
          <div className="textarea-container">
            <textarea
              id="additionalInstructions"
              className="form-textarea"
              placeholder="e.g Generate a question paper for 3 hour exam duration.."
              value={form.additionalInstructions}
              onChange={(e) => setFormField("additionalInstructions", e.target.value)}
              rows={3}
            />
            <button type="button" className="btn-voice-input" aria-label="Voice input">
              <Image src="/assets/icons/icon-mic.svg" alt="Microphone" width={9} height={12} />
            </button>
          </div>
        </div>

        {/* Submit Error */}
        {submitError && (
          <div
            style={{
              padding: "var(--space-3) var(--space-4)",
              background: "rgba(239, 68, 68, 0.06)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              borderRadius: "var(--radius-md)",
              color: "var(--error)",
              fontSize: "0.875rem",
            }}
          >
            {submitError}
          </div>
        )}
      </div>

      <div className="create-page-footer-actions">
        <button
          type="button"
          className="btn-previous"
          onClick={onCancel}
        >
          <Image src="/assets/icons/icon-arrow-prev.svg" alt="" width={16} height={16} />
          Change Type
        </button>

        <button
          type="submit"
          className="btn-next"
          disabled={isSubmitting}
          id="submit-assignment"
        >
          {isSubmitting ? (
            <>
              <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              Generating...
            </>
          ) : (
            <>
              Next
              <Image src="/assets/icons/icon-arrow-next.svg" alt="" width={16} height={16} />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
