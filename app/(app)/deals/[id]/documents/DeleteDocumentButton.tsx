"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteDocumentButton({
  documentId,
  filename,
}: {
  documentId: string;
  filename: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function del() {
    setBusy(true);
    const res = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Delete failed" }));
      alert(error || "Delete failed");
      return;
    }
    router.refresh();
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-[11.5px]" style={{ color: "var(--fg-4)" }}>Delete?</span>
        <button
          className="btn"
          onClick={del}
          disabled={busy}
          style={{ background: "var(--err)", color: "white", borderColor: "transparent", padding: "4px 10px" }}
          title={`Delete ${filename} and all its extracted questions`}
        >
          {busy ? "…" : "Yes"}
        </button>
        <button
          className="btn"
          onClick={() => setConfirming(false)}
          disabled={busy}
          style={{ padding: "4px 10px" }}
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      className="btn"
      onClick={() => setConfirming(true)}
      style={{ color: "var(--err)", padding: "4px 10px" }}
      title="Delete this document and its questions"
    >
      Delete
    </button>
  );
}
