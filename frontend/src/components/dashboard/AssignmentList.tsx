"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AssignmentCard } from "./AssignmentCard";
import type { Assignment } from "@/types";
import * as api from "@/services/api";

interface AssignmentListProps {
  assignments: Assignment[];
  onRefresh: () => void;
}

/**
 * Full assignment list view with header, filter/search toolbar, 2-column grid, and floating create button.
 */
export function AssignmentList({
  assignments,
  onRefresh,
}: AssignmentListProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = assignments.filter((a) =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleView = (id: string) => {
    router.push(`/output/${id}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this assignment?")) return;
    try {
      await api.deleteAssignment(id);
      onRefresh();
    } catch (err) {
      console.error("Failed to delete assignment:", err);
    }
  };

  return (
    <div className="animate-fadeIn">
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <div className="dashboard-title-group">
          <h2 className="dashboard-title">
            <span className="status-dot active" />
            Assignments
          </h2>
          <p className="dashboard-subtitle">
            Manage and create assignments for your classes.
          </p>
        </div>
      </div>

      {/* Toolbar: Filter + Search */}
      <div className="dashboard-toolbar">
        <button className="filter-btn" type="button">
          <span>🔽</span>
          Filter By
        </button>
        <div className="search-input-wrap">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            type="text"
            placeholder="Search Assignment"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Cards Grid */}
      <div className="assignments-grid">
        {filtered.map((assignment) => (
          <AssignmentCard
            key={assignment._id}
            assignment={assignment}
            onView={handleView}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {filtered.length === 0 && searchQuery && (
        <p
          style={{
            textAlign: "center",
            padding: "var(--space-10)",
            color: "var(--text-muted)",
          }}
        >
          No assignments match &ldquo;{searchQuery}&rdquo;
        </p>
      )}

      {/* Floating Create Button */}
      <div className="floating-create-btn">
        <Link href="/create">
          <button className="btn btn-primary btn-lg" type="button">
            + Create Assignment
          </button>
        </Link>
      </div>
    </div>
  );
}
