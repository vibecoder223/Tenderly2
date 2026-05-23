"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CitationList,
  ConfidenceBar,
  GapBadge,
  NoSourceBanner,
  type CitationItem,
} from "@/components/CitationChips";

/* ─── shared types ──────────────────────────────────────────────────────── */

type QSummary = {
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

type QDetail = {
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

type Member = { user_id: string; name: string | null; email: string };
type Comment = {
  id: string;
  author_id: string | null;
  author_name: string | null;
  body: string;
  created_at: string;
};

/* ─── status helpers ────────────────────────────────────────────────────── */

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

const STATUS_COLOR: Record<string, string> = {
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

function StatusDot({ status }: { status: string }) {
  const c = STATUS_COLOR[status] ?? "var(--fg-5)";
  return (
    <span
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: c,
        flexShrink: 0,
        marginTop: 1,
      }}
    />
  );
}

function ClassBadge({ cls }: { cls?: string | null }) {
  if (cls === "must") return <span className="badge badge-err" style={{ fontSize: 10, height: 17, padding: "0 5px" }}>Must</span>;
  if (cls === "should") return <span className="badge badge-warn" style={{ fontSize: 10, height: 17, padding: "0 5px" }}>Should</span>;
  if (cls === "info") return <span className="badge" style={{ fontSize: 10, height: 17, padding: "0 5px" }}>Info</span>;
  return null;
}

/* ─── main export ───────────────────────────────────────────────────────── */

export default function QuestionsTable({
  dealId,
  documents,
  currentDocId,
  questions,
  members,
  initial,
  currentUser,
}: {
  dealId: string;
  documents: { id: string; filename: string }[];
  currentDocId: string | null;
  questions: QSummary[];
  members: Member[];
  initial: { status?: string; topic?: string; q?: string };
  currentUser: { id: string; name: string | null; email: string };
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initial.status || "all");
  const [topic, setTopic] = useState(initial.topic || "all");
  const [search, setSearch] = useState(initial.q || "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<"list" | "detail">("list");

  const topics = useMemo(() => {
    const s = new Set<string>();
    for (const q of questions) if (q.topic) s.add(q.topic);
    return Array.from(s).sort();
  }, [questions]);

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      if (status !== "all") {
        if (status === "unanswered" && !["unanswered", "pending"].includes(q.status)) return false;
        if (status === "drafting" && !["ai_drafted", "assigned", "in_progress"].includes(q.status)) return false;
        if (status === "review" && !["in_review", "submitted"].includes(q.status)) return false;
        if (status === "approved" && q.status !== "approved") return false;
      }
      if (topic !== "all" && q.topic !== topic) return false;
      if (search && !`${q.requirement_id ?? ""} ${q.question_text}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [questions, status, topic, search]);

  // Auto-select first item
  useEffect(() => {
    if (filtered.length > 0 && !selectedId) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  // If selection filtered out, pick next available
  useEffect(() => {
    if (selectedId && !filtered.find((q) => q.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
    }
  }, [filtered, selectedId]);

  if (documents.length === 0) {
    return (
      <div className="card p-10 text-center">
        <h3 className="text-base font-semibold mb-1" style={{ color: "var(--fg)" }}>No documents yet</h3>
        <p className="text-sm mb-4" style={{ color: "var(--fg-4)" }}>Upload an RFP to extract questions automatically.</p>
        <Link href={`/deals/${dealId}/documents`} className="btn btn-primary inline-flex">Upload RFP</Link>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="card p-10 text-center">
        <h3 className="text-base font-semibold mb-1" style={{ color: "var(--fg)" }}>No questions extracted yet</h3>
        <p className="text-sm mb-4" style={{ color: "var(--fg-4)" }}>Re-run the pipeline on the Documents tab, or add a question manually.</p>
        <Link href={`/deals/${dealId}/documents`} className="btn">Manage documents</Link>
      </div>
    );
  }

  return (
    <div
      className="q-split"
      style={{
        height: "calc(100vh - var(--topbar) - 56px)",
        minHeight: 0,
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
        boxShadow: "var(--shadow-1)",
      }}
    >
      {/* ── left: question list ─────────────────────────────────── */}
      <div className={`q-list${mobilePanel === "detail" ? " q-panel-hidden" : ""}`}>
        {/* filters */}
        <div
          style={{
            padding: "12px 12px 10px",
            borderBottom: "1px solid var(--divider)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {documents.length > 1 && (
            <select
              className="select"
              style={{ fontSize: 12 }}
              value={currentDocId ?? ""}
              onChange={(e) => router.push(`/deals/${dealId}/questions?doc=${e.target.value}`)}
            >
              {documents.map((d) => (
                <option key={d.id} value={d.id}>{d.filename}</option>
              ))}
            </select>
          )}
          <input
            className="input"
            style={{ fontSize: 12, padding: "6px 10px" }}
            placeholder="Search questions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <select className="select" style={{ flex: 1, fontSize: 11.5, padding: "5px 8px" }} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="unanswered">Unanswered</option>
              <option value="drafting">Drafting</option>
              <option value="review">In review</option>
              <option value="approved">Approved</option>
            </select>
            <select className="select" style={{ flex: 1, fontSize: 11.5, padding: "5px 8px" }} value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="all">All topics</option>
              {topics.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 11, color: "var(--fg-5)", textAlign: "right" }}>
            {filtered.length} of {questions.length}
          </div>
        </div>

        {/* list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filtered.map((q) => {
            const active = q.id === selectedId;
            const conf = q.responses[0]?.confidence ?? null;
            return (
              <button
                key={q.id}
                onClick={() => { setSelectedId(q.id); setMobilePanel("detail"); }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "11px 14px",
                  background: active ? "var(--accent-tint)" : "transparent",
                  borderBottom: "1px solid var(--divider)",
                  borderLeft: active ? "2.5px solid var(--accent)" : "2.5px solid transparent",
                  cursor: "pointer",
                  transition: "background var(--dur-fast) var(--ease)",
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "var(--bg-2)"; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <StatusDot status={q.status} />
                  {q.requirement_id && (
                    <span className="mono" style={{ fontSize: 10.5, color: "var(--fg-4)" }}>
                      {q.requirement_id}
                    </span>
                  )}
                  <ClassBadge cls={q.classification} />
                  {conf != null && (
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 10.5,
                        fontWeight: 600,
                        color: conf >= 0.7 ? "var(--ok)" : conf >= 0.4 ? "var(--warn)" : "var(--err)",
                      }}
                    >
                      {Math.round(conf * 100)}%
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: active ? "var(--accent-2)" : "var(--fg)",
                    fontWeight: active ? 600 : 500,
                    lineHeight: 1.4,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {firstLine(q.question_text)}
                </div>
                <div style={{ marginTop: 5, fontSize: 11, color: "var(--fg-5)" }}>
                  {STATUS_LABEL[q.status] ?? q.status}
                  {q.topic ? ` · ${q.topic}` : ""}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── right: detail panel ─────────────────────────────────── */}
      <div className={`q-detail${mobilePanel === "list" ? " q-panel-hidden" : ""}`}>
        {selectedId ? (
          <QuestionDetailPane
            key={selectedId}
            questionId={selectedId}
            dealId={dealId}
            members={members}
            currentUser={currentUser}
            onRefresh={() => router.refresh()}
            onBack={() => setMobilePanel("list")}
          />
        ) : (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 8,
              color: "var(--fg-4)",
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span style={{ fontSize: 13 }}>Select a question to view details</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── lazy detail pane ──────────────────────────────────────────────────── */

function QuestionDetailPane({
  questionId,
  dealId,
  members,
  currentUser,
  onRefresh,
  onBack,
}: {
  questionId: string;
  dealId: string;
  members: Member[];
  currentUser: { id: string; name: string | null; email: string };
  onRefresh: () => void;
  onBack: () => void;
}) {
  const [data, setData] = useState<{ question: QDetail; requirement: Requirement; comments: Comment[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/questions/${questionId}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [questionId]);

  if (loading) {
    return (
      <div style={{ padding: 32, color: "var(--fg-4)", fontSize: 13 }}>Loading…</div>
    );
  }
  if (!data) {
    return (
      <div style={{ padding: 32, color: "var(--err)", fontSize: 13 }}>Failed to load question.</div>
    );
  }

  return (
    <QuestionDetailInline
      question={data.question}
      requirement={data.requirement}
      members={members}
      comments={data.comments}
      currentUser={currentUser}
      onBack={onBack}
      onMutate={() => {
        // re-fetch this question's detail
        fetch(`/api/questions/${questionId}`)
          .then((r) => r.json())
          .then((d) => setData(d));
        onRefresh();
      }}
    />
  );
}

/* ─── inline detail view ────────────────────────────────────────────────── */

function QuestionDetailInline({
  question,
  requirement,
  members,
  comments: initialComments,
  currentUser,
  onBack,
  onMutate,
}: {
  question: QDetail;
  requirement: Requirement;
  members: Member[];
  comments: Comment[];
  currentUser: { id: string; name: string | null; email: string };
  onBack: () => void;
  onMutate: () => void;
}) {
  const r = question.responses[0];
  const [draft, setDraft] = useState(r?.draft_text ?? r?.ai_generated_draft ?? "");
  const [tone, setTone] = useState<string>(r?.tone ?? "technical");
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [postingComment, setPostingComment] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string | null>(question.assigned_to);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    onMutate();
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
    onMutate();
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
    onMutate();
  }

  async function assignTo(userId: string) {
    setAssignedTo(userId || null);
    await fetch(`/api/questions/${question.id}/assign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: userId || null }),
    });
    onMutate();
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
      setComments((cs) => [...cs, comment]);
      setCommentBody("");
    }
  }

  return (
    <div style={{ padding: "24px 28px", maxWidth: 960 }}>
      {/* ── mobile back button (hidden on wide screens via CSS) ── */}
      <button
        className="q-back-btn"
        onClick={onBack}
        style={{
          display: "none", // shown via CSS media query
          alignItems: "center",
          gap: 6,
          marginBottom: 16,
          fontSize: 13,
          color: "var(--accent)",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        All questions
      </button>

      {/* ── header ── */}
      <header style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
          {question.requirement_id && (
            <span className="mono" style={{ fontSize: 11.5, color: "var(--fg-4)" }}>
              {question.requirement_id}
            </span>
          )}
          {requirement?.section && (
            <span className="mono" style={{ fontSize: 11.5, color: "var(--fg-4)" }}>
              §{requirement.section}
            </span>
          )}
          {requirement?.source_page != null && (
            <span style={{ fontSize: 11.5, color: "var(--fg-4)" }}>p.{requirement.source_page}</span>
          )}
          {requirement?.classification === "must" && <span className="badge badge-err">Must</span>}
          {requirement?.classification === "should" && <span className="badge badge-warn">Should</span>}
          {requirement?.classification === "info" && <span className="badge">Info</span>}
          <GapBadge flag={r?.gap_flag ?? null} />
          <ConfidenceBar value={r?.confidence ?? null} />
          <span
            className="badge"
            style={{
              marginLeft: "auto",
              background:
                STATUS_COLOR[question.status] === "var(--fg-5)"
                  ? "var(--bg-2)"
                  : `color-mix(in srgb, ${STATUS_COLOR[question.status]} 12%, white)`,
              color: STATUS_COLOR[question.status],
            }}
          >
            {STATUS_LABEL[question.status] ?? question.status}
          </span>
        </div>
        <h2
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: "var(--fg)",
            lineHeight: 1.45,
            whiteSpace: "pre-wrap",
            margin: 0,
          }}
        >
          {question.question_text}
        </h2>
      </header>

      <NoSourceBanner flag={r?.gap_flag ?? null} />

      {/* ── body: 2-col ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 20, alignItems: "start" }}>
        {/* main col */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* draft card */}
          <div className="card" style={{ padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-3)" }}>Response draft</span>
              <button
                onClick={regenerate}
                disabled={saving}
                style={{
                  fontSize: 11.5,
                  color: "var(--accent)",
                  background: "none",
                  border: "none",
                  cursor: saving ? "wait" : "pointer",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                Regenerate
              </button>
            </div>
            <textarea
              ref={textareaRef}
              className="textarea"
              rows={10}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              style={{ marginBottom: 10 }}
            />
            <CitationList citations={r?.citations ?? []} />
            {info && (
              <div style={{ fontSize: 12, marginTop: 8, color: info.startsWith("Error") ? "var(--err)" : "var(--ok)" }}>
                {info}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
              <button className="btn" onClick={() => saveDraft(false)} disabled={saving}>
                {saving ? "Saving…" : "Save draft"}
              </button>
              <button className="btn btn-primary" onClick={() => saveDraft(true)} disabled={saving}>
                Submit for review
              </button>
              {(question.status === "submitted" || question.status === "in_review") && (
                <>
                  <span style={{ flex: 1 }} />
                  <button className="btn btn-primary" onClick={() => approve("approve")} disabled={saving}>
                    Approve
                  </button>
                  <button className="btn btn-danger" onClick={() => approve("reject")} disabled={saving}>
                    Reject
                  </button>
                </>
              )}
            </div>
          </div>

          {/* comments */}
          <div className="card" style={{ padding: "16px 18px" }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", marginBottom: 12 }}>
              Comments {comments.length > 0 && <span style={{ color: "var(--fg-4)", fontWeight: 400 }}>({comments.length})</span>}
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {comments.length === 0 && (
                <span style={{ fontSize: 12.5, color: "var(--fg-4)" }}>No comments yet.</span>
              )}
              {comments.map((c) => (
                <div key={c.id} style={{ display: "flex", gap: 10 }}>
                  <div
                    style={{
                      width: 26, height: 26,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg,#3B47D6,#5C6BFA)",
                      fontSize: 10,
                      fontWeight: 600,
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {(c.author_name || "??").slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, marginBottom: 3 }}>
                      <span style={{ fontWeight: 600, color: "var(--fg)" }}>{c.author_name || "Member"}</span>
                      <span style={{ color: "var(--fg-5)", marginLeft: 6 }}>
                        {new Date(c.created_at).toISOString().replace("T", " ").slice(0, 16)}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--fg-2)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{c.body}</div>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={postComment} style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
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
                style={{ alignSelf: "flex-start" }}
              >
                {postingComment ? "Posting…" : "Post comment"}
              </button>
            </form>
          </div>
        </div>

        {/* sidebar col */}
        <div className="card" style={{ padding: "14px 16px" }}>
          <h3 style={{ fontSize: 12, fontWeight: 600, color: "var(--fg)", marginBottom: 12 }}>Properties</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label className="label" style={{ fontSize: 11 }}>Assignee</label>
              <select
                className="select"
                style={{ fontSize: 12, padding: "5px 8px" }}
                value={assignedTo ?? ""}
                onChange={(e) => assignTo(e.target.value)}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.name || m.email}{m.user_id === currentUser.id ? " (you)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" style={{ fontSize: 11 }}>Tone</label>
              <select
                className="select"
                style={{ fontSize: 12, padding: "5px 8px" }}
                value={tone}
                onChange={(e) => setTone(e.target.value)}
              >
                <option value="formal">Formal</option>
                <option value="technical">Technical</option>
                <option value="consultative">Consultative</option>
              </select>
            </div>
            <PropRow label="Topic" value={requirement?.topic ?? question.category ?? "—"} />
            <PropRow label="Source page" value={requirement?.source_page ?? "—"} />
            <PropRow label="Mandatory" value={requirement?.is_mandatory ? "Yes" : "No"} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PropRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, paddingTop: 6, borderTop: "1px solid var(--divider)" }}>
      <span style={{ color: "var(--fg-4)" }}>{label}</span>
      <span style={{ color: "var(--fg)", textTransform: "capitalize" }}>{String(value)}</span>
    </div>
  );
}

function firstLine(s: string) {
  const line = s.split("\n")[0];
  return line.length > 200 ? line.slice(0, 200) + "…" : line;
}
