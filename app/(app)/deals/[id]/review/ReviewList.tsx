"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import {
  ConfidenceBar,
  GapBadge,
  NoSourceBanner,
  CitationList,
  type CitationItem,
} from "@/components/CitationChips";

type Item = {
  id: string;
  requirement_id: string | null;
  question_text: string;
  status: string;
  responses: {
    id: string;
    draft_text: string | null;
    final_text: string | null;
    status: string;
    confidence: number | null;
    gap_flag: string | null;
    citations: CitationItem[];
  }[];
};

export default function ReviewList({ items }: { items: Item[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "needs_review" | "approved">("all");

  async function decide(item: Item, decision: "approve" | "reject", text?: string) {
    const r = item.responses[0];
    if (!r) return;
    setBusyId(r.id);
    await fetch(`/api/responses/${r.id}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, final_text: text }),
    });
    setBusyId(null);
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <div className="card p-10 text-center text-sm" style={{ color: "var(--fg-4)" }}>
        Nothing submitted for review yet.
      </div>
    );
  }

  const filtered = items.filter((it) => {
    const r = it.responses[0];
    if (filter === "approved") return it.status === "approved";
    if (filter === "needs_review")
      return (
        it.status !== "approved" ||
        (r?.confidence != null && r.confidence < 0.7) ||
        r?.gap_flag === "no_source" ||
        r?.gap_flag === "partial"
      );
    return true;
  });

  const counts = {
    all: items.length,
    needs_review: items.filter((it) => {
      const r = it.responses[0];
      return (
        it.status !== "approved" ||
        (r?.confidence != null && r.confidence < 0.7) ||
        r?.gap_flag === "no_source" ||
        r?.gap_flag === "partial"
      );
    }).length,
    approved: items.filter((it) => it.status === "approved").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[12.5px]">
        {(["all", "needs_review", "approved"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className="badge"
            style={{
              cursor: "pointer",
              background: filter === k ? "var(--accent-tint)" : "var(--bg-2)",
              color: filter === k ? "var(--accent-2)" : "var(--fg-3)",
              borderColor: "transparent",
            }}
          >
            {k === "needs_review" ? "Needs review" : k.charAt(0).toUpperCase() + k.slice(1)}{" "}
            <span className="num">{counts[k]}</span>
          </button>
        ))}
      </div>

      {filtered.map((it) => {
        const r = it.responses[0];
        return (
          <div key={it.id} className="card p-5">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="mono text-[11.5px]" style={{ color: "var(--fg-4)" }}>
                {it.requirement_id ?? ""}
              </span>
              <StatusBadge status={it.status} />
              <GapBadge flag={r?.gap_flag ?? null} />
              <ConfidenceBar value={r?.confidence ?? null} />
            </div>
            <h3
              className="font-medium mb-2 whitespace-pre-wrap"
              style={{ color: "var(--fg)" }}
            >
              {it.question_text}
            </h3>
            <NoSourceBanner flag={r?.gap_flag ?? null} />
            <div
              className="text-[13px] whitespace-pre-wrap p-3 rounded mb-3 mt-2"
              style={{ background: "var(--bg-2)", color: "var(--fg-2)" }}
            >
              {r?.final_text ?? r?.draft_text ?? "(empty)"}
            </div>
            <CitationList citations={r?.citations ?? []} />
            {it.status !== "approved" && (
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => decide(it, "approve", r?.final_text ?? r?.draft_text ?? "")}
                  disabled={busyId === r?.id || !r}
                  className="btn btn-primary"
                >
                  Approve
                </button>
                <button
                  onClick={() => decide(it, "reject")}
                  disabled={busyId === r?.id || !r}
                  className="btn btn-danger"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
