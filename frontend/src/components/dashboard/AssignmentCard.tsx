"use client";

import { useState, useRef, useEffect } from "react";
import type { Assignment } from "@/types";

interface AssignmentCardProps {
  assignment: Assignment;
  onView: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * Individual assignment card with title, dates, and a three-dot popover menu.
 */
export function AssignmentCard({
  assignment,
  onView,
  onDelete,
}: AssignmentCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="assignment-card" ref={menuRef}>
      <div className="assignment-card-top">
        <h4 className="assignment-card-title">{assignment.title}</h4>
        <button
          className="assignment-card-menu-btn"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((prev) => !prev);
          }}
          aria-label="Card actions"
        >
          ⋮
        </button>
      </div>

      {/* Popover menu */}
      {menuOpen && (
        <div className="assignment-card-dropdown">
          <button
            className="assignment-card-dropdown-item"
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onView(assignment._id);
            }}
          >
            View Assignment
          </button>
          <button
            className="assignment-card-dropdown-item danger"
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onDelete(assignment._id);
            }}
          >
            Delete
          </button>
        </div>
      )}

      <div className="assignment-card-footer">
        <span className="assignment-card-date">
          Assigned on : <strong>{formatDate(assignment.createdAt)}</strong>
        </span>
        <span className="assignment-card-date">
          Due : <strong>{formatDate(assignment.dueDate)}</strong>
        </span>
      </div>
    </div>
  );
}
