"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Select from "@/components/Select";

type Doc = { id: string; filename: string; total: number; approved: number };
type Template = { id: string; name: string; kind: string | null; is_default: boolean };

type PreviewItem = {
  requirement_id: string | null;
  question_text: string;
  answer: string;
  gap_flag: string | null;
  has_approved: boolean;
  citations: { document_filename: string; page: number | null }[];
};

type PreviewSection = { heading: string; items: PreviewItem[] };

type PreviewData = {
  deal_name: string;
  client_name: string | null;
  org_name: string | null;
  citation_style: "inline" | "footnote";
  stats: { total: number; approved: number; gaps: number };
  sections: PreviewSection[];
};

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
  const [selected, setSelected] = useState<Set<string>>(
    new Set(documents.map((d) => d.id))
  );
  const [mode, setMode] = useState<"merge" | "separate">("merge");

  // Preview state
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  function toggleDoc(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    setPreview(null); // stale
  }
  function selectAll() { setSelected(new Set(documents.map((d) => d.id))); setPreview(null); }
  function selectNone() { setSelected(new Set()); setPreview(null); }

  async function generateOne(format: "pdf" | "docx", docIds: string[], merge: boolean) {
    const res = await fetch("/api/exports/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        deal_id: dealId,
        document_ids: docIds,
        document_id: docIds[0],
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
    if (ids.length === 0) { setErr("Pick at least one document."); setBusy(null); return; }
    try {
      if (mode === "merge" || ids.length === 1) {
        const id = await generateOne(format, ids, ids.length > 1);
        router.refresh();
        window.open(`/api/exports/${id}/download`, "_blank");
      } else {
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

  async function doPreview() {
    const ids = Array.from(selected);
    if (ids.length === 0) { setPreviewErr("Pick at least one document."); return; }
    setPreviewBusy(true);
    setPreviewErr(null);
    try {
      const params = new URLSearchParams({ deal_id: dealId, citation_style: citationStyle });
      if (mode === "merge" && ids.length > 1) params.set("merge", "1");
      ids.forEach((id) => params.append("doc_id", id));
      const res = await fetch(`/api/exports/preview?${params}`);
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(error || "Preview failed");
      }
      const data: PreviewData = await res.json();
      setPreview(data);
      setPreviewOpen(true);
    } catch (e: any) {
      setPreviewErr(e.message || "Preview failed");
    } finally {
      setPreviewBusy(false);
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
            <div className="p-4 text-[12.5px]" style={{ color: "var(--fg-5)" }}>No documents on this deal yet.</div>
          ) : (
            documents.map((d, i) => {
              const checked = selected.has(d.id);
              return (
                <label key={d.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer"
                  style={{ borderTop: i === 0 ? "none" : "1px solid var(--divider)", background: checked ? "var(--surface)" : "transparent" }}>
                  <input type="checkbox" checked={checked} onChange={() => toggleDoc(d.id)} />
                  <span className="text-[13px] truncate" style={{ flex: 1, color: "var(--fg-2)" }}>{d.filename}</span>
                  <span className="num text-[11.5px] mono" style={{ color: "var(--fg-5)" }}>{d.approved}/{d.total}</span>
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

      {/* Mode selector */}
      {selected.size > 1 && (
        <div>
          <label className="text-[12px] font-medium block mb-2" style={{ color: "var(--fg-3)" }}>How to export</label>
          <div className="flex gap-2">
            <ModeOption active={mode === "merge"} onClick={() => setMode("merge")} label="Merge into one file" detail="One proposal with a section per document." />
            <ModeOption active={mode === "separate"} onClick={() => setMode("separate")} label="Export each separately" detail="One file per selected document." />
          </div>
        </div>
      )}

      {/* Template */}
      <div>
        <label className="text-[12px] font-medium block mb-2" style={{ color: "var(--fg-3)" }}>Branding template</label>
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={templateId}
            onChange={setTemplateId}
            wrapperStyle={{ width: 280 }}
            placeholder="— None (plain output) —"
            options={[
              { value: "", label: "— None (plain output) —" },
              ...templates.map((t) => ({
                value: t.id,
                label: `${t.kind === "docx" ? "📄 " : ""}${t.name}${t.is_default ? " (default)" : ""}${t.kind === "docx" ? " — golden .docx" : ""}`,
              })),
            ]}
          />
          <a href="/templates" className="text-[11.5px]" style={{ color: "var(--accent)" }}>Manage templates →</a>
        </div>
        {templateId && templates.find((t) => t.id === templateId)?.kind === "docx" && (
          <p className="text-[11.5px] mt-1.5" style={{ color: "var(--fg-5)" }}>
            .docx export will be filled into your uploaded template. PDF falls back to plain rendering.
          </p>
        )}
      </div>

      {/* Citation style */}
      <div className="flex items-center gap-3">
        <label className="text-[12px]" style={{ color: "var(--fg-3)" }}>Citation style:</label>
        <Select
          value={citationStyle}
          onChange={(v) => setCitationStyle(v as "inline" | "footnote")}
          wrapperStyle={{ width: 160 }}
          options={[
            { value: "inline", label: "Inline" },
            { value: "footnote", label: "Footnotes" },
          ]}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button className="btn btn-primary" onClick={() => doExport("docx")} disabled={busy !== null || selected.size === 0}>
          {busy === "docx" ? progress ?? "Generating Word…" : `Generate ${fileCount > 1 ? `${fileCount} .docx files` : "& download .docx"}`}
        </button>
        <button className="btn" onClick={() => doExport("pdf")} disabled={busy !== null || selected.size === 0}>
          {busy === "pdf" ? progress ?? "Generating PDF…" : `Or ${fileCount > 1 ? `${fileCount} PDFs` : "PDF"}`}
        </button>
        <button className="btn" onClick={doPreview} disabled={previewBusy || selected.size === 0}
          style={{ marginLeft: "auto" }}>
          {previewBusy ? "Loading preview…" : "Preview document"}
        </button>
        {willMerge && <span className="text-[11.5px]" style={{ color: "var(--fg-5)" }}>→ one merged file</span>}
        {err && <span className="text-xs" style={{ color: "var(--err)" }}>{err}</span>}
        {previewErr && <span className="text-xs" style={{ color: "var(--err)" }}>{previewErr}</span>}
      </div>

      {/* Preview pane */}
      {previewOpen && preview && (
        <DocumentPreview data={preview} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  );
}

/* ─── Document preview pane ──────────────────────────────────────────────── */

function DocumentPreview({ data, onClose }: { data: PreviewData; onClose: () => void }) {
  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const allItems = data.sections.flatMap((s) => s.items);
  const unapproved = allItems.filter((i) => !i.has_approved).length;

  return (
    <div style={{ marginTop: 8 }}>
      {/* Header bar */}
      <div className="flex items-center justify-between mb-3">
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg-3)" }}>
          Document preview
          {data.stats.gaps > 0 && (
            <span style={{ marginLeft: 10, color: "var(--err)", fontWeight: 500, fontSize: 11.5 }}>
              {data.stats.gaps} gap{data.stats.gaps === 1 ? "" : "s"} need review
            </span>
          )}
          {unapproved > 0 && (
            <span style={{ marginLeft: 10, color: "var(--warn)", fontWeight: 500, fontSize: 11.5 }}>
              {unapproved} unapproved
            </span>
          )}
        </div>
        <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 12, height: 26, padding: "0 8px" }}>
          Close ✕
        </button>
      </div>

      {/* Paper */}
      <div style={{
        background: "white",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        boxShadow: "0 4px 24px oklch(0.20 0.025 264 / 0.08)",
        maxHeight: "72vh",
        overflowY: "auto",
        padding: "48px 56px",
        fontFamily: "'Georgia', 'Times New Roman', serif",
        lineHeight: 1.65,
        color: "#1a1a2e",
      }}>
        {/* Title block */}
        <div style={{ borderBottom: "2px solid #3B47D6", paddingBottom: 20, marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b7280", marginBottom: 8, fontFamily: "system-ui, sans-serif" }}>
            RFP Response Proposal
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: "#0f1626", margin: 0, lineHeight: 1.2, fontFamily: "system-ui, sans-serif" }}>
            {data.deal_name}
          </h1>
          {data.client_name && (
            <p style={{ fontSize: 14, color: "#5b6478", margin: "6px 0 0", fontFamily: "system-ui, sans-serif" }}>
              Prepared for {data.client_name}
            </p>
          )}
          {data.org_name && (
            <p style={{ fontSize: 13, color: "#8a93a6", margin: "3px 0 0", fontFamily: "system-ui, sans-serif" }}>
              Submitted by {data.org_name}
            </p>
          )}
          <p style={{ fontSize: 12, color: "#9ca3af", margin: "10px 0 0", fontFamily: "system-ui, sans-serif" }}>{today}</p>
        </div>

        {/* Sections / items */}
        {data.sections.map((section, si) => (
          <div key={si} style={{ marginBottom: 40 }}>
            {data.sections.length > 1 && (
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#3B47D6", margin: "0 0 20px", fontFamily: "system-ui, sans-serif", paddingBottom: 8, borderBottom: "1px solid #e5e7eb" }}>
                {section.heading}
              </h2>
            )}
            {section.items.map((item, ii) => (
              <div key={ii} style={{ marginBottom: 28, paddingBottom: 28, borderBottom: ii < section.items.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                {item.requirement_id && (
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3B47D6", marginBottom: 5, fontFamily: "system-ui, sans-serif" }}>
                    {item.requirement_id}
                  </div>
                )}
                <p style={{ fontSize: 14, fontWeight: 600, color: "#0f1626", margin: "0 0 10px", fontFamily: "system-ui, sans-serif", lineHeight: 1.4 }}>
                  {item.question_text}
                </p>
                {item.gap_flag === "no_source" ? (
                  <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "10px 14px", fontSize: 13, color: "#dc2626", fontFamily: "system-ui, sans-serif" }}>
                    ⚠ No source found in knowledge base. Human review required before submission.
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: 13.5, color: "#374151", margin: 0, whiteSpace: "pre-wrap" }}>
                      {item.answer}
                    </p>
                    {data.citation_style === "inline" && item.citations.length > 0 && (
                      <p style={{ fontSize: 11.5, color: "#9ca3af", margin: "8px 0 0", fontFamily: "system-ui, sans-serif" }}>
                        {item.citations.map((c, ci) => (
                          <span key={ci}>
                            {ci > 0 ? "  " : ""}
                            [Source: {c.document_filename}{c.page != null ? `, p.${c.page}` : ""}]
                          </span>
                        ))}
                      </p>
                    )}
                    {!item.has_approved && (
                      <span style={{ display: "inline-block", marginTop: 6, fontSize: 10.5, fontWeight: 600, color: "#d97706", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 4, padding: "1px 7px", fontFamily: "system-ui, sans-serif" }}>
                        Draft — not yet approved
                      </span>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Mode option ────────────────────────────────────────────────────────── */

function ModeOption({ active, onClick, label, detail }: { active: boolean; onClick: () => void; label: string; detail: string }) {
  return (
    <button type="button" onClick={onClick} className="card"
      style={{ flex: 1, textAlign: "left", padding: 12, cursor: "pointer", borderColor: active ? "var(--accent)" : "var(--border)", background: active ? "var(--accent-tint)" : "var(--surface)" }}>
      <div className="flex items-center gap-2 mb-0.5">
        <span style={{ width: 12, height: 12, borderRadius: "50%", border: `2px solid ${active ? "var(--accent)" : "var(--border-strong)"}`, background: active ? "var(--accent)" : "transparent", boxShadow: active ? "inset 0 0 0 2px white" : "none", flexShrink: 0 }} />
        <span className="text-[12.5px] font-semibold" style={{ color: active ? "var(--accent-2)" : "var(--fg)" }}>{label}</span>
      </div>
      <div className="text-[11.5px]" style={{ color: "var(--fg-4)" }}>{detail}</div>
    </button>
  );
}
