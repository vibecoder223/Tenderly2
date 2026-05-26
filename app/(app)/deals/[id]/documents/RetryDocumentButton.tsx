"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RetryDocumentButton({
  documentId,
}: {
  documentId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function retry() {
    setBusy(true);
    const res = await fetch("/api/documents/process", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ document_id: documentId }),
    });
    setBusy(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Retry failed" }));
      alert(error || "Retry failed");
      return;
    }
    router.refresh();
  }

  return (
    <button
      className="btn"
      onClick={retry}
      disabled={busy}
      title="Re-run the AI pipeline on this document"
      style={{ padding: "4px 10px" }}
    >
      {busy ? "Retrying…" : "Retry"}
    </button>
  );
}
