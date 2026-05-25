"use client";

import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface AppShellProps {
  children: React.ReactNode;
  breadcrumb?: string;
  breadcrumbIcon?: string;
  onBack?: () => void;
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
}: AppShellProps) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Header
          breadcrumb={breadcrumb}
          breadcrumbIcon={breadcrumbIcon}
          onBack={onBack}
        />
        <div className="page-content">{children}</div>
      </div>
    </div>
  );
}
