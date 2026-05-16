"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";

type Item = {
  id: string;
  requirement_id: string | null;
  question_text: string;
  status: string;
  responses: { id: string; draft_text: string | null; final_text: string | null; status: string }[];
};

export default function ReviewList({ items }: { items: Item[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
      {items.map((it) => {
        const r = it.responses[0];
        return (
          <div key={it.id} className="card p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="mono text-[11.5px]" style={{ color: "var(--fg-4)" }}>{it.requirement_id ?? ""}</span>
              <StatusBadge status={it.status} />
            </div>
            <h3 className="font-medium mb-2 whitespace-pre-wrap" style={{ color: "var(--fg)" }}>
              {it.question_text}
            </h3>
            <div className="text-[13px] whitespace-pre-wrap p-3 rounded mb-3" style={{ background: "var(--bg-2)", color: "var(--fg-2)" }}>
              {r?.final_text ?? r?.draft_text ?? "(empty)"}
            </div>
            {it.status !== "approved" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => decide(it, "approve", r?.draft_text ?? "")}
                  disabled={busyId === r?.id}
                  className="btn btn-primary"
                >
                  Approve
                </button>
                <button
                  onClick={() => decide(it, "reject")}
                  disabled={busyId === r?.id}
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
