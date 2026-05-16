"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TriageActions({
  documentId,
  dealId,
  status,
}: {
  documentId: string;
  dealId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function reprocess() {
    if (busy) return;
    if (!confirm("Re-run the full agent pipeline? This makes real LLM calls.")) return;
    setBusy(true);
    const res = await fetch("/api/documents/process", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ document_id: documentId }),
    });
    setBusy(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed" }));
      alert(error || "Failed");
    }
    router.refresh();
  }

  const isProcessing = ["extracting", "chunked", "analyzing", "structured"].includes(status);

  return (
    <button onClick={reprocess} className="btn" disabled={busy || isProcessing}>
      {busy ? "Running…" : isProcessing ? "Processing…" : "Re-run pipeline"}
    </button>
  );
}
