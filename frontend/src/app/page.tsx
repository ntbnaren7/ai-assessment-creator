"use client";
import "@/styles/dashboard.css";
import "@/styles/create.css";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { AssignmentList } from "@/components/dashboard/AssignmentList";
import { useAssignmentStore } from "@/store/useAssignmentStore";
import { SpotlightSelectionCard, AssessmentType } from "@/components/create/SpotlightSelectionCard";

function DashboardContent() {
  const { assignments, isLoadingList, fetchAssignments } = useAssignmentStore();
  const searchParams = useSearchParams();
  const router = useRouter();

  const showCreate = searchParams.get("create") === "true";

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const handleSelectType = (type: AssessmentType) => {
    router.push(`/create?type=${type}`);
  };

  const handleCancelCreate = () => {
    const backUrl = searchParams.get("backUrl");
    if (backUrl) {
      router.push(backUrl);
    } else {
      router.push("/");
    }
  };

  return (
    <AppShell breadcrumb="Assignment" breadcrumbIcon="/assets/icons/icon-grid.svg">
      {isLoadingList ? (
        <div className="loading-overlay">
          <div className="spinner spinner-lg" />
          <p className="loading-text">Loading assignments...</p>
        </div>
      ) : assignments.length === 0 ? (
        <EmptyState />
      ) : (
        <AssignmentList
          assignments={assignments}
          onRefresh={fetchAssignments}
        />
      )}

      {showCreate && (
        <SpotlightSelectionCard onSelect={handleSelectType} onCancel={handleCancelCreate} />
      )}
    </AppShell>
  );
}

/**
 * Dashboard page – shows Empty State or Assignments List based on data.
 */
export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="loading-overlay"><div className="spinner spinner-lg" /></div>}>
      <DashboardContent />
    </Suspense>
  );
}
