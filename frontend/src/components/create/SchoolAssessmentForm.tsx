import React, { useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FileDropzone } from "@/components/create/FileDropzone";
import { QuestionTypeRow } from "@/components/create/QuestionTypeRow";
import { useAssignmentStore } from "@/store/useAssignmentStore";

interface SchoolAssessmentFormProps {
  onCancel: () => void;
}

export function SchoolAssessmentForm({ onCancel }: SchoolAssessmentFormProps) {
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

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      // Make sure we clear any leftover college fields
      setFormField("year", "");
      setFormField("semester", "");
      setFormField("department", "");
      
      const assignmentId = await submitAssignment();
      if (assignmentId) {
        router.push(`/output/${assignmentId}`);
      }
    },
    [submitAssignment, router, setFormField]
  );

  return (
    <form onSubmit={handleSubmit}>
      <div className="card create-card animate-fadeIn">
        <div className="create-card-header">
          <h4>
            <span className="hide-on-mobile">School Assignment Details</span>
            <span className="show-on-mobile">Assignment Details</span>
          </h4>
          <p>
            <span className="hide-on-mobile">Basic information about your school assignment</span>
            <span className="show-on-mobile">Basic information about your assignment</span>
          </p>
        </div>

        {/* Title */}
        <div className="form-group">
          <label className="form-label" htmlFor="title">
            Title (Institution Name)
          </label>
          <input
            id="title"
            className={`form-input-text ${form.errors.title ? "error" : ""}`}
            type="text"
            value={form.title}
            onChange={(e) => setFormField("title", e.target.value)}
            placeholder="e.g. Acme High School Exam"
          />
          {form.errors.title && (
            <span className="form-error">{form.errors.title}</span>
          )}
        </div>

        {/* File Upload */}
        <FileDropzone file={form.file} onFileChange={setFile} />

        <div className="form-grid-three-col">
          {/* Subject */}
          <div className="form-group">
            <label className="form-label" htmlFor="subject">
              Subject
            </label>
            <input
              id="subject"
              className={`form-input-text ${form.errors.subject ? "error" : ""}`}
              type="text"
              value={form.subject}
              onChange={(e) => setFormField("subject", e.target.value)}
              placeholder="e.g. Mathematics"
            />
            {form.errors.subject && (
              <span className="form-error">{form.errors.subject}</span>
            )}
          </div>

          {/* Grade */}
          <div className="form-group">
            <label className="form-label" htmlFor="grade">
              Grade
            </label>
            <input
              id="grade"
              className={`form-input-text ${form.errors.grade ? "error" : ""}`}
              type="text"
              value={form.grade}
              onChange={(e) => setFormField("grade", e.target.value)}
              placeholder="e.g. 10th"
            />
            {form.errors.grade && (
              <span className="form-error">{form.errors.grade}</span>
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
            {form.questionTypeRows.map((row) => {
              const MAX_TOTAL_QUESTIONS = 50;
              const MAX_TOTAL_MARKS = 100;
              const otherRows = form.questionTypeRows.filter((r) => r.id !== row.id);
              const otherQuestions = otherRows.reduce((s, r) => s + r.numberOfQuestions, 0);
              const otherMarks = otherRows.reduce((s, r) => s + r.numberOfQuestions * r.marks, 0);
              const maxQuestionsForRow = Math.max(1, MAX_TOTAL_QUESTIONS - otherQuestions);
              const remainingMarksBudget = MAX_TOTAL_MARKS - otherMarks;
              const maxMarksForRow = Math.max(1, Math.floor(remainingMarksBudget / row.numberOfQuestions));

              return (
                <QuestionTypeRow
                  key={row.id}
                  config={row}
                  onChange={(updated) => updateQuestionTypeRow(row.id, updated)}
                  onRemove={() => removeQuestionTypeRow(row.id)}
                  maxQuestionsForRow={maxQuestionsForRow}
                  maxMarksForRow={maxMarksForRow}
                />
              );
            })}
          </div>

          <div className="question-types-footer-row">
            <div className="footer-row-inner">
              <button
                type="button"
                className="btn-add-type"
                onClick={addQuestionTypeRow}
              >
                <span className="btn-add-type-circle hide-on-mobile">
                  <Image src="/assets/icons/icon-add-circle.svg" alt="" width={24} height={24} />
                </span>
                <span className="btn-add-type-circle show-on-mobile-flex">
                  <Image src="/assets/icons/icon-plus.svg" alt="" width={14} height={14} />
                </span>
                Add Question Type
              </button>
              <div className="totals-summary">
                <div>Total Questions : {form.questionTypeRows.reduce((sum, row) => sum + row.numberOfQuestions, 0)}</div>
                <div>Total Marks : {form.questionTypeRows.reduce((sum, row) => sum + (row.numberOfQuestions * row.marks), 0)}</div>
              </div>
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
          <span className="hide-on-mobile">Change Type</span>
          <span className="show-on-mobile">Previous</span>
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
