"use client";

import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { AssignmentList } from "@/components/dashboard/AssignmentList";
import { useAssignmentStore } from "@/store/useAssignmentStore";

/**
 * Dashboard page – shows Empty State or Assignments List based on data.
 */
export default function DashboardPage() {
  const { assignments, isLoadingList, fetchAssignments } =
    useAssignmentStore();

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  return (
    <AppShell breadcrumb="Assignment" breadcrumbIcon="📋">
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
    </AppShell>
  );
}
