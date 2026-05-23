"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type Step = {
  key: string;
  label: string;
  detail: string;
};

const STEPS: Step[] = [
  { key: "uploading",  label: "Uploading file",           detail: "Sending to secure storage…" },
  { key: "extracting", label: "Extracting text",           detail: "Parsing document structure and pages…" },
  { key: "chunked",    label: "Chunking content",          detail: "Splitting into searchable segments…" },
  { key: "analyzing",  label: "Analysing requirements",    detail: "Identifying RFP requirements with AI…" },
  { key: "structured", label: "Structuring questions",     detail: "Building compliance matrix…" },
  { key: "completed",  label: "Done",                      detail: "All questions ready." },
];

const STATUS_TO_STEP: Record<string, number> = {
  uploading:  0,
  uploaded:   0,
  extracting: 1,
  chunked:    2,
  analyzing:  3,
  structured: 4,
  completed:  5,
};

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="rounded-full overflow-hidden" style={{ height: 4, background: "var(--bg-2)" }}>
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: "var(--accent)",
          borderRadius: 999,
          transition: "width 0.4s ease",
        }}
      />
    </div>
  );
}

function StepRow({ step, state }: { step: Step; state: "done" | "active" | "pending" }) {
  return (
    <div className="flex items-center gap-3">
      {/* Icon */}
      <div
        style={{
          width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background:
            state === "done"   ? "var(--ok)" :
            state === "active" ? "var(--accent)" :
            "var(--bg-2)",
          border: state === "pending" ? "1.5px solid var(--border-strong)" : "none",
          transition: "background 0.3s",
        }}
      >
        {state === "done" ? (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : state === "active" ? (
          <div style={{
            width: 7, height: 7, borderRadius: "50%", background: "white",
            animation: "pulse 1s ease-in-out infinite",
          }} />
        ) : (
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--border-strong)" }} />
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          className="text-[12.5px] font-medium"
          style={{
            color: state === "active" ? "var(--fg)" : state === "done" ? "var(--fg-3)" : "var(--fg-5)",
          }}
        >
          {step.label}
        </div>
        {state === "active" && (
          <div className="text-[11px]" style={{ color: "var(--fg-4)" }}>
            {step.detail}
          </div>
        )}
      </div>

      {/* Spinner for active */}
      {state === "active" && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" style={{ color: "var(--accent)", animation: "spin 1s linear infinite", flexShrink: 0 }}>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
      )}
    </div>
  );
}

export default function UploadCard({ dealId }: { dealId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [dragging, setDragging]     = useState(false);
  const [processing, setProcessing] = useState(false);
  const [stepIdx, setStepIdx]       = useState(0);
  const [err, setErr]               = useState<string | null>(null);

  const pct = Math.round((stepIdx / (STEPS.length - 1)) * 100);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  function startPolling(docId: string) {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/documents/${docId}`);
        if (!res.ok) return;
        const { document: doc } = await res.json();
        const idx = STATUS_TO_STEP[doc.processing_status] ?? 0;
        setStepIdx(idx);

        if (doc.processing_status === "completed") {
          stopPolling();
          setTimeout(() => {
            router.push(`/deals/${dealId}/triage?doc=${docId}`);
            router.refresh();
          }, 600);
        } else if (doc.processing_status === "failed") {
          stopPolling();
          setErr(doc.error_message || "Processing failed. Please try again.");
          setProcessing(false);
        }
      } catch { /* ignore transient errors */ }
    }, 1500);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    setErr(null);
    setProcessing(true);
    setStepIdx(0);

    // 1. Upload
    const fd = new FormData();
    fd.append("file", file);
    fd.append("deal_id", dealId);
    const uploadRes = await fetch("/api/documents/upload", { method: "POST", body: fd });
    if (!uploadRes.ok) {
      const { error } = await uploadRes.json().catch(() => ({ error: "Upload failed" }));
      setErr(error || "Upload failed");
      setProcessing(false);
      return;
    }
    const { document } = await uploadRes.json();

    // 2. Start pipeline (fire and forget — we poll for status)
    setStepIdx(1);
    startPolling(document.id);

    fetch("/api/documents/process", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ document_id: document.id }),
    }).then(async (res) => {
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Processing failed" }));
        stopPolling();
        setErr(error || "Processing failed");
        setProcessing(false);
      }
    }).catch((e) => {
      stopPolling();
      setErr(e.message || "Processing failed");
      setProcessing(false);
    });
  }

  if (processing) {
    return (
      <div className="card p-6 space-y-5">
        <style>{`
          @keyframes spin { to { transform: rotate(360deg) } }
          @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
        `}</style>

        {/* Header */}
        <div>
          <div className="text-[13px] font-semibold mb-0.5" style={{ color: "var(--fg)" }}>
            {stepIdx >= STEPS.length - 1 ? "Processing complete" : `Step ${Math.min(stepIdx + 1, STEPS.length)} of ${STEPS.length}`}
          </div>
          <div className="text-[11.5px]" style={{ color: "var(--fg-4)" }}>
            {STEPS[Math.min(stepIdx, STEPS.length - 1)].detail}
          </div>
        </div>

        {/* Progress bar */}
        <ProgressBar pct={pct} />

        {/* Step list */}
        <div className="space-y-3">
          {STEPS.map((step, i) => {
            const state = i < stepIdx ? "done" : i === stepIdx ? "active" : "pending";
            return <StepRow key={step.key} step={step} state={state} />;
          })}
        </div>

        {err && (
          <div className="text-[12px] px-3 py-2 rounded" style={{ color: "var(--err)", background: "var(--err-tint, #fff0f0)" }}>
            {err}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      onClick={() => inputRef.current?.click()}
      className="card p-8 text-center cursor-pointer"
      style={{
        borderStyle: "dashed",
        borderWidth: 1,
        borderColor: dragging ? "var(--accent)" : "var(--border-strong)",
        background: dragging ? "var(--accent-tint)" : undefined,
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="mb-3">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
          style={{ color: "var(--fg-4)", margin: "0 auto" }}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </div>
      <div className="text-sm font-medium" style={{ color: "var(--fg)" }}>
        Drop an RFP file here, or click to select
      </div>
      <div className="text-xs mt-1" style={{ color: "var(--fg-4)" }}>
        PDF, DOCX, or TXT — AI extracts and answers all requirements automatically
      </div>
      {err && <div className="text-xs mt-3" style={{ color: "var(--err)" }}>{err}</div>}
    </div>
  );
}
