"use client";

import { useState } from "react";

type Activity = {
  action: string;
  entity_type: string;
  metadata?: { filename?: string; name?: string } | null;
  created_at: string;
};

export default function ActivityFeed({
  items,
  pageSize = 5,
}: {
  items: Activity[];
  pageSize?: number;
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const clamped = Math.min(page, pageCount - 1);
  const start = clamped * pageSize;
  const slice = items.slice(start, start + pageSize);

  // Pad to a fixed height so the card never jumps between pages.
  const pad = pageSize - slice.length;

  return (
    <>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {slice.map((a, i) => (
          <li
            key={start + i}
            style={{ padding: "10px 16px", borderBottom: "1px solid var(--divider)" }}
          >
            <div style={{ fontSize: 12.5, color: "var(--fg-2)" }}>
              {a.action}{" "}
              <span style={{ color: "var(--fg-4)" }}>{a.entity_type}</span>
              {a.metadata?.filename ? `: ${a.metadata.filename}` : ""}
              {a.metadata?.name ? `: ${a.metadata.name}` : ""}
            </div>
            <div className="meta-mono" style={{ marginTop: 2 }}>
              {new Date(a.created_at).toISOString().replace("T", " ").slice(0, 16)}
            </div>
          </li>
        ))}
        {Array.from({ length: pad }).map((_, i) => (
          <li
            key={`pad-${i}`}
            aria-hidden
            style={{ padding: "10px 16px", borderBottom: "1px solid var(--divider)", visibility: "hidden" }}
          >
            <div style={{ fontSize: 12.5 }}>&nbsp;</div>
            <div className="meta-mono" style={{ marginTop: 2 }}>&nbsp;</div>
          </li>
        ))}
      </ul>

      {pageCount > 1 && (
        <div
          className="flex items-center justify-center gap-1"
          style={{ padding: "10px 16px" }}
        >
          <PagerBtn
            disabled={clamped === 0}
            onClick={() => setPage(clamped - 1)}
            label="‹"
          />
          {Array.from({ length: pageCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPage(i)}
              className="mono"
              style={{
                minWidth: 24,
                height: 24,
                fontSize: 11.5,
                fontWeight: i === clamped ? 600 : 400,
                borderRadius: 5,
                border: "1px solid " + (i === clamped ? "var(--accent)" : "var(--border)"),
                background: i === clamped ? "var(--accent-tint)" : "transparent",
                color: i === clamped ? "var(--accent-2)" : "var(--fg-4)",
                cursor: "pointer",
              }}
            >
              {i + 1}
            </button>
          ))}
          <PagerBtn
            disabled={clamped === pageCount - 1}
            onClick={() => setPage(clamped + 1)}
            label="›"
          />
        </div>
      )}
    </>
  );
}

function PagerBtn({
  disabled,
  onClick,
  label,
}: {
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="mono"
      style={{
        minWidth: 24,
        height: 24,
        fontSize: 13,
        borderRadius: 5,
        border: "1px solid var(--border)",
        background: "transparent",
        color: "var(--fg-4)",
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {label}
    </button>
  );
}
