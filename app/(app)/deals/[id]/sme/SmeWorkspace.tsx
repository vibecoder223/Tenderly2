"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import {
  ConfidenceBar,
  GapBadge,
  NoSourceBanner,
  CitationList,
  type CitationItem,
} from "@/components/CitationChips";

type Question = {
  id: string;
  requirement_id: string | null;
  question_text: string;
  status: string;
  priority: string;
  category: string | null;
  assigned_to: string | null;
  responses: {
    id: string;
    draft_text: string | null;
    ai_generated_draft: string | null;
    final_text: string | null;
    status: string;
    tone: string;
    confidence: number | null;
    gap_flag: string | null;
    answer_text_with_markers: string | null;
    citations: CitationItem[];
  }[];
};

type Member = { user_id: string; name: string | null; email: string };

export default function SmeWorkspace({
  questions,
  members,
  currentUserId,
  focusQuestionId,
}: {
  questions: Question[];
  members: Member[];
  currentUserId: string;
  focusQuestionId?: string;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(
    focusQuestionId || questions[0]?.id || null
  );
  const selected = useMemo(
    () => questions.find((q) => q.id === selectedId) || null,
    [questions, selectedId]
  );

  const [draft, setDraft] = useState(
    selected?.responses[0]?.draft_text ?? selected?.responses[0]?.ai_generated_draft ?? ""
  );
  const [tone, setTone] = useState<string>(selected?.responses[0]?.tone ?? "technical");
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  function selectQuestion(id: string) {
    setSelectedId(id);
    const q = questions.find((x) => x.id === id);
    setDraft(q?.responses[0]?.draft_text ?? q?.responses[0]?.ai_generated_draft ?? "");
    setTone(q?.responses[0]?.tone ?? "technical");
    setInfo(null);
  }

  async function saveDraft(submit = false) {
    if (!selected) return;
    setSaving(true);
    setInfo(null);
    const res = await fetch(`/api/questions/${selected.id}/respond`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ draft_text: draft, tone, status: submit ? "submitted" : "draft" }),
    });
    setSaving(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed" }));
      setInfo(`Error: ${error || "Failed"}`);
      return;
    }
    setInfo(submit ? "Submitted for review." : "Draft saved.");
    router.refresh();
  }

  async function assignTo(userId: string | null) {
    if (!selected) return;
    setSaving(true);
    await fetch(`/api/questions/${selected.id}/assign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    setSaving(false);
    router.refresh();
  }

  async function regenerate() {
    if (!selected) return;
    setSaving(true);
    setInfo("Regenerating with Claude…");
    const res = await fetch(`/api/questions/${selected.id}/regenerate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tone }),
    });
    setSaving(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed" }));
      setInfo(`Error: ${error || "Failed"}`);
      return;
    }
    const { draft_text } = await res.json();
    setDraft(draft_text);
    setInfo("New draft generated.");
    router.refresh();
  }

  if (questions.length === 0) {
    return (
      <div className="p-7">
        <div className="card p-10 text-center text-sm" style={{ color: "var(--fg-4)" }}>
          No questions yet — finish triage first.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-var(--topbar))]">
      {/* Question list */}
      <aside className="w-[360px] border-r overflow-y-auto" style={{ borderColor: "var(--border)" }}>
        {questions.map((q) => {
          const active = q.id === selectedId;
          const member = members.find((m) => m.user_id === q.assigned_to);
          return (
            <button
              key={q.id}
              onClick={() => selectQuestion(q.id)}
              className="w-full text-left p-4 border-b block"
              style={{
                borderColor: "var(--divider)",
                background: active ? "var(--accent-tint)" : "var(--surface)",
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="mono text-[11px]" style={{ color: "var(--fg-4)" }}>
                  {q.requirement_id ?? "—"}
                </span>
                <StatusBadge status={q.status} />
              </div>
              <div className="text-[13px] font-medium line-clamp-2" style={{ color: "var(--fg)" }}>
                {q.question_text.split("\n")[0]}
              </div>
              <div className="text-[11.5px] mt-1" style={{ color: "var(--fg-4)" }}>
                {member ? `Assigned to ${member.name || member.email}` : "Unassigned"}
              </div>
            </button>
          );
        })}
      </aside>

      {/* Editor */}
      <section className="flex-1 overflow-y-auto p-7">
        {!selected ? (
          <div className="text-sm" style={{ color: "var(--fg-4)" }}>Select a question to draft a response.</div>
        ) : (
          <div className="max-w-[820px] space-y-5">
            <header>
              <div className="flex items-center gap-2 mb-2">
                <span className="mono text-[12px]" style={{ color: "var(--fg-4)" }}>
                  {selected.requirement_id ?? ""}
                </span>
                <StatusBadge status={selected.status} />
                <StatusBadge status={selected.priority} />
              </div>
              <h2 className="text-[16px] font-semibold whitespace-pre-wrap" style={{ color: "var(--fg)" }}>
                {selected.question_text}
              </h2>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <GapBadge flag={selected.responses[0]?.gap_flag ?? null} />
                <ConfidenceBar value={selected.responses[0]?.confidence ?? null} />
              </div>
            </header>

            <NoSourceBanner flag={selected.responses[0]?.gap_flag ?? null} />

            <div className="card p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="label">Assigned to</label>
                  <select
                    className="select"
                    value={selected.assigned_to ?? ""}
                    onChange={(e) => assignTo(e.target.value || null)}
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.name || m.email}
                        {m.user_id === currentUserId ? " (you)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ width: 180 }}>
                  <label className="label">Tone</label>
                  <select className="select" value={tone} onChange={(e) => setTone(e.target.value)}>
                    <option value="formal">Formal</option>
                    <option value="technical">Technical</option>
                    <option value="consultative">Consultative</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label flex items-center justify-between">
                  <span>Draft response</span>
                  <button onClick={regenerate} className="text-[11.5px]" style={{ color: "var(--accent)" }} disabled={saving}>
                    ↻ Regenerate with Claude
                  </button>
                </label>
                <textarea
                  className="textarea"
                  rows={14}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
              </div>

              <CitationList citations={selected.responses[0]?.citations ?? []} />

              {info && <div className="text-[12px]" style={{ color: info.startsWith("Error") ? "var(--err)" : "var(--ok)" }}>{info}</div>}

              <div className="flex items-center gap-2">
                <button onClick={() => saveDraft(false)} className="btn" disabled={saving}>
                  {saving ? "Saving…" : "Save draft"}
                </button>
                <button onClick={() => saveDraft(true)} className="btn btn-primary" disabled={saving}>
                  Submit for review
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
