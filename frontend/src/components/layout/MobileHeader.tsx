"use client";

import Image from "next/image";
import { useState } from "react";

interface MobileHeaderProps {
  onMenuClick: () => void;
}

export function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const handleImageError = (path: string) => {
    setFailedImages((prev) => ({ ...prev, [path]: true }));
  };

  return (
    <header className="mobile-header">
      <div className="mobile-header-left">
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
      </div>

      <div className="mobile-header-right">
        <button className="mobile-header-notification" type="button" aria-label="Notifications">
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
          <span className="mobile-header-notification-dot" />
        </button>

        <div className="mobile-header-user-avatar" style={{ background: "none" }}>
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

        <button className="mobile-header-menu" type="button" aria-label="Menu" onClick={onMenuClick}>
          {failedImages["/assets/icons/icon-menu.svg"] ? (
            "☰"
          ) : (
            <Image
              src="/assets/icons/icon-menu.svg"
              alt="Menu"
              width={24}
              height={24}
              onError={() => handleImageError("/assets/icons/icon-menu.svg")}
              style={{ objectFit: "contain" }}
            />
          )}
        </button>
      </div>
    </header>
  );
}
