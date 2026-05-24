"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Shown on deal pages when the org has zero ready knowledge documents.
 * AI drafts retrieve from this corpus; without it answers are useless.
 * Dismissable per browser session; reappears next visit if KB still empty.
 */
export default function KnowledgeEmptyBanner() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const dismissed = sessionStorage.getItem("kb-empty-dismissed") === "1";
    setHidden(dismissed);
  }, []);

  if (hidden) return null;

  return (
    <div
      role="status"
      style={{
        margin: "12px 32px 0",
        padding: "11px 14px 11px 16px",
        background: "var(--warn-tint)",
        border: "1px solid oklch(0.85 0.10 71)",
        borderRadius: "var(--r-md)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontSize: 13,
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--warn)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: "var(--warn)", lineHeight: 1.3 }}>
          Your knowledge base is empty
        </div>
        <div style={{ color: "var(--fg-3)", marginTop: 2, lineHeight: 1.45 }}>
          AI drafts retrieve answers from your past proposals, policies, and security docs.
          Without source material, drafts will be poor or empty.
        </div>
      </div>
      <Link
        href="/knowledge"
        className="btn btn-primary"
        style={{ flexShrink: 0, height: 30, fontSize: 12.5 }}
      >
        Open knowledge base
      </Link>
      <button
        onClick={() => {
          sessionStorage.setItem("kb-empty-dismissed", "1");
          setHidden(true);
        }}
        aria-label="Dismiss"
        style={{
          width: 24,
          height: 24,
          borderRadius: 5,
          border: "none",
          background: "transparent",
          color: "var(--fg-4)",
          cursor: "pointer",
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "oklch(0.97 0.04 71 / 0.5)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
