"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Q = {
  id: string;
  requirement_id: string | null;
  question_text: string;
  status: string;
  priority: string;
  category: string | null;
  assigned_to: string | null;
  due_date: string | null;
  last_activity_at: string | null;
  classification?: string | null;
  topic?: string | null;
  source_page?: number | null;
  section?: string | null;
  responses: {
    id: string;
    draft_text: string | null;
    final_text: string | null;
    status: string;
    confidence: number | null;
    gap_flag: string | null;
    citations: { id: string }[];
  }[];
};

type Member = { user_id: string; name: string | null; email: string };

const STATUS_LABEL: Record<string, string> = {
  unanswered: "Unanswered",
  pending: "Unanswered",
  ai_drafted: "AI drafted",
  assigned: "Assigned",
  in_progress: "In progress",
  in_review: "In review",
  submitted: "In review",
  approved: "Approved",
  finalized: "Finalized",
  rejected: "Rejected",
};

const STATUS_TONE: Record<string, string> = {
  unanswered: "var(--fg-5)",
  pending: "var(--fg-5)",
  ai_drafted: "var(--accent)",
  assigned: "var(--accent)",
  in_progress: "var(--accent)",
  in_review: "var(--warn)",
  submitted: "var(--warn)",
  approved: "var(--ok)",
  finalized: "var(--ok)",
  rejected: "var(--err)",
};

