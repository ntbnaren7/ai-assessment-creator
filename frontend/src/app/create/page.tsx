"use client";

import { useCallback } from "react";
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
      breadcrumbIcon="📋"
      onBack={() => router.push("/")}
    >
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        {/* Page Header */}
        <div className="animate-fadeIn" style={{ marginBottom: "var(--space-4)" }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span className="status-dot active" />
            Create Assignment
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: "var(--space-1)" }}>
            Set up a new assignment for your students
          </p>
        </div>

        {/* Progress Bar */}
        <ProgressStep progress={50} />

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="card animate-fadeIn" style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            {/* Section Title */}
            <div>
              <h4 style={{ marginBottom: "var(--space-1)" }}>Assignment Details</h4>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
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
              <div style={{ position: "relative" }}>
                <input
                  id="dueDate"
                  className={`form-input ${form.errors.dueDate ? "error" : ""}`}
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setFormField("dueDate", e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  placeholder="DD-MM-YYYY"
                />
              </div>
              {form.errors.dueDate && (
                <span className="form-error">{form.errors.dueDate}</span>
              )}
            </div>

            {/* Question Types Builder */}
            <div>
              <div className="question-type-header">
                <span>Question Type</span>
                <span style={{ textAlign: "center" }}>No. of Questions</span>
                <span style={{ textAlign: "center" }}>Marks</span>
                <span />
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
                className="btn btn-ghost btn-sm"
                onClick={addQuestionTypeRow}
                style={{ marginTop: "var(--space-3)" }}
              >
                + Add Question Type
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
              className="btn btn-primary btn-lg"
              disabled={isSubmitting}
              id="submit-assignment"
              style={{ width: "100%" }}
            >
              {isSubmitting ? (
                <>
                  <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                  Generating...
                </>
              ) : (
                <>
                  <span>✨</span>
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
