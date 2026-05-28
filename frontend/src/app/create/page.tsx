"use client";
import "@/styles/create.css";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ProgressStep } from "@/components/create/ProgressStep";

import { SchoolAssessmentForm } from "@/components/create/SchoolAssessmentForm";
import { CollegeAssessmentForm } from "@/components/create/CollegeAssessmentForm";
import { CompetitiveAssessmentForm } from "@/components/create/CompetitiveAssessmentForm";

function CreatePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assessmentType = searchParams.get("type");

  useEffect(() => {
    if (!assessmentType) {
      router.replace("/?create=true");
    }
  }, [assessmentType, router]);

  const handleCancel = () => router.push(`/?create=true&backUrl=${encodeURIComponent("/create?type=" + assessmentType)}`);

  if (!assessmentType) {
    return null; // Will redirect
  }

  return (
    <AppShell
      breadcrumb="Assignment"
      breadcrumbIcon=""
      onBack={() => router.push("/")}
      className="create-page-shell"
    >
      {/* Page Header */}
      <div className="create-page-header animate-fadeIn">
        <h2>
          <span className="status-dot active" />
          Create {assessmentType.charAt(0).toUpperCase() + assessmentType.slice(1)} Assignment
        </h2>
        <p>
          Set up a new assignment for your students
        </p>
      </div>

      <div className="create-page-container">
        {/* Progress Bar */}
        <ProgressStep progress={50} />

        {/* Form */}
        {assessmentType === "school" && <SchoolAssessmentForm onCancel={handleCancel} />}
        {assessmentType === "college" && <CollegeAssessmentForm onCancel={handleCancel} />}
        {assessmentType === "competitive" && <CompetitiveAssessmentForm onCancel={handleCancel} />}
      </div>
    </AppShell>
  );
}

export default function CreateAssignmentPage() {
  return (
    <Suspense fallback={<div className="loading-overlay"><div className="spinner spinner-lg" /></div>}>
      <CreatePageContent />
    </Suspense>
  );
}
