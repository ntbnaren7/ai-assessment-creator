"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  icon: string;
  href: string;
  badge?: number | null;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home", icon: "⊞", href: "#" },
  { label: "My Groups", icon: "👥", href: "#" },
  { label: "Assignments", icon: "📋", href: "/", badge: 10 },
  { label: "AI Teacher's Toolkit", icon: "💻", href: "#" },
  { label: "My Library", icon: "⏱", href: "#" },
];

/**
 * Fixed left sidebar matching the VedaAI Figma design.
 * Contains logo, create button, navigation, settings, and school profile card.
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">V</div>
        <span className="sidebar-logo-text">VedaAI</span>
      </div>

      {/* Create Assignment Button */}
      <Link href="/create" style={{ textDecoration: "none" }}>
        <button className="sidebar-create-btn" type="button">
          <span>✦</span>
          {pathname === "/create"
            ? "AI Teacher\u2019s Toolkit"
            : "Create Assignment"}
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
              <span className="sidebar-nav-icon">{item.icon}</span>
              {item.label}
              {item.badge != null && (
                <span className="sidebar-nav-badge">{item.badge}</span>
              )}
            </Link>
          );
        })}

        <div className="sidebar-divider" />

        {/* Settings */}
        <div className="sidebar-settings">
          <button className="sidebar-nav-item" type="button">
            <span className="sidebar-nav-icon">⚙</span>
            Settings
          </button>
        </div>
      </nav>

      {/* School Profile Card */}
      <div className="sidebar-profile">
        <div className="sidebar-profile-avatar">DPS</div>
        <div className="sidebar-profile-info">
          <div className="sidebar-profile-name">Delhi Public School</div>
          <div className="sidebar-profile-sub">Bokaro Steel City</div>
        </div>
      </div>
    </aside>
  );
}
