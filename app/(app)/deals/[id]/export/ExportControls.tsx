"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Doc = { id: string; filename: string; total: number; approved: number };
type Template = { id: string; name: string; kind: string | null; is_default: boolean };

export default function ExportControls({
  dealId,
  documents,
  initialDocId,
  templates,
}: {
  dealId: string;
  documents: Doc[];
  initialDocId: string | null;
  templates: Template[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "pdf" | "docx">(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [citationStyle, setCitationStyle] = useState<"inline" | "footnote">("inline");
  const defaultTpl = templates.find((t) => t.is_default);
  const [templateId, setTemplateId] = useState<string>(defaultTpl?.id ?? "");

  // Multi-select: default to all docs (or just the focused one if there are many)
  const [selected, setSelected] = useState<Set<string>>(
    new Set(documents.length <= 1 ? documents.map((d) => d.id) : documents.map((d) => d.id))
  );
  // Mode when multiple docs picked: merge into one file, or one file per doc
  const [mode, setMode] = useState<"merge" | "separate">("merge");

  function toggleDoc(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }
  function selectAll() {
    setSelected(new Set(documents.map((d) => d.id)));
  }
  function selectNone() {
    setSelected(new Set());
  }

  async function generateOne(format: "pdf" | "docx", docIds: string[], merge: boolean) {
    const res = await fetch("/api/exports/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        deal_id: dealId,
        document_ids: docIds,
        document_id: docIds[0], // legacy single-doc path
        merge,
        format,
        citation_style: citationStyle,
        template_id: templateId || null,
      }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed" }));
      throw new Error(error || "Export failed");
    }
    const { exportId } = await res.json();
    return exportId as string;
  }

  async function doExport(format: "pdf" | "docx") {
    setBusy(format);
    setErr(null);
    setProgress(null);
    const ids = Array.from(selected);
    if (ids.length === 0) {
      setErr("Pick at least one document.");
      setBusy(null);
      return;
    }
    try {
      if (mode === "merge" || ids.length === 1) {
        const id = await generateOne(format, ids, ids.length > 1);
        router.refresh();
        window.open(`/api/exports/${id}/download`, "_blank");
      } else {
        // Separate: one file per doc, opened sequentially.
        for (let i = 0; i < ids.length; i++) {
          setProgress(`Generating ${i + 1} of ${ids.length}…`);
          const id = await generateOne(format, [ids[i]], false);
          window.open(`/api/exports/${id}/download`, "_blank");
        }
        router.refresh();
      }
    } catch (e: any) {
      setErr(e.message || "Export failed");
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  const selectedDocs = documents.filter((d) => selected.has(d.id));
  const totalSelected = selectedDocs.reduce((s, d) => s + d.total, 0);
  const totalApproved = selectedDocs.reduce((s, d) => s + d.approved, 0);
  const willMerge = mode === "merge" && selected.size > 1;
  const fileCount = mode === "merge" ? 1 : selected.size;

  return (
    <div className="space-y-5">
      {/* Document picker */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[12px] font-medium" style={{ color: "var(--fg-3)" }}>
            Documents to include
          </label>
          <div className="flex items-center gap-2">
            <button type="button" className="text-[11.5px]" onClick={selectAll} style={{ color: "var(--accent)" }}>Select all</button>
            <span style={{ color: "var(--fg-5)" }}>·</span>
            <button type="button" className="text-[11.5px]" onClick={selectNone} style={{ color: "var(--fg-4)" }}>None</button>
          </div>
        </div>
        <div className="card overflow-hidden" style={{ background: "var(--bg-2)" }}>
          {documents.length === 0 ? (
            <div className="p-4 text-[12.5px]" style={{ color: "var(--fg-5)" }}>
              No documents on this deal yet.
            </div>
          ) : (
            documents.map((d, i) => {
              const checked = selected.has(d.id);
              return (
                <label
                  key={d.id}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer"
                  style={{
                    borderTop: i === 0 ? "none" : "1px solid var(--divider)",
                    background: checked ? "var(--surface)" : "transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleDoc(d.id)}
                  />
                  <span className="text-[13px] truncate" style={{ flex: 1, color: "var(--fg-2)" }}>
                    {d.filename}
                  </span>
                  <span className="num text-[11.5px] mono" style={{ color: "var(--fg-5)" }}>
                    {d.approved}/{d.total}
                  </span>
                </label>
              );
            })
          )}
        </div>
        <p className="text-[11.5px] mt-1.5" style={{ color: "var(--fg-5)" }}>
          {selected.size === 0
            ? "Pick at least one document to enable export."
            : `${selected.size} document${selected.size === 1 ? "" : "s"} · ${totalApproved}/${totalSelected} questions approved`}
        </p>
      </div>

      {/* Mode selector — only relevant with 2+ docs */}
      {selected.size > 1 && (
        <div>
          <label className="text-[12px] font-medium block mb-2" style={{ color: "var(--fg-3)" }}>
            How to export
          </label>
          <div className="flex gap-2">
            <ModeOption
              active={mode === "merge"}
              onClick={() => setMode("merge")}
              label="Merge into one file"
              detail="One proposal with a section per document."
            />
            <ModeOption
              active={mode === "separate"}
              onClick={() => setMode("separate")}
              label="Export each separately"
              detail="One file per selected document."
            />
          </div>
        </div>
      )}

      {/* Template */}
      <div>
        <label className="text-[12px] font-medium block mb-2" style={{ color: "var(--fg-3)" }}>
          Branding template
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="select"
            style={{ width: 280 }}
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">— None (plain output) —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.kind === "docx" ? "📄 " : ""}{t.name}
                {t.is_default ? " (default)" : ""}
                {t.kind === "docx" ? " — golden .docx" : ""}
              </option>
            ))}
          </select>
          <a href="/templates" className="text-[11.5px]" style={{ color: "var(--accent)" }}>
            Manage templates →
          </a>
        </div>
        {templateId && templates.find((t) => t.id === templateId)?.kind === "docx" && (
          <p className="text-[11.5px] mt-1.5" style={{ color: "var(--fg-5)" }}>
            .docx export will be filled into your uploaded template (structure preserved). PDF falls back to plain rendering.
          </p>
        )}
      </div>

      {/* Citation style */}
      <div className="flex items-center gap-3">
        <label className="text-[12px]" style={{ color: "var(--fg-3)" }}>Citation style:</label>
        <select
          className="select"
          style={{ width: 160 }}
          value={citationStyle}
          onChange={(e) => setCitationStyle(e.target.value as "inline" | "footnote")}
        >
          <option value="inline">Inline</option>
          <option value="footnote">Footnotes</option>
        </select>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          className="btn btn-primary"
          onClick={() => doExport("docx")}
          disabled={busy !== null || selected.size === 0}
        >
          {busy === "docx"
            ? progress ?? "Generating Word…"
            : `Generate ${fileCount > 1 ? `${fileCount} .docx files` : "& download .docx"}`}
        </button>
        <button
          className="btn"
          onClick={() => doExport("pdf")}
          disabled={busy !== null || selected.size === 0}
        >
          {busy === "pdf" ? progress ?? "Generating PDF…" : `Or ${fileCount > 1 ? `${fileCount} PDFs` : "PDF"}`}
        </button>
        {willMerge && (
          <span className="text-[11.5px]" style={{ color: "var(--fg-5)" }}>
            → one merged file
          </span>
        )}
        {err && (
          <span className="text-xs" style={{ color: "var(--err)" }}>
            {err}
          </span>
        )}
      </div>
    </div>
  );
}

function ModeOption({
  active, onClick, label, detail,
}: { active: boolean; onClick: () => void; label: string; detail: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card"
      style={{
        flex: 1,
        textAlign: "left",
        padding: 12,
        cursor: "pointer",
        borderColor: active ? "var(--accent)" : "var(--border)",
        background: active ? "var(--accent-tint)" : "var(--surface)",
      }}
    >
      <div className="flex items-center gap-2 mb-0.5">
        <span
          style={{
            width: 12, height: 12, borderRadius: "50%",
            border: `2px solid ${active ? "var(--accent)" : "var(--border-strong)"}`,
            background: active ? "var(--accent)" : "transparent",
            boxShadow: active ? "inset 0 0 0 2px white" : "none",
            flexShrink: 0,
          }}
        />
        <span className="text-[12.5px] font-semibold" style={{ color: active ? "var(--accent-2)" : "var(--fg)" }}>
          {label}
        </span>
      </div>
      <div className="text-[11.5px]" style={{ color: "var(--fg-4)" }}>{detail}</div>
    </button>
  );
}
