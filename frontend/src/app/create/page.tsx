"use client";
import "@/styles/create.css";

import { useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ProgressStep } from "@/components/create/ProgressStep";
import { FileDropzone } from "@/components/create/FileDropzone";
import { QuestionTypeRow } from "@/components/create/QuestionTypeRow";
import { useAssignmentStore } from "@/store/useAssignmentStore";

export default function CreateAssignmentPage() {
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
      const assignmentId = await submitAssignment();
      if (assignmentId) {
        router.push(`/output/${assignmentId}`);
      }
    },
    [submitAssignment, router]
  );

  return (
    <AppShell
      breadcrumb="Assignment"
      breadcrumbIcon=""
      onBack={() => router.push("/")}
    >
      <div className="create-page-container">
        {/* Page Header */}
        <div className="create-page-header animate-fadeIn">
          <h2>
            <span className="status-dot active" />
            Create Assignment
          </h2>
          <p>
            Set up a new assignment for your students
          </p>
        </div>

        {/* Progress Bar */}
        <ProgressStep progress={50} />

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="card create-card animate-fadeIn">
            {/* Section Title */}
            <div className="create-card-header">
              <h4>Assignment Details</h4>
              <p>
                Basic information about your assignment
              </p>
            </div>

            {/* File Upload */}
            <FileDropzone file={form.file} onFileChange={setFile} />

            {/* Due Date */}
            <div className="form-group">
              <label className="form-label" htmlFor="dueDate">
                Due Date
              </label>
              <div className="date-input-container">
                <input
                  id="dueDate"
                  className={`form-input-date ${form.errors.dueDate ? "error" : ""}`}
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

              <button
                type="button"
                className="btn-add-type"
                onClick={addQuestionTypeRow}
              >
                <span>+</span> Add Question Type
              </button>

              {form.errors.questionTypes && (
                <span className="form-error">{form.errors.questionTypes}</span>
              )}
            </div>

            {/* Additional Instructions */}
            <div className="form-group">
              <label className="form-label" htmlFor="additionalInstructions">
                Additional Instructions{" "}
                <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                id="additionalInstructions"
                className="form-textarea"
                placeholder="e.g., Focus on chapters 5-8, include application-based questions..."
                value={form.additionalInstructions}
                onChange={(e) => setFormField("additionalInstructions", e.target.value)}
                rows={3}
              />
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

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn-generate"
              disabled={isSubmitting}
              id="submit-assignment"
            >
              {isSubmitting ? (
                <>
                  <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                  Generating...
                </>
              ) : (
                <>
                  <Image src="/assets/icons/icon-sparkles.svg" alt="Sparkles" width={20} height={20} />
                  Generate Question Paper
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
