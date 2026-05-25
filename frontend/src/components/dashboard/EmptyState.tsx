"use client";

import Link from "next/link";

/**
 * Empty state view displayed when no assignments exist.
 * Shows an illustrative icon, description text, and a CTA button.
 */
export function EmptyState() {
  return (
    <div className="empty-state animate-fadeIn">
      {/* Illustration – styled document + magnifying glass + red X */}
      <div className="empty-state-illustration">
        <svg
          width="200"
          height="200"
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Document body */}
          <rect
            x="50"
            y="30"
            width="100"
            height="130"
            rx="8"
            fill="#F4F5F6"
            stroke="#E6E8EB"
            strokeWidth="2"
          />
          {/* Document lines */}
          <rect x="70" y="55" width="60" height="6" rx="3" fill="#D1D5DB" />
          <rect x="70" y="70" width="40" height="6" rx="3" fill="#D1D5DB" />
          <rect x="70" y="85" width="50" height="6" rx="3" fill="#E6E8EB" />
          <rect x="70" y="100" width="35" height="6" rx="3" fill="#E6E8EB" />

          {/* Pen swoosh */}
          <path
            d="M45 50 Q30 70 50 90"
            stroke="#1A1D1F"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
          <circle cx="50" cy="90" r="2" fill="#1A1D1F" />

          {/* Magnifying glass */}
          <circle
            cx="130"
            cy="115"
            r="25"
            fill="rgba(99, 102, 241, 0.06)"
            stroke="#D1D5DB"
            strokeWidth="2"
          />
          <line
            x1="148"
            y1="133"
            x2="162"
            y2="147"
            stroke="#D1D5DB"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Red X inside magnifying glass */}
          <line
            x1="122"
            y1="108"
            x2="138"
            y2="122"
            stroke="#EF4444"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <line
            x1="138"
            y1="108"
            x2="122"
            y2="122"
            stroke="#EF4444"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Small decorative dots */}
          <circle cx="45" cy="135" r="3" fill="#D1D5DB" />
          <circle cx="160" cy="80" r="2" fill="#E6E8EB" />
          <circle cx="155" cy="55" r="4" fill="#E6E8EB" />
        </svg>
      </div>

      <h3 className="empty-state-title">No assignments yet</h3>
      <p className="empty-state-description">
        Create your first assignment to start collecting and grading student
        submissions. You can set up rubrics, define marking criteria, and let AI
        assist with grading.
      </p>

      <Link href="/create">
        <button className="btn btn-primary btn-lg" type="button">
          + Create Your First Assignment
        </button>
      </Link>
    </div>
  );
}
