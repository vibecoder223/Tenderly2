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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function exportPdf() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/exports/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deal_id: dealId, document_id: documentId }),
    });
    setBusy(false);
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
    <div className="flex items-center gap-2">
      <button className="btn btn-primary" onClick={exportPdf} disabled={busy}>
        {busy ? "Generating PDF…" : "Generate & download PDF"}
      </button>
      {err && <span className="text-xs" style={{ color: "var(--err)" }}>{err}</span>}
    </div>
  );
}
