"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";

type KDoc = {
  id: string;
  filename: string;
  doc_type: string;
  ingestion_status: string;
  page_count: number | null;
  file_size: number | null;
  created_at: string;
  error_message: string | null;
  is_sample?: boolean;
};

const docTypeLabel: Record<string, string> = {
  past_proposal: "Past proposal",
  security_doc: "Security doc",
  policy: "Policy",
  other: "Other",
};

type Step = { key: string; label: string; detail: string };
const STEPS: Step[] = [
  { key: "uploading",   label: "Uploading file",     detail: "Sending to secure storage…" },
  { key: "downloading", label: "Fetching file",      detail: "Loading file for processing…" },
  { key: "parsing",     label: "Parsing document",   detail: "Extracting pages, headings, blocks…" },
  { key: "chunking",    label: "Chunking content",   detail: "Splitting into searchable segments…" },
  { key: "embedding",   label: "Embedding chunks",   detail: "Generating semantic vectors via Jina AI…" },
  { key: "storing",     label: "Indexing",           detail: "Writing to vector store…" },
  { key: "ready",       label: "Done",               detail: "Document ready for retrieval." },
];
const STAGE_TO_STEP: Record<string, number> = {
  uploading: 0, downloading: 1, parsing: 2, chunking: 3, embedding: 4, storing: 5, ready: 6,
};

