"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadCard({ dealId }: { dealId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    setErr(null);
    setProgress(`Uploading ${file.name}…`);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("deal_id", dealId);

    const uploadRes = await fetch("/api/documents/upload", { method: "POST", body: fd });
    if (!uploadRes.ok) {
      setProgress(null);
      const { error } = await uploadRes.json().catch(() => ({ error: "Upload failed" }));
      setErr(error || "Upload failed");
      return;
    }
    const { document } = await uploadRes.json();

    setProgress("Extracting & analyzing…");
    const processRes = await fetch("/api/documents/process", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ document_id: document.id }),
    });
    if (!processRes.ok) {
      const { error } = await processRes.json().catch(() => ({ error: "Processing failed" }));
      setErr(error || "Processing failed");
      setProgress(null);
      router.refresh();
      return;
    }

    setProgress(null);
    router.push(`/deals/${dealId}/triage?doc=${document.id}`);
    router.refresh();
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => !progress && inputRef.current?.click()}
      className="card p-8 text-center cursor-pointer transition-colors"
      style={{
        borderStyle: "dashed",
        borderWidth: 1,
        borderColor: dragging ? "var(--accent)" : "var(--border-strong)",
        background: dragging ? "var(--accent-tint)" : undefined,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="mb-2">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: "var(--fg-4)", margin: "0 auto" }}
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>
      {progress ? (
        <>
          <div className="text-sm font-medium" style={{ color: "var(--fg)" }}>{progress}</div>
          <div className="text-xs mt-1" style={{ color: "var(--fg-4)" }}>
            This may take 30–90 seconds for typical RFPs.
          </div>
        </>
      ) : (
        <>
          <div className="text-sm font-medium" style={{ color: "var(--fg)" }}>
            Drop an RFP file here, or click to select
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--fg-4)" }}>
            PDF, DOCX, or TXT. Text is extracted and the agent pipeline runs automatically.
          </div>
        </>
      )}
      {err && <div className="text-xs mt-3" style={{ color: "var(--err)" }}>{err}</div>}
    </div>
  );
}
