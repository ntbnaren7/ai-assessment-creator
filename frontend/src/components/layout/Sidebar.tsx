"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";

interface NavItem {
  label: string;
  icon: string;
  fallbackIcon: string;
  href: string;
  badge?: number | null;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Home",
    icon: "/assets/icons/icon-dashboard.svg",
    fallbackIcon: "⊞",
    href: "#",
  },
  {
    label: "My Groups",
    icon: "/assets/icons/icon-groups.svg",
    fallbackIcon: "👥",
    href: "#",
  },
  {
    label: "Assignments",
    icon: "/assets/icons/icon-assignments.svg",
    fallbackIcon: "📋",
    href: "/",
  },
  {
    label: "AI Teacher's Toolkit",
    icon: "/assets/icons/icon-toolkit.svg",
    fallbackIcon: "💻",
    href: "#",
  },
  {
    label: "My Library",
    icon: "/assets/icons/icon-library.svg",
    fallbackIcon: "⏱",
    href: "#",
    badge: 32,
  },
];

/**
 * Fixed left sidebar matching the VedaAI Figma design.
 * Contains logo, create button, navigation, settings, and school profile card.
 */
export function Sidebar() {
  const pathname = usePathname();
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const handleImageError = (path: string) => {
    setFailedImages((prev) => ({ ...prev, [path]: true }));
  };

  return (
    <aside className="sidebar">
      {/* Top Stack: Logo, Create Button, Navigation (Figma Frame 39962) */}
      <div className="sidebar-top">
        {/* Logo */}
        <div className="sidebar-logo">
          {failedImages["/assets/logos/logo-icon.ico"] ? (
            <div className="sidebar-logo-icon">V</div>
          ) : (
            <div className="sidebar-logo-icon" style={{ background: "none" }}>
              <Image
                src="/assets/logos/logo-icon.ico"
                alt="VedaAI Logo"
                width={40}
                height={40}
                onError={() => handleImageError("/assets/logos/logo-icon.ico")}
                style={{ objectFit: "contain", borderRadius: "8px" }}
              />
            </div>
          )}
          <span className="sidebar-logo-text">VedaAI</span>
        </div>

        {/* Create Assignment Button */}
        <Link href="/?create=true" style={{ textDecoration: "none" }}>
          <button className="sidebar-create-btn" type="button">
            {failedImages["/assets/icons/icon-sparkles.svg"] ? (
              <span>✦</span>
            ) : (
              <Image
                src="/assets/icons/icon-sparkles.svg"
                alt="Sparkles"
                width={18}
                height={18}
                onError={() => handleImageError("/assets/icons/icon-sparkles.svg")}
                style={{ objectFit: "contain" }}
              />
            )}
            + Create Assignment
          </button>
        </Link>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/" || pathname.startsWith("/output")
                : pathname === item.href;

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`sidebar-nav-item ${isActive ? "active" : ""}`}
              >
                <span className="sidebar-nav-icon">
                  {failedImages[item.icon] ? (
                    item.fallbackIcon
                  ) : (
                    <Image
                      src={item.icon}
                      alt={item.label}
                      width={20}
                      height={20}
                      onError={() => handleImageError(item.icon)}
                      style={{ objectFit: "contain" }}
                    />
                  )}
                </span>
                {item.label}
                {item.badge != null && (
                  <span className="sidebar-nav-badge">{item.badge}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Stack: Settings, Profile Card (Figma Frame 1984077460) */}
      <div className="sidebar-bottom">
        {/* Settings */}
        <button className="sidebar-nav-item" type="button">
          <span className="sidebar-nav-icon">
            {failedImages["/assets/icons/icon-settings.svg"] ? (
              "⚙"
            ) : (
              <Image
                src="/assets/icons/icon-settings.svg"
                alt="Settings"
                width={20}
                height={20}
                onError={() => handleImageError("/assets/icons/icon-settings.svg")}
                style={{ objectFit: "contain" }}
              />
            )}
          </span>
          Settings
        </button>

        {/* School Profile Card */}
        <div className="sidebar-profile">
          {failedImages["/assets/avatars/avatar-dps.png"] ? (
            <div className="sidebar-profile-avatar">DPS</div>
          ) : (
            <div className="sidebar-profile-avatar" style={{ background: "none" }}>
              <Image
                src="/assets/avatars/avatar-dps.png"
                alt="DPS Avatar"
                width={56}
                height={56}
                onError={() => handleImageError("/assets/avatars/avatar-dps.png")}
                style={{ borderRadius: "50%", objectFit: "cover" }}
              />
            </div>
          )}
          <div className="sidebar-profile-info">
            <div className="sidebar-profile-name">Delhi Public School</div>
            <div className="sidebar-profile-sub">Bokaro Steel City</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

