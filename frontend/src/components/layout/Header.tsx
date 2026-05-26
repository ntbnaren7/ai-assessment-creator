"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useState } from "react";

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
  breadcrumbIcon = "/assets/icons/icon-grid.svg",
  onBack,
}: HeaderProps) {
  const router = useRouter();
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const handleImageError = (path: string) => {
    setFailedImages((prev) => ({ ...prev, [path]: true }));
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const isImagePath =
    breadcrumbIcon &&
    (breadcrumbIcon.startsWith("/") ||
      breadcrumbIcon.startsWith("http") ||
      breadcrumbIcon.startsWith("."));

  return (
    <header className="header">
      <div className="header-left">
        <button
          className="header-back-btn"
          onClick={handleBack}
          type="button"
          aria-label="Go back"
        >
          {failedImages["/assets/icons/icon-arrow-left.svg"] ? (
            "←"
          ) : (
            <Image
              src="/assets/icons/icon-arrow-left.svg"
              alt="Back"
              width={24}
              height={24}
              onError={() => handleImageError("/assets/icons/icon-arrow-left.svg")}
              style={{ objectFit: "contain" }}
            />
          )}
        </button>
        <div className="header-breadcrumb">
          <span className="header-breadcrumb-icon">
            {!isImagePath ? (
              breadcrumbIcon
            ) : failedImages[breadcrumbIcon] ? (
              "📋"
            ) : (
              <Image
                src={breadcrumbIcon}
                alt="Breadcrumb Icon"
                width={20}
                height={20}
                onError={() => handleImageError(breadcrumbIcon)}
                style={{ objectFit: "contain" }}
              />
            )}
          </span>
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
          {failedImages["/assets/icons/icon-bell.svg"] ? (
            "🔔"
          ) : (
            <Image
              src="/assets/icons/icon-bell.svg"
              alt="Notifications"
              width={24}
              height={24}
              onError={() => handleImageError("/assets/icons/icon-bell.svg")}
              style={{ objectFit: "contain" }}
            />
          )}
          <span className="header-notification-dot" />
        </button>

        {/* User Profile */}
        <div className="header-user">
          <div className="header-user-avatar" style={{ background: "none" }}>
            {failedImages["/assets/avatars/avatar-user.png"] ? (
              <div style={{ background: "linear-gradient(135deg, #FFB347, #FF6B6B)", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%" }}>JD</div>
            ) : (
              <Image
                src="/assets/avatars/avatar-user.png"
                alt="John Doe"
                width={32}
                height={32}
                onError={() => handleImageError("/assets/avatars/avatar-user.png")}
                style={{ borderRadius: "50%", objectFit: "cover" }}
              />
            )}
          </div>
          <span className="header-user-name">John Doe</span>
          <span className="header-user-chevron">
            {failedImages["/assets/icons/icon-chevron-down.svg"] ? (
              "▾"
            ) : (
              <Image
                src="/assets/icons/icon-chevron-down.svg"
                alt="Dropdown"
                width={20}
                height={20}
                onError={() => handleImageError("/assets/icons/icon-chevron-down.svg")}
                style={{ objectFit: "contain" }}
              />
            )}
          </span>
        </div>
      </div>
    </header>
  );
}
