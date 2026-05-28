"use client";
import "@/styles/output.css";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { BannerCallout } from "@/components/output/BannerCallout";
import { QuestionPaperSheet } from "@/components/output/QuestionPaperSheet";
import { LoadingState } from "@/components/output/LoadingState";
import { FailedState } from "@/components/output/FailedState";
import { useAssignmentStore } from "@/store/useAssignmentStore";
import { useWebSocket } from "@/hooks/useWebSocket";
import { GothicLoader } from "@/components/output/GothicLoader";

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
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");

    const paperElement = document.getElementById("question-paper");
    if (!paperElement) return;

    const canvas = await html2canvas(paperElement, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#FFFFFF",
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

  // ── Loading ──
  if (isLoading) {
    return (
      <AppShell breadcrumb="Assignment" breadcrumbIcon="/assets/icons/icon-grid.svg">
        <div className="loading-overlay">
          <div className="spinner spinner-lg" />
          <p className="loading-text">Loading assignment...</p>
        </div>
      </AppShell>
    );
  }

  // ── Pending ──
  if (currentStatus === "pending") {
    return (
      <AppShell breadcrumb="Assignment" breadcrumbIcon="/assets/icons/icon-grid.svg">
        <LoadingState
          status={currentStatus}
          message={statusMessage || undefined}
        />
      </AppShell>
    );
  }

  // ── Processing (Gothic Loader) ──
  if (currentStatus === "processing") {
    return (
      <AppShell breadcrumb="Assignment" breadcrumbIcon="/assets/icons/icon-grid.svg">
        <GothicLoader />
      </AppShell>
    );
  }

  // ── Failed ──
  if (currentStatus === "failed") {
    return (
      <AppShell breadcrumb="Assignment" breadcrumbIcon="/assets/icons/icon-grid.svg">
        <FailedState
          message={
            statusMessage || currentAssignment?.errorMessage || undefined
          }
          onRetry={handleRegenerate}
          onNew={() => router.push("/?create=true")}
          isRetrying={isRegenerating}
        />
      </AppShell>
    );
  }

  // ── Completed ──
  const paper = currentAssignment?.generatedPaper;
  if (!paper) {
    return (
      <AppShell breadcrumb="Assignment" breadcrumbIcon="/assets/icons/icon-grid.svg">
        <div className="loading-overlay">
          <p className="loading-text">No generated paper data available.</p>
          <button
            className="btn btn-primary"
            onClick={() => router.push("/?create=true")}
            type="button"
          >
            ← Create New
          </button>
        </div>
      </AppShell>
    );
  }

  // Build the callout message
  const calloutMessage = `Certainly, ${
    "Lakshya"
  }! Here are customized Question Paper for your ${
    currentAssignment?.grade ? `Grade ${currentAssignment.grade}` : ""
  } ${currentAssignment?.subject || ""} classes:`;

  return (
    <AppShell
      breadcrumb="Create New"
      breadcrumbIcon="/assets/icons/icon-sparkles.svg"
      onBack={() => router.push("/")}
    >
      <div className="output-page-wrapper">
        {/* Dark Banner */}
        <BannerCallout
          message={calloutMessage}
          onDownloadPDF={handleDownloadPDF}
        />

        {/* Question Paper Sheet */}
        <QuestionPaperSheet
          paper={paper}
          title={currentAssignment?.title}
          grade={currentAssignment?.grade}
        />
      </div>
    </AppShell>
  );
}
