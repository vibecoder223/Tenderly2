"use client";

import { useCallback } from "react";
import Sidebar from "./Sidebar";

export default function AppShell({
  user,
  orgName,
  children,
}: {
  user: { name: string; email: string };
  orgName: string;
  children: React.ReactNode;
}) {
  const openSidebar = useCallback(() => {
    window.dispatchEvent(new Event("sidebar-toggle"));
  }, []);

  return (
    <div className="app-shell">
      <Sidebar user={user} orgName={orgName} />
      <main className="app-main">
        {/* Inject hamburger trigger into topbar via context-free CSS button */}
        <div
          className="mobile-menu-btn"
          onClick={openSidebar}
          role="button"
          aria-label="Open menu"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && openSidebar()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </div>
        {children}
      </main>
    </div>
  );
}