export default function KnowledgeView({ initial }: { initial: KDoc[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [items, setItems] = useState<KDoc[]>(initial);
  const [docType, setDocType] = useState("past_proposal");
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [currentFile, setCurrentFile] = useState<string>("");
  const [stepIdx, setStepIdx] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);
  useEffect(() => () => stopPolling(), [stopPolling]);

  function pollDoc(id: string): Promise<void> {
    return new Promise((resolve) => {
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/knowledge/${id}`);
          if (!res.ok) return;
          const { knowledge_document: doc } = await res.json();
          if (doc.stage) {
            setStepIdx(STAGE_TO_STEP[doc.stage] ?? stepIdx);
          }
          if (doc.ingestion_status === "ready") {
            setStepIdx(STEPS.length - 1);
            stopPolling();
            resolve();
          } else if (doc.ingestion_status === "failed") {
            stopPolling();
            setErr(doc.error_message || "Ingestion failed");
            resolve();
          }
        } catch { /* transient */ }
      }, 1200);
    });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErr(null);
    setProcessing(true);
    for (const file of Array.from(files)) {
      setCurrentFile(file.name);
      setStepIdx(0);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("doc_type", docType);
      const res = await fetch("/api/knowledge/upload", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json.error || `Failed to upload ${file.name}`);
        continue;
      }
      const docId = json.knowledge_document?.id;
      if (docId) {
        await pollDoc(docId);
      }
    }
    setProcessing(false);
    setCurrentFile("");
    router.refresh();
    const r = await fetch("/api/knowledge");
    if (r.ok) setItems((await r.json()).items ?? []);
  }

  async function remove(id: string) {
    if (!confirm("Delete this document and its chunks?")) return;
    const res = await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed" }));
      setErr(error || "Delete failed");
      return;
    }
    setItems((xs) => xs.filter((x) => x.id !== id));
    router.refresh();
  }

  async function reingest(id: string) {
    const res = await fetch(`/api/knowledge/${id}/reingest`, { method: "POST" });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Retry failed" }));
      setErr(error || "Retry failed");
      return;
    }
    // Optimistic: flip to "pending" locally so the badge moves immediately.
    setItems((xs) =>
      xs.map((x) =>
        x.id === id ? { ...x, ingestion_status: "pending", error_message: null } : x,
      ),
    );
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="card p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--fg)" }}>
            Knowledge base
          </h2>
          <p className="text-[13px]" style={{ color: "var(--fg-4)" }}>
            Past proposals, security documents, policies. TenderOps retrieves from
            these to draft cited answers to RFP requirements.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div style={{ width: 200 }}>
            <label className="label">Document type</label>
            <select
              className="select"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
            >
              <option value="past_proposal">Past proposal</option>
              <option value="security_doc">Security doc</option>
              <option value="policy">Policy</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {processing ? (
          <div className="space-y-5 p-2">
            <style>{`
              @keyframes spin { to { transform: rotate(360deg) } }
              @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
            `}</style>
            <div>
              <div className="text-[13px] font-semibold mb-0.5" style={{ color: "var(--fg)" }}>
                {currentFile} — {stepIdx >= STEPS.length - 1 ? "Done" : `Step ${Math.min(stepIdx + 1, STEPS.length)} of ${STEPS.length}`}
              </div>
              <div className="text-[11.5px]" style={{ color: "var(--fg-4)" }}>
                {STEPS[Math.min(stepIdx, STEPS.length - 1)].detail}
              </div>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 4, background: "var(--bg-2)" }}>
              <div
                style={{
                  width: `${Math.round((stepIdx / (STEPS.length - 1)) * 100)}%`,
                  height: "100%",
                  background: "var(--accent)",
                  borderRadius: 999,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
            <div className="space-y-3">
              {STEPS.map((step, i) => {
                const state: "done" | "active" | "pending" =
                  i < stepIdx ? "done" : i === stepIdx ? "active" : "pending";
                return (
                  <div key={step.key} className="flex items-center gap-3">
                    <div
                      style={{
                        width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background:
                          state === "done"   ? "var(--ok)" :
                          state === "active" ? "var(--accent)" :
                          "var(--bg-2)",
                        border: state === "pending" ? "1.5px solid var(--border-strong)" : "none",
                      }}
                    >
                      {state === "done" ? (
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                          <polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : state === "active" ? (
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "white", animation: "pulse 1s ease-in-out infinite" }} />
                      ) : (
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--border-strong)" }} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="text-[12.5px] font-medium" style={{ color: state === "active" ? "var(--fg)" : state === "done" ? "var(--fg-3)" : "var(--fg-5)" }}>
                        {step.label}
                      </div>
                      {state === "active" && (
                        <div className="text-[11px]" style={{ color: "var(--fg-4)" }}>{step.detail}</div>
                      )}
                    </div>
                    {state === "active" && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                        strokeLinecap="round" style={{ color: "var(--accent)", animation: "spin 1s linear infinite", flexShrink: 0 }}>
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
            {err && (
              <div className="text-[12px] px-3 py-2 rounded" style={{ color: "var(--err)", background: "var(--err-tint, #fff0f0)" }}>
                {err}
              </div>
            )}
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className="p-7 text-center cursor-pointer rounded-md transition-colors"
            style={{
              borderStyle: "dashed",
              borderWidth: 1,
              borderColor: dragging ? "var(--accent)" : "var(--border-strong)",
              background: dragging ? "var(--accent-tint)" : "var(--bg-2)",
            }}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <div className="text-sm font-medium" style={{ color: "var(--fg)" }}>
              Drop files here, or click to select
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--fg-4)" }}>
              PDF, DOCX, or TXT. Each upload is parsed, chunked, and embedded for retrieval.
            </div>
            {err && <div className="text-xs mt-3" style={{ color: "var(--err)" }}>{err}</div>}
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div
          className="px-5 py-3.5 border-b flex items-center justify-between"
          style={{ borderColor: "var(--divider)" }}
        >
          <h3 className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
            Documents ({items.length})
          </h3>
        </div>
        {items.length === 0 ? (
          <div className="p-10 text-center text-sm" style={{ color: "var(--fg-4)" }}>
            No knowledge base documents yet. Upload your past proposals, security
            docs, and policies above.
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ color: "var(--fg-4)" }}>
                <th className="text-left font-medium px-5 py-2.5">File</th>
                <th className="text-left font-medium px-5 py-2.5">Type</th>
                <th className="text-left font-medium px-5 py-2.5">Status</th>
                <th className="text-right font-medium px-5 py-2.5">Pages</th>
                <th className="text-left font-medium px-5 py-2.5">Uploaded</th>
                <th className="text-right font-medium px-5 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id} className="border-t align-top" style={{ borderColor: "var(--divider)" }}>
                  <td className="px-5 py-3">
                    <div className="font-medium inline-flex items-center gap-2" style={{ color: "var(--fg)" }}>
                      {d.filename}
                      {d.is_sample && (
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: "var(--accent-tint)",
                            color: "var(--accent-2)",
                            lineHeight: 1.2,
                            flexShrink: 0,
                          }}
                        >
                          Sample
                        </span>
                      )}
                    </div>
                    {d.error_message && (
                      <div
                        className="text-[11.5px] mt-0.5"
                        style={{
                          color:
                            d.ingestion_status === "failed"
                              ? "var(--err)"
                              : "var(--fg-4)",
                        }}
                      >
                        {d.error_message}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3" style={{ color: "var(--fg-3)" }}>
                    <span className="badge">{docTypeLabel[d.doc_type] ?? d.doc_type}</span>
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={d.ingestion_status} />
                  </td>
                  <td
                    className="px-5 py-3 text-right num"
                    style={{ color: "var(--fg-3)" }}
                  >
                    {d.page_count ?? "—"}
                  </td>
                  <td className="px-5 py-3" style={{ color: "var(--fg-4)" }}>
                    {formatDate(d.created_at)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="inline-flex items-center gap-2">
                      {d.ingestion_status === "failed" && (
                        <button onClick={() => reingest(d.id)} className="btn">
                          Retry
                        </button>
                      )}
                      <button onClick={() => remove(d.id)} className="btn btn-danger">
                        Delete
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ISO-style date format that's stable across server/client locales.
function formatDate(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}
