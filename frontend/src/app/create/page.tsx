"use client";
import "@/styles/create.css";

import { useEffect, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ProgressStep } from "@/components/create/ProgressStep";

import { SchoolAssessmentForm } from "@/components/create/SchoolAssessmentForm";
import { CollegeAssessmentForm } from "@/components/create/CollegeAssessmentForm";

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
        <button className="btn-mobile-back show-on-mobile-flex" onClick={() => router.push("/")} aria-label="Go back">
          <Image src="/assets/icons/icon-arrow-prev.svg" alt="Back" width={16} height={16} />
        </button>
        <h2>
          <span className="status-dot active hide-on-desktop-dot" />
          <span className="hide-on-mobile">Create {assessmentType.charAt(0).toUpperCase() + assessmentType.slice(1)} Assignment</span>
          <span className="show-on-mobile">Create Assignment</span>
        </h2>
        <p className="hide-on-mobile">
          Set up a new assignment for your students
        </p>
      </div>

      <div className="create-page-container">
        {/* Progress Bar */}
        <ProgressStep progress={50} />

        {/* Form */}
        {assessmentType === "school" && <SchoolAssessmentForm onCancel={handleCancel} />}
        {assessmentType === "college" && <CollegeAssessmentForm onCancel={handleCancel} />}
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
