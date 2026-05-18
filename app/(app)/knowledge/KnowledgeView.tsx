"use client";

import { useRef, useState } from "react";
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
};

const docTypeLabel: Record<string, string> = {
  past_proposal: "Past proposal",
  security_doc: "Security doc",
  policy: "Policy",
  other: "Other",
};

export default function KnowledgeView({ initial }: { initial: KDoc[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<KDoc[]>(initial);
  const [docType, setDocType] = useState("past_proposal");
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErr(null);
    for (const file of Array.from(files)) {
      setProgress(`Ingesting ${file.name}…`);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("doc_type", docType);
      const res = await fetch("/api/knowledge/upload", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json.error || `Failed to ingest ${file.name}`);
        // Still refresh — the doc may exist in failed state
      }
    }
    setProgress(null);
    router.refresh();
    // Optimistic local refresh
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

  return (
    <div className="space-y-6">
      <div className="card p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--fg)" }}>
            Knowledge base
          </h2>
          <p className="text-[13px]" style={{ color: "var(--fg-4)" }}>
            Past proposals, security documents, policies. Tenderly retrieves from
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
          {progress ? (
            <>
              <div className="text-sm font-medium" style={{ color: "var(--fg)" }}>{progress}</div>
              <div className="text-xs mt-1" style={{ color: "var(--fg-4)" }}>
                Parsing, chunking, embedding. This can take 30–90s per document.
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-medium" style={{ color: "var(--fg)" }}>
                Drop files here, or click to select
              </div>
              <div className="text-xs mt-1" style={{ color: "var(--fg-4)" }}>
                PDF, DOCX, or TXT. Each upload is parsed, chunked, and embedded for retrieval.
              </div>
            </>
          )}
          {err && (
            <div className="text-xs mt-3" style={{ color: "var(--err)" }}>
              {err}
            </div>
          )}
        </div>
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
                    <div className="font-medium" style={{ color: "var(--fg)" }}>
                      {d.filename}
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
                    {new Date(d.created_at).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => remove(d.id)} className="btn btn-danger">
                      Delete
                    </button>
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
