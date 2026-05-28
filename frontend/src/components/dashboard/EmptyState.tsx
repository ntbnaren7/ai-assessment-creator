"use client";

import Image from "next/image";
import Link from "next/link";

/**
 * Empty state view displayed when no assignments exist.
 * Shows an illustrative icon, description text, and a CTA button.
 */
export function EmptyState() {
  return (
    <div className="empty-state animate-fadeIn">
      <div className="empty-state-illustration">
        <Image
          src="/assets/illustrations/illustrations-empty.svg"
          alt="No assignments yet"
          width={300}
          height={300}
          style={{ objectFit: "contain" }}
        />
      </div>

      <h3 className="empty-state-title">No assignments yet</h3>
      <p className="empty-state-description">
        Create your first assignment to start collecting and grading student
        submissions. You can set up rubrics, define marking criteria, and let AI
        assist with grading.
      </p>

      <Link href="/?create=true" style={{ textDecoration: "none" }}>
        <button className="empty-state-btn" type="button">
          <Image
            src="/assets/icons/icon-plus.svg"
            alt="Plus"
            width={16}
            height={16}
            style={{ objectFit: "contain" }}
          />
          Create Your First Assignment
        </button>
      </Link>
    </div>
  );
}
