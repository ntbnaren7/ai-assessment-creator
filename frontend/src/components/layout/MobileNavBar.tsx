"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useState } from "react";

export function MobileNavBar() {
  const pathname = usePathname();
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const handleImageError = (path: string) => {
    setFailedImages((prev) => ({ ...prev, [path]: true }));
  };

  const navItems = [
    { name: "Home", path: "#home", icon: "/assets/icons/icon-nav-home.svg" },
    { name: "Assignments", path: "/", icon: "/assets/icons/icon-nav-assignments.svg" },
    { name: "Library", path: "#library", icon: "/assets/icons/icon-nav-library.svg" },
    { name: "AI Toolkit", path: "#toolkit", icon: "/assets/icons/icon-nav-toolkit.svg" },
  ];

  return (
    <nav className="mobile-navbar">
      {navItems.map((item) => {
        const isActive =
          item.path === "/"
            ? pathname === "/" || pathname.startsWith("/output")
            : pathname === item.path;

        return (
          <Link
            key={item.name}
            href={item.path}
            className={`mobile-navbar-item ${isActive ? "active" : ""}`}
          >
            <span className="mobile-navbar-icon">
              {failedImages[item.icon] ? (
                "•"
              ) : (
                <Image
                  src={item.icon}
                  alt={item.name}
                  width={24}
                  height={24}
                  onError={() => handleImageError(item.icon)}
                />
              )}
            </span>
            <span className="mobile-navbar-label">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
