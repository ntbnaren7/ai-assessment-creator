"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAssignmentStore } from "@/store/useAssignmentStore";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { Difficulty } from "@/types";

function getDifficultyClass(difficulty: Difficulty): string {
  switch (difficulty) {
    case "Easy":
      return "badge-easy";
    case "Moderate":
      return "badge-moderate";
    case "Hard":
      return "badge-hard";
    default:
      return "";
  }
}

function getStatusClass(status: string): string {
  switch (status) {
    case "pending":
      return "badge-pending";
    case "processing":
      return "badge-processing";
    case "completed":
      return "badge-completed";
    case "failed":
      return "badge-failed";
    default:
      return "";
  }
}

export default function OutputPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.id as string;

  const {
    currentAssignment,
    currentStatus,
    statusMessage,
    isLoading,
    isRegenerating,
    fetchAssignment,
    regenerate,
  } = useAssignmentStore();

  // Connect WebSocket for real-time updates
  useWebSocket(assignmentId);

  // Fetch assignment data on mount
  useEffect(() => {
    if (assignmentId) {
      fetchAssignment(assignmentId);
    }
  }, [assignmentId, fetchAssignment]);

  const handleRegenerate = () => {
    regenerate(assignmentId);
  };

  const handleDownloadPDF = async () => {
    // Dynamic import to avoid SSR issues
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");

    const paperElement = document.getElementById("question-paper");
    if (!paperElement) return;

    const canvas = await html2canvas(paperElement, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#0f172a",
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    let heightLeft = pdfHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
    heightLeft -= pdf.internal.pageSize.getHeight();

    while (heightLeft > 0) {
      position = heightLeft - pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();
    }

    const title = currentAssignment?.generatedPaper?.title || "question-paper";
    pdf.save(`${title.replace(/\s+/g, "-").toLowerCase()}.pdf`);
  };

  // ── Loading State ──
  if (isLoading) {
    return (
      <main style={{ minHeight: "100vh" }}>
        <div className="loading-overlay">
          <div className="spinner spinner-lg" />
          <p className="loading-text">Loading assignment...</p>
        </div>
      </main>
    );
  }

  // ── Processing / Pending State ──
  if (currentStatus === "pending" || currentStatus === "processing") {
    return (
      <main style={{ minHeight: "100vh" }}>
        <div className="loading-overlay">
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "rgba(99, 102, 241, 0.1)",
              border: "1px solid var(--border-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "pulse-badge 2s infinite",
            }}
          >
            <span style={{ fontSize: "2rem" }}>🧠</span>
          </div>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ marginBottom: "var(--space-2)" }}>
              {currentStatus === "pending" ? "Queued" : "Generating..."}
            </h2>
            <p className="loading-text">
              {statusMessage || "Your question paper is being crafted by AI. Hang tight!"}
            </p>
          </div>
          <span className={`badge badge-status ${getStatusClass(currentStatus)}`}>
            {currentStatus.toUpperCase()}
          </span>
        </div>
      </main>
    );
  }

  // ── Failed State ──
  if (currentStatus === "failed") {
    return (
      <main style={{ minHeight: "100vh" }}>
        <div className="loading-overlay">
          <span style={{ fontSize: "3rem" }}>😞</span>
          <h2>Generation Failed</h2>
          <p className="loading-text" style={{ maxWidth: 400 }}>
            {statusMessage || currentAssignment?.errorMessage || "An unexpected error occurred."}
          </p>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <button className="btn btn-primary" onClick={handleRegenerate} disabled={isRegenerating}>
              {isRegenerating ? "Regenerating..." : "🔄 Try Again"}
            </button>
            <button className="btn btn-secondary" onClick={() => router.push("/create")}>
              ← New Assignment
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Completed – Render the Paper ──
  const paper = currentAssignment?.generatedPaper;
  if (!paper) {
    return (
      <main style={{ minHeight: "100vh" }}>
        <div className="loading-overlay">
          <p className="loading-text">No generated paper data available.</p>
          <button className="btn btn-primary" onClick={() => router.push("/create")}>
            ← Create New
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", padding: "var(--space-6)" }}>
      <div className="container" style={{ maxWidth: 960 }}>
        {/* Action Bar */}
        <div className="action-bar animate-fadeIn">
          <div className="action-bar-title">
            <span style={{ marginRight: "var(--space-2)" }}>📝</span>
            Generated Question Paper
          </div>
          <div className="action-bar-actions">
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              id="regenerate-btn"
            >
              {isRegenerating ? "⏳" : "🔄"} Regenerate
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleDownloadPDF}
              id="download-pdf-btn"
            >
              📥 Download PDF
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => router.push("/create")}
            >
              ＋ New
            </button>
          </div>
        </div>

        {/* Question Paper */}
        <div className="paper-container animate-scaleIn" id="question-paper">
          {/* Paper Header */}
          <div className="paper-header">
            <h1>{paper.title}</h1>
            <div className="paper-meta">
              <span className="paper-meta-item">
                <strong>Subject:</strong> {paper.subject}
              </span>
              <span className="paper-meta-item">
                <strong>Total Marks:</strong> {paper.totalMarks}
              </span>
              <span className="paper-meta-item">
                <strong>Duration:</strong> {paper.duration}
              </span>
            </div>
          </div>

          {/* Student Info Section */}
          <div className="student-info">
            <div className="student-info-field">
              <label>Name:</label>
              <div className="student-info-line" />
            </div>
            <div className="student-info-field">
              <label>Roll No:</label>
              <div className="student-info-line" />
            </div>
            <div className="student-info-field">
              <label>Section:</label>
              <div className="student-info-line" />
            </div>
          </div>

          {/* General Instructions */}
          {paper.generalInstructions && paper.generalInstructions.length > 0 && (
            <div className="general-instructions">
              <h3>General Instructions</h3>
              <ul>
                {paper.generalInstructions.map((instruction, i) => (
                  <li key={i}>{instruction}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Sections */}
          {paper.sections.map((section, sIdx) => (
            <div key={sIdx} className="section-block">
              <div className="section-header">
                <span className="section-title">{section.sectionTitle}</span>
                <span className="section-instruction">{section.instruction}</span>
              </div>
              {section.questions.map((question, qIdx) => (
                <div key={qIdx} className="question-item">
                  <span className="question-number">Q{question.questionNumber}.</span>
                  <div className="question-content">
                    <div className="question-text">{question.questionText}</div>

                    {/* MCQ Options */}
                    {question.options && question.options.length > 0 && (
                      <div className="question-options">
                        {question.options.map((option, oIdx) => (
                          <div key={oIdx} className="question-option">
                            {option}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Meta: Difficulty + Marks */}
                    <div className="question-meta">
                      <span className={`badge ${getDifficultyClass(question.difficulty)}`}>
                        {question.difficulty}
                      </span>
                      <span className="question-marks">{question.marks} marks</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
