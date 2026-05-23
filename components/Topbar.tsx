import React from "react";

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
        background: "var(--surface)",
        borderColor: "var(--border)",
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
      <div className="flex items-center gap-2 text-[13px] font-medium" style={{ color: "var(--fg-4)" }}>
        {crumbs}
      </div>
      <div className="ml-auto flex items-center gap-2">{actions}</div>
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
