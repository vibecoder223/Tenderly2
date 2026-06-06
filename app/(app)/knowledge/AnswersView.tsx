"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Select from "@/components/Select";

export type Answer = {
  id: string;
  category: string | null;
  keyword: string | null;
  question_text: string | null;
  response_text: string;
  usage_count: number;
  last_used_at: string | null;
  source: string | null;
  created_at: string;
};

const CATEGORIES = ["general", "technical", "compliance", "commercial", "operational"];

export default function AnswersView({ answers }: { answers: Answer[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return answers;
    return answers.filter((a) =>
      [a.question_text, a.keyword, a.response_text, a.category]
        .filter(Boolean)
        .some((s) => (s as string).toLowerCase().includes(q))
    );
  }, [answers, search]);

  async function remove(id: string) {
    if (!confirm("Delete this answer? This can't be undone.")) return;
    setBusy(true);
    await fetch(`/api/library/${id}`, { method: "DELETE" });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder="Search saved answers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn btn-primary" onClick={() => setAdding((v) => !v)}>
          {adding ? "Close" : "+ Add answer"}
        </button>
      </div>

      {adding && (
        <AnswerForm
          onDone={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      )}

      <div className="section-card">
        <div className="section-card-head">
          <div>
            <span className="section-card-title">Answers</span>
            <span className="section-card-count">{filtered.length}</span>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: "var(--fg-4)" }}>
            {answers.length === 0
              ? "No saved answers yet. Approved answers land here automatically — or add one above."
              : "No answers match your search."}
          </div>
        ) : (
          <div>
            {filtered.map((a, i) =>
              editingId === a.id ? (
                <div key={a.id} style={{ padding: "14px 16px", borderTop: i === 0 ? "none" : "1px solid var(--divider)" }}>
                  <AnswerForm
                    initial={a}
                    onDone={() => {
                      setEditingId(null);
                      router.refresh();
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <div
                  key={a.id}
                  style={{ padding: "12px 16px", borderTop: i === 0 ? "none" : "1px solid var(--divider)" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span
                      className="mono"
                      style={{ fontSize: 11, color: "var(--accent-3)", background: "var(--accent-tint)", padding: "2px 7px", borderRadius: 4 }}
                    >
                      {a.category ?? "general"}
                    </span>
                    {a.source === "approved" && (
                      <span className="meta-mono" style={{ color: "var(--ok)" }}>approved</span>
                    )}
                    <span className="meta-mono" style={{ marginLeft: "auto" }}>
                      used {a.usage_count}×{a.last_used_at ? ` · last ${a.last_used_at.slice(0, 10)}` : ""}
                    </span>
                  </div>
                  {a.question_text && (
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg)", marginBottom: 3 }}>
                      {a.question_text}
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: "var(--fg-2)", whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
                    {a.response_text}
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                    <button className="text-[11.5px]" style={{ color: "var(--accent)" }} onClick={() => setEditingId(a.id)}>
                      Edit
                    </button>
                    <button className="text-[11.5px]" style={{ color: "var(--err)" }} disabled={busy} onClick={() => remove(a.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AnswerForm({
  initial,
  onDone,
  onCancel,
}: {
  initial?: Answer;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const editing = !!initial;
  const [question, setQuestion] = useState(initial?.question_text ?? "");
  const [category, setCategory] = useState(initial?.category ?? "general");
  const [text, setText] = useState(initial?.response_text ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      setErr("Answer text is required.");
      return;
    }
    setErr(null);
    setBusy(true);
    const res = editing
      ? await fetch(`/api/library/${initial!.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question_text: question, category, response_text: text }),
        })
      : await fetch("/api/library", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question_text: question, category, response_text: text }),
        });
    setBusy(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed" }));
      setErr(error || "Failed to save.");
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className={editing ? "space-y-3" : "section-card space-y-3"} style={editing ? undefined : { padding: 16 }}>
      <div className="grid grid-cols-[1fr_180px] gap-2">
        <div>
          <label className="label">Question it answers <span style={{ color: "var(--fg-5)" }}>· powers matching</span></label>
          <input
            className="input"
            placeholder="e.g. Describe your information security program"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Category</label>
          <Select
            value={category}
            onChange={setCategory}
            fullWidth
            options={CATEGORIES.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))}
          />
        </div>
      </div>
      <div>
        <label className="label">Answer</label>
        <textarea className="textarea" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="The reusable answer…" />
      </div>
      {err && <div className="text-xs" style={{ color: "var(--err)" }}>{err}</div>}
      <div className="flex items-center gap-2">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : editing ? "Save changes" : "Add to library"}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        )}
      </div>
    </form>
  );
}
