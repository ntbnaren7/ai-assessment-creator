"use client";

import { useRouter } from "next/navigation";

interface HeaderProps {
  breadcrumb?: string;
  breadcrumbIcon?: string;
  onBack?: () => void;
}

/**
 * Sticky header bar with back button, breadcrumb, notification bell, and user dropdown.
 */
export function Header({
  breadcrumb = "Assignment",
  breadcrumbIcon = "📋",
  onBack,
}: HeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <header className="header">
      <div className="header-left">
        <button
          className="header-back-btn"
          onClick={handleBack}
          type="button"
          aria-label="Go back"
        >
          ←
        </button>
        <div className="header-breadcrumb">
          <span className="header-breadcrumb-icon">{breadcrumbIcon}</span>
          {breadcrumb}
        </div>
      </div>

      <div className="header-right">
        {/* Notification Bell */}
        <button
          className="header-notification"
          type="button"
          aria-label="Notifications"
        >
          🔔
          <span className="header-notification-dot" />
        </button>

        {/* User Profile */}
        <div className="header-user">
          <div className="header-user-avatar">JD</div>
          <span className="header-user-name">John Doe</span>
          <span className="header-user-chevron">▾</span>
        </div>
      </div>
    </header>
  );
}