export default function QuestionsTable({
  dealId,
  documents,
  currentDocId,
  questions,
  members,
  initial,
}: {
  dealId: string;
  documents: { id: string; filename: string }[];
  currentDocId: string | null;
  questions: Q[];
  members: Member[];
  initial: { status?: string; topic?: string; q?: string };
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initial.status || "all");
  const [topic, setTopic] = useState(initial.topic || "all");
  const [search, setSearch] = useState(initial.q || "");

  const topics = useMemo(() => {
    const s = new Set<string>();
    for (const q of questions) if (q.topic) s.add(q.topic);
    return Array.from(s).sort();
  }, [questions]);

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      if (status !== "all") {
        const grouped = status;
        if (grouped === "unanswered" && !["unanswered", "pending"].includes(q.status)) return false;
        if (grouped === "drafting" && !["ai_drafted", "assigned", "in_progress"].includes(q.status)) return false;
        if (grouped === "review" && !["in_review", "submitted"].includes(q.status)) return false;
        if (grouped === "approved" && q.status !== "approved") return false;
      }
      if (topic !== "all" && q.topic !== topic) return false;
      if (search && !`${q.requirement_id ?? ""} ${q.question_text}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [questions, status, topic, search]);

  if (documents.length === 0) {
    return (
      <div className="card p-10 text-center">
        <h3 className="text-base font-semibold mb-1" style={{ color: "var(--fg)" }}>No documents yet</h3>
        <p className="text-sm mb-4" style={{ color: "var(--fg-4)" }}>
          Upload an RFP to extract questions automatically.
        </p>
        <Link href={`/deals/${dealId}/documents`} className="btn btn-primary inline-flex">
          Upload RFP
        </Link>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="card p-10 text-center">
        <h3 className="text-base font-semibold mb-1" style={{ color: "var(--fg)" }}>No questions extracted yet</h3>
        <p className="text-sm mb-4" style={{ color: "var(--fg-4)" }}>
          Re-run the pipeline on the Documents tab, or add a question manually.
        </p>
        <Link href={`/deals/${dealId}/documents`} className="btn">
          Manage documents
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {documents.length > 1 && (
          <select
            className="select"
            style={{ width: 240 }}
            value={currentDocId ?? ""}
            onChange={(e) => router.push(`/deals/${dealId}/questions?doc=${e.target.value}`)}
          >
            {documents.map((d) => (
              <option key={d.id} value={d.id}>{d.filename}</option>
            ))}
          </select>
        )}
        <select className="select" style={{ width: 160 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="unanswered">Unanswered</option>
          <option value="drafting">Drafting</option>
          <option value="review">In review</option>
          <option value="approved">Approved</option>
        </select>
        <select className="select" style={{ width: 160 }} value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="all">All topics</option>
          {topics.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input
          className="input"
          style={{ flex: 1, minWidth: 200 }}
          placeholder="Search by ID or text…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="text-[12px]" style={{ color: "var(--fg-4)" }}>
          {filtered.length} of {questions.length}
        </span>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ color: "var(--fg-4)" }}>
              <th className="text-left font-medium px-5 py-2.5" style={{ width: 100 }}>ID</th>
              <th className="text-left font-medium px-5 py-2.5">Question</th>
              <th className="text-left font-medium px-5 py-2.5" style={{ width: 90 }}>Class</th>
              <th className="text-left font-medium px-5 py-2.5" style={{ width: 110 }}>Topic</th>
              <th className="text-left font-medium px-5 py-2.5" style={{ width: 130 }}>Status</th>
              <th className="text-left font-medium px-5 py-2.5" style={{ width: 130 }}>Assignee</th>
              <th className="text-right font-medium px-5 py-2.5" style={{ width: 100 }}>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((q) => {
              const r = q.responses[0];
              const conf = r?.confidence ?? null;
              const member = members.find((m) => m.user_id === q.assigned_to);
              return (
                <tr key={q.id} className="border-t align-top" style={{ borderColor: "var(--divider)" }}>
                  <td className="px-5 py-3 mono text-[11.5px] align-top" style={{ color: "var(--fg-4)" }}>
                    <Link href={`/deals/${dealId}/questions/${q.id}`} style={{ color: "var(--fg-3)" }}>
                      {q.requirement_id ?? "—"}
                    </Link>
                    {q.source_page != null && (
                      <div className="text-[10.5px]" style={{ color: "var(--fg-5)" }}>
                        p.{q.source_page}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/deals/${dealId}/questions/${q.id}`}
                      className="font-medium block"
                      style={{ color: "var(--fg)" }}
                    >
                      {firstLine(q.question_text)}
                    </Link>
                    {r?.gap_flag === "no_source" && (
                      <span className="badge badge-err mt-1 inline-flex">No source</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {q.classification === "must" ? (
                      <span className="badge badge-err">Must</span>
                    ) : q.classification === "should" ? (
                      <span className="badge badge-warn">Should</span>
                    ) : q.classification === "info" ? (
                      <span className="badge">Info</span>
                    ) : (
                      <span style={{ color: "var(--fg-5)" }}>—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 capitalize" style={{ color: "var(--fg-3)" }}>
                    {q.topic ?? q.category ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="badge"
                      style={{
                        background:
                          STATUS_TONE[q.status] === "var(--fg-5)"
                            ? "var(--bg-2)"
                            : `color-mix(in srgb, ${STATUS_TONE[q.status]} 12%, white)`,
                        color: STATUS_TONE[q.status],
                        borderColor: "transparent",
                      }}
                    >
                      {STATUS_LABEL[q.status] ?? q.status}
                    </span>
                  </td>
                  <td className="px-5 py-3" style={{ color: "var(--fg-3)" }}>
                    {member ? (
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-5 h-5 rounded-full text-[10px] font-semibold flex items-center justify-center text-white"
                          style={{ background: "linear-gradient(135deg,#3B47D6,#5C6BFA)" }}
                        >
                          {(member.name || member.email).slice(0, 2).toUpperCase()}
                        </span>
                        <span className="text-[12px] truncate" style={{ maxWidth: 90 }}>
                          {member.name || member.email}
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: "var(--fg-5)" }}>Unassigned</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {conf == null ? (
                      <span style={{ color: "var(--fg-5)" }}>—</span>
                    ) : (
                      <span
                        className="num text-[12.5px]"
                        style={{
                          color:
                            conf >= 0.7
                              ? "var(--ok)"
                              : conf >= 0.4
                              ? "var(--warn)"
                              : "var(--err)",
                        }}
                      >
                        {Math.round(conf * 100)}%
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function firstLine(s: string) {
  const line = s.split("\n")[0];
  return line.length > 180 ? line.slice(0, 180) + "…" : line;
}
