"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useState } from "react";

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const pathname = usePathname();
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const handleImageError = (path: string) => {
    setFailedImages((prev) => ({ ...prev, [path]: true }));
  };

  const navItems = [
    { name: "My Groups", path: "/groups", icon: "/assets/icons/icon-groups.svg" },
    { name: "Assignments", path: "/assignments", icon: "/assets/icons/icon-assignments.svg" },
    { name: "AI Teacher's Toolkit", path: "/toolkit", icon: "/assets/icons/icon-toolkit.svg" },
    { name: "My Library", path: "/library", icon: "/assets/icons/icon-library.svg" },
    { name: "Settings", path: "/settings", icon: "/assets/icons/icon-settings.svg" },
  ];

  if (!isOpen) return null;

  return (
    <div className="mobile-drawer-overlay" onClick={onClose}>
      <div className="mobile-drawer-content" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-drawer-header">
          <div className="mobile-header-logo">
            {failedImages["/assets/logos/logo-icon.ico"] ? (
              <div className="mobile-header-logo-icon">V</div>
            ) : (
              <div className="mobile-header-logo-icon" style={{ background: "none" }}>
                <Image
                  src="/assets/logos/logo-icon.ico"
                  alt="VedaAI Logo"
                  width={32}
                  height={32}
                  onError={() => handleImageError("/assets/logos/logo-icon.ico")}
                  style={{ objectFit: "contain", borderRadius: "8px" }}
                />
              </div>
            )}
            <span className="mobile-header-logo-text">VedaAI</span>
          </div>
          <button className="mobile-drawer-close" onClick={onClose} aria-label="Close menu">
            ✕
          </button>
        </div>

        <nav className="mobile-drawer-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`mobile-drawer-nav-item ${pathname === item.path ? "active" : ""}`}
              onClick={onClose}
            >
              <span className="mobile-drawer-nav-icon">
                {failedImages[item.icon] ? (
                  "•"
                ) : (
                  <Image
                    src={item.icon}
                    alt={item.name}
                    width={20}
                    height={20}
                    onError={() => handleImageError(item.icon)}
                  />
                )}
              </span>
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="mobile-drawer-footer">
          <div className="mobile-drawer-user">
            <div className="mobile-drawer-user-avatar" style={{ background: "none" }}>
              {failedImages["/assets/avatars/avatar-user.png"] ? (
                <div style={{ background: "linear-gradient(135deg, #FFB347, #FF6B6B)", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%" }}>JD</div>
              ) : (
                <Image
                  src="/assets/avatars/avatar-user.png"
                  alt="John Doe"
                  width={40}
                  height={40}
                  onError={() => handleImageError("/assets/avatars/avatar-user.png")}
                  style={{ borderRadius: "50%", objectFit: "cover" }}
                />
              )}
            </div>
            <div className="mobile-drawer-user-info">
              <span className="mobile-drawer-user-name">John Doe</span>
              <span className="mobile-drawer-user-role">Teacher</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
