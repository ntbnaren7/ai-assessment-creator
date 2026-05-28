import React from "react";
import Image from "next/image";

export type AssessmentType = "school" | "college";

interface SpotlightSelectionCardProps {
  onSelect: (type: AssessmentType) => void;
  onCancel: () => void;
}

export function SpotlightSelectionCard({ onSelect, onCancel }: SpotlightSelectionCardProps) {
  // Prevent clicks inside the card from closing the overlay
  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div className="spotlight-overlay" onClick={onCancel}>
      <div className="spotlight-card" onClick={handleCardClick}>
        <button type="button" className="spotlight-close-btn" onClick={onCancel}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div className="spotlight-header">
          <h2>Select Assessment Type</h2>
          <p>Choose the context for your assessment to customize options</p>
        </div>

        <div className="option-grid">
          <div
            className="option-card"
            onClick={() => onSelect("school")}
          >
            <div className="option-content">
              <h3>School Exam</h3>
              <p>K-12 curriculums and grades</p>
            </div>
          </div>

          <div
            className="option-card"
            onClick={() => onSelect("college")}
          >
            <div className="option-content">
              <h3>College / University</h3>
              <p>Higher education, semesters, and modules</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
