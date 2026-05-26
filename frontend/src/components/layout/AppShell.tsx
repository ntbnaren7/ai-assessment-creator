"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MobileHeader } from "./MobileHeader";
import { MobileDrawer } from "./MobileDrawer";
import { MobileNavBar } from "./MobileNavBar";
import { MobileFAB } from "./MobileFAB";

interface AppShellProps {
  children: React.ReactNode;
  breadcrumb?: string;
  breadcrumbIcon?: string;
  onBack?: () => void;
  className?: string;
}

/**
 * Global app shell that wraps every page.
 * Provides the fixed sidebar, sticky header, and content area.
 */
export function AppShell({
  children,
  breadcrumb = "Assignment",
  breadcrumbIcon = "📋",
  onBack,
  className = "",
}: AppShellProps) {
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  return (
    <div className={`app-shell ${className}`.trim()}>
      {/* Desktop Components */}
      <Sidebar />
      <div className="main-content">
        <Header
          breadcrumb={breadcrumb}
          breadcrumbIcon={breadcrumbIcon}
          onBack={onBack}
        />
        
        {/* Mobile Components */}
        <MobileHeader onMenuClick={() => setIsMobileDrawerOpen(true)} />
        <MobileDrawer 
          isOpen={isMobileDrawerOpen} 
          onClose={() => setIsMobileDrawerOpen(false)} 
        />
        
        <div className="page-content">{children}</div>
        
        <MobileFAB />
        <MobileNavBar />
      </div>
    </div>
  );
}
