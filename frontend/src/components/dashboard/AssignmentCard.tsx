"use client";

import { useState, useRef, useEffect } from "react";
import type { Assignment } from "@/types";

interface AssignmentCardProps {
  assignment: Assignment;
  onView: (id: string) => void;
  onDelete: (id: string) => void;
}

export function AssignmentCard({
  assignment,
  onView,
  onDelete,
}: AssignmentCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return dateStr;
    }
  };

  const formatGrade = (gradeStr: string | undefined) => {
    if (!gradeStr) return "";
    let g = gradeStr.trim();
    
    // For school, if it's just "12th" or "10" etc
    const isJustGrade = /^\d+(st|nd|rd|th)?$/i.test(g) || /^Class\s+\d+/i.test(g);
    if (isJustGrade) {
      return `Grade: ${g}`;
    }
    
    return g;
  };

  return (
    <div className="assignment-card premium-card" ref={menuRef}>
      
      <div className="assignment-card-header">
        <div>
          <h4 className="assignment-card-title">{assignment.subject || assignment.title}</h4>
          <span className="assignment-card-grade">{formatGrade(assignment.grade)}</span>
        </div>
        
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

        {menuOpen && (
          <div className="assignment-card-dropdown">
            <button className="assignment-card-dropdown-item" onClick={() => { setMenuOpen(false); onView(assignment._id); }}>
              View Assignment
            </button>
            <button className="assignment-card-dropdown-item danger" onClick={() => { setMenuOpen(false); onDelete(assignment._id); }}>
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="assignment-card-footer">
        <div className="date-info">
          <span className="date-label">Assigned on</span>
          <span className="date-value"> : {formatDate(assignment.createdAt)}</span>
        </div>
        {assignment.dueDate && (
          <div className="date-info">
            <span className="date-label">Due</span>
            <span className="date-value"> : {formatDate(assignment.dueDate)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
