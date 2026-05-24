"use client";

import { useState } from "react";

type Candidate = {
  chunk_id: string;
  text: string;
  section_path: string | null;
  page_start: number | null;
  document_filename: string;
  score: number;
};

export default function KnowledgeTestPanel() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [topScore, setTopScore] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function test(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setErr(null);
    setResults(null);
    const res = await fetch("/api/knowledge/test-retrieval", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: query.trim() }),
    });
    setLoading(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed" }));
      setErr(error || "Retrieval failed");
      return;
    }
    const data = await res.json();
    setResults(data.candidates ?? []);
    setTopScore(data.top_score ?? 0);
  }

  const scoreColor = (s: number) =>
    s >= 0.7 ? "var(--ok)" : s >= 0.4 ? "var(--warn)" : "var(--err)";

  return (
    <div className="card p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--fg)" }}>
          Test retrieval
        </h2>
        <p className="text-[13px]" style={{ color: "var(--fg-4)" }}>
          Enter a sample RFP requirement to see which knowledge base chunks would be retrieved.
        </p>
      </div>
      <form onSubmit={test} className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="e.g. Describe your data encryption approach at rest and in transit"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn btn-primary" type="submit" disabled={loading || !query.trim()}>
          {loading ? (
            <>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none"
                style={{ animation: "spin 0.75s linear infinite" }}>
                <circle cx="7" cy="7" r="5.5" stroke="white" strokeOpacity="0.35" strokeWidth="1.5" />
                <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Testing…
            </>
          ) : "Test"}
        </button>
      </form>

      {err && (
        <div className="text-[12px] px-3 py-2 rounded" style={{ color: "var(--err)", background: "var(--err-tint, #fff0f0)" }}>
          {err}
        </div>
      )}

      {results !== null && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-[12.5px]" style={{ color: "var(--fg-4)" }}>
            <span>{results.length} chunk{results.length !== 1 ? "s" : ""} retrieved</span>
            {topScore !== null && (
              <span>
                Top score:{" "}
                <span style={{ color: scoreColor(topScore), fontWeight: 600 }}>
                  {(topScore * 100).toFixed(0)}%
                </span>
              </span>
            )}
            {results.length === 0 && (
              <span style={{ color: "var(--warn)" }}>No matching content — upload more relevant documents.</span>
            )}
          </div>
          {results.map((c, i) => (
            <div key={c.chunk_id} className="rounded-md p-3 space-y-1.5"
              style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11.5px] font-medium" style={{ color: "var(--fg-3)" }}>
                  #{i + 1} · {c.document_filename}
                  {c.page_start != null && (
                    <span style={{ color: "var(--fg-5)" }}> · p.{c.page_start}</span>
                  )}
                  {c.section_path && (
                    <span style={{ color: "var(--fg-5)" }}> · {c.section_path}</span>
                  )}
                </div>
                <span className="text-[11px] font-semibold num" style={{ color: scoreColor(c.score), flexShrink: 0 }}>
                  {(c.score * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-[12px] line-clamp-4" style={{ color: "var(--fg-3)", whiteSpace: "pre-wrap" }}>
                {c.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
