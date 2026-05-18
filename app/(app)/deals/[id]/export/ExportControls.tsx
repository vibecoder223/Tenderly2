"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ExportControls({
  dealId,
  documentId,
}: {
  dealId: string;
  documentId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "pdf" | "docx">(null);
  const [err, setErr] = useState<string | null>(null);
  const [citationStyle, setCitationStyle] = useState<"inline" | "footnote">("inline");

  async function doExport(format: "pdf" | "docx") {
    setBusy(format);
    setErr(null);
    const res = await fetch("/api/exports/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        deal_id: dealId,
        document_id: documentId,
        format,
        citation_style: citationStyle,
      }),
    });
    setBusy(null);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed" }));
      setErr(error || "Export failed");
      return;
    }
    const { exportId } = await res.json();
    router.refresh();
    window.open(`/api/exports/${exportId}/download`, "_blank");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-[12px]" style={{ color: "var(--fg-3)" }}>
          Citation style:
        </label>
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
      <div className="flex items-center gap-2">
        <button
          className="btn btn-primary"
          onClick={() => doExport("docx")}
          disabled={busy !== null}
        >
          {busy === "docx" ? "Generating Word…" : "Generate & download .docx"}
        </button>
        <button className="btn" onClick={() => doExport("pdf")} disabled={busy !== null}>
          {busy === "pdf" ? "Generating PDF…" : "Or PDF"}
        </button>
        {err && (
          <span className="text-xs" style={{ color: "var(--err)" }}>
            {err}
          </span>
        )}
      </div>
    </div>
  );
}
