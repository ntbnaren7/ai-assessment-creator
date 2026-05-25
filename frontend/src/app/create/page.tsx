"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useAssignmentStore } from "@/store/useAssignmentStore";
import type { QuestionType } from "@/types";

const QUESTION_TYPES: QuestionType[] = [
  "MCQ",
  "Short Answer",
  "Long Answer",
  "True/False",
  "Fill in the Blanks",
];

export default function CreateAssignmentPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const {
    form,
    setFormField,
    toggleQuestionType,
    setFile,
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0] || null;
    if (file) {
      const allowed = ["application/pdf", "text/plain"];
      if (allowed.includes(file.type)) {
        setFile(file);
      }
    }
  };

  return (
    <main style={{ minHeight: "100vh", padding: "var(--space-8) var(--space-6)" }}>
      <div className="container container-narrow">
        {/* Header */}
        <div className="animate-fadeIn" style={{ marginBottom: "var(--space-8)" }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => router.push("/")}
            style={{ marginBottom: "var(--space-4)" }}
          >
            ← Back
          </button>
          <h1 style={{ marginBottom: "var(--space-2)" }}>Create Assessment</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "1rem" }}>
            Fill in the details below and AI will generate a structured question paper.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="animate-fadeIn">
          <div
            className="card"
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}
          >
            {/* Title & Subject */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
              <div className="form-group">
                <label className="form-label" htmlFor="title">
                  Assessment Title *
                </label>
                <input
                  id="title"
                  className={`form-input ${form.errors.title ? "error" : ""}`}
                  type="text"
                  placeholder="e.g., Mid-Term Physics Exam"
                  value={form.title}
                  onChange={(e) => setFormField("title", e.target.value)}
                />
                {form.errors.title && <span className="form-error">{form.errors.title}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="subject">
                  Subject *
                </label>
                <input
                  id="subject"
                  className={`form-input ${form.errors.subject ? "error" : ""}`}
                  type="text"
                  placeholder="e.g., Physics"
                  value={form.subject}
                  onChange={(e) => setFormField("subject", e.target.value)}
                />
                {form.errors.subject && <span className="form-error">{form.errors.subject}</span>}
              </div>
            </div>

            {/* Grade & Duration */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
              <div className="form-group">
                <label className="form-label" htmlFor="grade">
                  Grade / Level *
                </label>
                <input
                  id="grade"
                  className={`form-input ${form.errors.grade ? "error" : ""}`}
                  type="text"
                  placeholder="e.g., Grade 10"
                  value={form.grade}
                  onChange={(e) => setFormField("grade", e.target.value)}
                />
                {form.errors.grade && <span className="form-error">{form.errors.grade}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="duration">
                  Duration *
                </label>
                <input
                  id="duration"
                  className={`form-input ${form.errors.duration ? "error" : ""}`}
                  type="text"
                  placeholder="e.g., 2 Hours"
                  value={form.duration}
                  onChange={(e) => setFormField("duration", e.target.value)}
                />
                {form.errors.duration && (
                  <span className="form-error">{form.errors.duration}</span>
                )}
              </div>
            </div>

            {/* Due Date */}
            <div className="form-group">
              <label className="form-label" htmlFor="dueDate">
                Due Date *
              </label>
              <input
                id="dueDate"
                className={`form-input ${form.errors.dueDate ? "error" : ""}`}
                type="date"
                value={form.dueDate}
                onChange={(e) => setFormField("dueDate", e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
              {form.errors.dueDate && <span className="form-error">{form.errors.dueDate}</span>}
            </div>

            {/* Question Types */}
            <div className="form-group">
              <label className="form-label">Question Types *</label>
              <div className="checkbox-group">
                {QUESTION_TYPES.map((type) => (
                  <div key={type} className="checkbox-item">
                    <input
                      type="checkbox"
                      id={`qt-${type}`}
                      checked={form.questionTypes.includes(type)}
                      onChange={() => toggleQuestionType(type)}
                    />
                    <label htmlFor={`qt-${type}`}>{type}</label>
                  </div>
                ))}
              </div>
              {form.errors.questionTypes && (
                <span className="form-error">{form.errors.questionTypes}</span>
              )}
            </div>

            {/* Number of Questions & Total Marks */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
              <div className="form-group">
                <label className="form-label" htmlFor="numberOfQuestions">
                  Number of Questions *
                </label>
                <input
                  id="numberOfQuestions"
                  className={`form-input ${form.errors.numberOfQuestions ? "error" : ""}`}
                  type="number"
                  min={1}
                  max={100}
                  value={form.numberOfQuestions}
                  onChange={(e) =>
                    setFormField("numberOfQuestions", parseInt(e.target.value, 10) || 0)
                  }
                />
                {form.errors.numberOfQuestions && (
                  <span className="form-error">{form.errors.numberOfQuestions}</span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="totalMarks">
                  Total Marks *
                </label>
                <input
                  id="totalMarks"
                  className={`form-input ${form.errors.totalMarks ? "error" : ""}`}
                  type="number"
                  min={1}
                  max={500}
                  value={form.totalMarks}
                  onChange={(e) =>
                    setFormField("totalMarks", parseInt(e.target.value, 10) || 0)
                  }
                />
                {form.errors.totalMarks && (
                  <span className="form-error">{form.errors.totalMarks}</span>
                )}
              </div>
            </div>

            {/* File Upload */}
            <div className="form-group">
              <label className="form-label">
                Upload Reference Material{" "}
                <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span>
              </label>
              <div
                className={`file-upload-zone ${isDragging ? "dragging" : ""} ${
                  form.file ? "has-file" : ""
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
                {form.file ? (
                  <div className="file-name">
                    <span>📄</span>
                    <span>{form.file.name}</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      style={{ marginLeft: "var(--space-2)" }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="file-upload-icon">📁</div>
                    <div className="file-upload-text">
                      <strong>Click to upload</strong> or drag and drop
                      <br />
                      PDF or TXT (max 10MB)
                    </div>
                  </>
                )}
              </div>
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
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
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
    </main>
  );
}
