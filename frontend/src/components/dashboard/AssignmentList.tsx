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

export function AssignmentList({
  assignments,
  onRefresh,
}: AssignmentListProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = assignments.filter((a) => {
    // Hide legacy competitive exams (database wipe script is sandboxed)
    if (a.grade && a.grade.toLowerCase().includes("competitive")) return false;
    
    const search = searchQuery.toLowerCase();
    const titleMatch = a.title && a.title.toLowerCase().includes(search);
    const subjectMatch = a.subject && a.subject.toLowerCase().includes(search);
    
    return titleMatch || subjectMatch;
  });

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
    <div className="animate-fadeIn dashboard-content">
      {/* Dashboard Header */}
      <div className="dashboard-header-modern">
        <div className="dashboard-title-group">
          <button 
            className="mobile-back-btn show-on-mobile" 
            onClick={() => {}} 
            type="button" 
            aria-label="Back placeholder"
            style={{ cursor: 'default' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="back-arrow-icon">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
          <div className="dashboard-title-wrapper">
            <div className="status-green-dot">
              <div className="status-green-dot-inner" />
            </div>
            <div className="dashboard-title-text-group">
              <h2 className="dashboard-title-modern">
                Assignments
              </h2>
              <p className="dashboard-subtitle-modern">
                Manage and create assignments for your classes.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Filter & Search Bar */}
      <div className="modern-toolbar">
        <div className="modern-toolbar-left">
          <button className="modern-filter-btn" type="button">
            <img 
              src="/assets/icons/icon-filter.svg" 
              alt="Filter" 
              className="svg-icon" 
              onError={(e) => { e.currentTarget.src = 'data:image/svg+xml;utf8,<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>'; }} 
            />
            <span className="hide-on-mobile">Filter By</span>
            <span className="show-on-mobile">Filter</span>
          </button>
        </div>
        <div className="modern-search-wrap">
          <img 
            src="/assets/icons/icon-search.svg" 
            alt="Search" 
            className="search-icon svg-icon" 
            onError={(e) => { e.currentTarget.src = 'data:image/svg+xml;utf8,<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>'; }} 
          />
          <input
            className="modern-search-input"
            type="text"
            placeholder="Search Name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Cards Grid */}
      <div className="modern-assignments-grid">
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
        <div className="modern-empty-search">
          <p>No assignments match &ldquo;{searchQuery}&rdquo;</p>
        </div>
      )}

      {/* Floating Create Button & Fade */}
      <div className="modern-floating-action">
        <Link href="/create" className="modern-create-btn">
          <img src="/assets/icons/icon-plus.svg" alt="Create" className="create-plus-icon" /> Create Assignment
        </Link>
      </div>
    </div>
  );
}
