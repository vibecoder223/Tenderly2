"use client";

import { useState } from "react";

export type CitationItem = {
  id: string;
  document_filename: string;
  section_path: string | null;
  page: number | null;
  quote: string | null;
};

export function ConfidenceBar({ value }: { value: number | null }) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  const color =
    value >= 0.7 ? "var(--ok)" : value >= 0.4 ? "var(--warn)" : "var(--err)";
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11.5px]" style={{ color: "var(--fg-4)" }}>
        Confidence
      </span>
      <div
        className="rounded-full"
        style={{ width: 80, height: 6, background: "var(--bg-2)" }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            borderRadius: 999,
          }}
        />
      </div>
      <span className="num text-[11.5px]" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

export function GapBadge({ flag }: { flag: string | null }) {
  if (!flag) return null;
  if (flag === "ok") return <span className="badge badge-ok">Grounded</span>;
  if (flag === "partial")
    return <span className="badge badge-warn">Partial coverage</span>;
  if (flag === "no_source")
    return <span className="badge badge-err">No source</span>;
  return null;
}

export function NoSourceBanner({ flag }: { flag: string | null }) {
  if (flag !== "no_source") return null;
  return (
    <div
      className="card p-3 text-[12.5px]"
      style={{ borderColor: "var(--err-tint)", background: "var(--err-tint)", color: "var(--err)" }}
    >
      <strong>No source found.</strong> The knowledge base did not contain content
      sufficient to ground an answer. Human review is required before submission.
    </div>
  );
}

export function CitationList({ citations }: { citations: CitationItem[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!citations || citations.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <div
        className="text-[11.5px] uppercase tracking-wider font-semibold"
        style={{ color: "var(--fg-5)" }}
      >
        Sources ({citations.length})
      </div>
      <div className="flex flex-wrap gap-1.5">
        {citations.map((c) => (
          <button
            key={c.id}
            onClick={() => setOpen(open === c.id ? null : c.id)}
            className="badge badge-accent"
            style={{ cursor: "pointer" }}
            title={c.quote || ""}
          >
            <span className="mono text-[11px]">
              {c.document_filename}
              {c.page != null ? ` · p.${c.page}` : ""}
            </span>
          </button>
        ))}
      </div>
      {open && (
        <div
          className="card p-3 text-[12.5px] mt-2"
          style={{ background: "var(--bg-2)" }}
        >
          {(() => {
            const c = citations.find((x) => x.id === open);
            if (!c) return null;
            return (
              <>
                <div
                  className="text-[11px] mb-1"
                  style={{ color: "var(--fg-4)" }}
                >
                  {c.document_filename}
                  {c.section_path ? ` › ${c.section_path}` : ""}
                  {c.page != null ? ` · page ${c.page}` : ""}
                </div>
                <div
                  className="italic"
                  style={{ color: "var(--fg-2)", borderLeft: "2px solid var(--accent-line)", paddingLeft: 10 }}
                >
                  {c.quote || "(no quote captured)"}
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
