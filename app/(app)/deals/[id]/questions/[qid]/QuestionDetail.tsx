"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CitationList,
  ConfidenceBar,
  GapBadge,
  NoSourceBanner,
  type CitationItem,
} from "@/components/CitationChips";

type Member = { user_id: string; name: string | null; email: string };
type Comment = {
  id: string;
  author_id: string | null;
  author_name: string | null;
  body: string;
  created_at: string;
};
type Question = {
  id: string;
  document_id: string;
  requirement_id: string | null;
  question_text: string;
  status: string;
  priority: string;
  category: string | null;
  assigned_to: string | null;
  due_date: string | null;
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
type Requirement = {
  classification: string | null;
  topic: string | null;
  source_page: number | null;
  section: string | null;
  is_mandatory: boolean | null;
} | null;

export default function QuestionDetail({
  dealId,
  question,
  requirement,
  members,
  comments,
  currentUser,
}: {
  dealId: string;
  question: Question;
  requirement: Requirement;
  members: Member[];
  comments: Comment[];
  currentUser: { id: string; name: string | null; email: string };
}) {
  const router = useRouter();
  const r = question.responses[0];
  const [draft, setDraft] = useState(r?.draft_text ?? r?.ai_generated_draft ?? "");
  const [tone, setTone] = useState<string>(r?.tone ?? "technical");
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [commentsLocal, setCommentsLocal] = useState<Comment[]>(comments);
  const [postingComment, setPostingComment] = useState(false);
  const [autoSave, setAutoSave] = useState<null | "saving" | Date>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const autosaveDraft = useCallback(async (text: string, currentTone: string) => {
    setAutoSave("saving");
    const res = await fetch(`/api/questions/${question.id}/respond`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ draft_text: text, tone: currentTone }),
    });
    setAutoSave(res.ok ? new Date() : null);
  }, [question.id]);

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => autosaveDraft(draft, tone), 1500);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [draft, tone, autosaveDraft]);

  async function saveDraft(submit = false) {
    setSaving(true);
    setInfo(null);
    const res = await fetch(`/api/questions/${question.id}/respond`, {
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

  async function assignTo(userId: string) {
    setSaving(true);
    await fetch(`/api/questions/${question.id}/assign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: userId || null }),
    });
    setSaving(false);
    router.refresh();
  }

  async function regenerate() {
    setSaving(true);
    setInfo("Regenerating with Claude…");
    const res = await fetch(`/api/questions/${question.id}/regenerate`, {
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

  async function approve(decision: "approve" | "reject") {
    if (!r) return;
    setSaving(true);
    await fetch(`/api/responses/${r.id}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, final_text: draft || r.draft_text }),
    });
    setSaving(false);
    router.refresh();
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setPostingComment(true);
    const res = await fetch(`/api/questions/${question.id}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: commentBody }),
    });
    setPostingComment(false);
    if (res.ok) {
      const { comment } = await res.json();
      setCommentsLocal((cs) => [...cs, comment]);
      setCommentBody("");
    }
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-5">
        <header>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="mono text-[12px]" style={{ color: "var(--fg-4)" }}>
              {question.requirement_id ?? "—"}
            </span>
            {requirement?.section && (
              <span className="mono text-[11.5px]" style={{ color: "var(--fg-4)" }}>
                · §{requirement.section}
              </span>
            )}
            {requirement?.source_page != null && (
              <span className="text-[11.5px]" style={{ color: "var(--fg-4)" }}>
                · page {requirement.source_page}
              </span>
            )}
            {requirement?.classification === "must" && <span className="badge badge-err">Must</span>}
            {requirement?.classification === "should" && <span className="badge badge-warn">Should</span>}
            {requirement?.classification === "info" && <span className="badge">Info</span>}
            <GapBadge flag={r?.gap_flag ?? null} />
            <ConfidenceBar value={r?.confidence ?? null} />
          </div>
          <h1 className="text-[18px] font-semibold whitespace-pre-wrap" style={{ color: "var(--fg)" }}>
            {question.question_text}
          </h1>
        </header>

        <NoSourceBanner flag={r?.gap_flag ?? null} />

        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[12px] font-medium" style={{ color: "var(--fg-3)" }}>
              AI draft
            </label>
            <button
              onClick={regenerate}
              className="text-[11.5px]"
              style={{ color: "var(--accent)" }}
              disabled={saving}
            >
              ↻ Regenerate with Claude
            </button>
          </div>
          <textarea
            className="textarea"
            rows={14}
            value={draft}
            placeholder={
              r?.gap_flag === "no_source"
                ? "No AI draft — no grounding source was found. Write the answer manually, or add a document to your knowledge base and regenerate."
                : "Write or generate an answer…"
            }
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="flex items-center justify-between">
            <CitationList citations={r?.citations ?? []} />
            <span className="text-[11px]" style={{ color: "var(--fg-5)" }}>
              {autoSave === "saving" ? "Saving…" : autoSave instanceof Date ? `Saved ${timeSince(autoSave)}` : ""}
            </span>
          </div>
          {info && (
            <div
              className="text-[12px]"
              style={{ color: info.startsWith("Error") ? "var(--err)" : "var(--ok)" }}
            >
              {info}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => saveDraft(false)} className="btn" disabled={saving}>
              {saving ? "Saving…" : "Save draft"}
            </button>
            <button onClick={() => saveDraft(true)} className="btn btn-primary" disabled={saving}>
              Submit for review
            </button>
            {question.status === "review" && (
              <>
                <span style={{ flex: 1 }} />
                <button onClick={() => approve("approve")} className="btn btn-primary" disabled={saving}>
                  Approve
                </button>
                <button onClick={() => approve("reject")} className="btn btn-danger" disabled={saving}>
                  Reject
                </button>
              </>
            )}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--fg)" }}>
            Comments ({commentsLocal.length})
          </h3>
          <div className="space-y-3">
            {commentsLocal.length === 0 && (
              <div className="text-[12.5px]" style={{ color: "var(--fg-4)" }}>
                No comments yet.
              </div>
            )}
            {commentsLocal.map((c) => (
              <div key={c.id} className="flex gap-3">
                <div
                  className="w-7 h-7 rounded-full text-[10.5px] font-semibold flex items-center justify-center text-white shrink-0"
                  style={{ background: "linear-gradient(135deg,#3B47D6,#5C6BFA)" }}
                >
                  {(c.author_name || "??").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="text-[12.5px] mb-0.5">
                    <span style={{ color: "var(--fg)", fontWeight: 600 }}>
                      {c.author_name || "Member"}
                    </span>{" "}
                    <span style={{ color: "var(--fg-5)" }}>
                      · {new Date(c.created_at).toISOString().replace("T", " ").slice(0, 16)}
                    </span>
                  </div>
                  <div className="text-[13px] whitespace-pre-wrap" style={{ color: "var(--fg-2)" }}>
                    {c.body}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={postComment} className="mt-4 space-y-2">
            <textarea
              className="textarea"
              rows={3}
              placeholder="Leave a comment…"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!commentBody.trim() || postingComment}
            >
              {postingComment ? "Posting…" : "Post comment"}
            </button>
          </form>
        </div>
      </div>

      <aside className="space-y-5">
        <div className="card p-5 space-y-3 text-[13px]">
          <h3 className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Properties</h3>
          <div>
            <label className="label">Assignee</label>
            <select
              className="select"
              value={question.assigned_to ?? ""}
              onChange={(e) => assignTo(e.target.value)}
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name || m.email}
                  {m.user_id === currentUser.id ? " (you)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Tone</label>
            <select className="select" value={tone} onChange={(e) => setTone(e.target.value)}>
              <option value="formal">Formal</option>
              <option value="technical">Technical</option>
              <option value="consultative">Consultative</option>
            </select>
          </div>
          <Row label="Status" value={question.status.replace(/_/g, " ")} />
          <Row label="Topic" value={requirement?.topic ?? question.category ?? "—"} />
          <Row label="Source page" value={requirement?.source_page ?? "—"} />
          <Row label="Mandatory" value={requirement?.is_mandatory ? "Yes" : "No"} />
        </div>
      </aside>
    </div>
  );
}

function timeSince(d: Date): string {
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)}m ago`;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-[12.5px]">
      <span style={{ color: "var(--fg-4)" }}>{label}</span>
      <span style={{ color: "var(--fg)", textTransform: "capitalize" }}>{value}</span>
    </div>
  );
}
