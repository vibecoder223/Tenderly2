"use client";

import React from "react";
import Link from "next/link";

export default function Topbar({
  crumbs,
  actions,
  onMenuClick,
}: {
  crumbs: React.ReactNode;
  actions?: React.ReactNode;
  onMenuClick?: () => void;
}) {
  return (
    <header
      className="sticky top-0 z-20 flex items-center gap-3 border-b"
      style={{
        height: "var(--topbar)",
        background: "var(--bg)",
        borderColor: "var(--divider)",
        paddingLeft: 16,
        paddingRight: 20,
      }}
    >
      {/* Hamburger — only visible on mobile via CSS */}
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          aria-label="Open menu"
          className="sidebar-toggle btn btn-ghost"
          style={{ padding: 6, height: 32, width: 32, flexShrink: 0, display: "none" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      )}
      <div className="crumbs">{crumbs}</div>
      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/search"
          aria-label="Quick find"
          className="quick-find"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            height: 26,
            borderRadius: 6,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            fontSize: 11.5,
            color: "var(--fg-4)",
            textDecoration: "none",
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
            transition: "border-color 100ms",
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className="quick-find-label">Quick find</span>
          <span className="kbd quick-find-kbd">⌘K</span>
        </Link>
        {actions}
      </div>
    </header>
  );
}

export function Crumb({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return last ? (
    <b style={{ color: "var(--fg)", fontWeight: 600 }}>{children}</b>
  ) : (
    <>
      <span>{children}</span>
      <span style={{ color: "var(--fg-5)" }}>/</span>
    </>
  );
}
