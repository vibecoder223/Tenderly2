"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { pickDriveFile, preloadGooglePicker } from "@/lib/google-picker";

type Step = { key: string; label: string; detail: string };

const STEPS: Step[] = [
  { key: "uploading",  label: "Uploading file",        detail: "Sending to secure storage…" },
  { key: "extracting", label: "Extracting text",        detail: "Parsing document structure and pages…" },
  { key: "chunked",    label: "Chunking content",       detail: "Splitting into searchable segments…" },
  { key: "analyzing",  label: "Analysing requirements", detail: "Identifying RFP requirements with AI…" },
  { key: "structured", label: "Structuring questions",  detail: "Building compliance matrix…" },
  { key: "completed",  label: "Done",                   detail: "All questions ready." },
];

const STATUS_TO_STEP: Record<string, number> = {
  uploading: 0, uploaded: 0, extracting: 1, chunked: 2, analyzing: 3, structured: 4, completed: 5,
};

type TabId = "upload" | "cloud";
const TABS: Array<{ id: TabId; label: string; key: string }> = [
  { id: "upload", label: "Upload", key: "U" },
  { id: "cloud",  label: "Cloud",  key: "C" },
];

type Provider = { id: string; label: string; sub: string; enabled: boolean };
const CLOUD_PROVIDERS: Provider[] = [
  { id: "drive",      label: "Google Drive", sub: "Connect account", enabled: true  },
  { id: "dropbox",    label: "Dropbox",      sub: "Coming soon",     enabled: false },
  { id: "onedrive",   label: "OneDrive",     sub: "Coming soon",     enabled: false },
  { id: "box",        label: "Box",          sub: "Coming soon",     enabled: false },
  { id: "notion",     label: "Notion",       sub: "Coming soon",     enabled: false },
  { id: "sharepoint", label: "SharePoint",   sub: "Coming soon",     enabled: false },
];

export default function UploadCard({ dealId }: { dealId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [tab, setTab]               = useState<TabId>("upload");
  const [dragging, setDragging]     = useState(false);
  const [processing, setProcessing] = useState(false);
  const [currentFile, setCurrentFile] = useState("");
  const [stepIdx, setStepIdx]       = useState(0);
  const [err, setErr]               = useState<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);
  useEffect(() => () => stopPolling(), [stopPolling]);

  // Warm Google scripts so the Drive OAuth popup opens within the click gesture.
  useEffect(() => { preloadGooglePicker(); }, []);

  function startPolling(docId: string) {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/documents/${docId}`);
        if (!res.ok) return;
        const { document: doc } = await res.json();
        setStepIdx(STATUS_TO_STEP[doc.processing_status] ?? 0);

        if (doc.processing_status === "completed") {
          stopPolling();
          setTimeout(() => {
            router.push(`/deals/${dealId}/questions?doc=${docId}`);
            router.refresh();
          }, 600);
        } else if (doc.processing_status === "failed") {
          stopPolling();
          setErr(doc.error_message || "Processing failed. Please try again.");
          setProcessing(false);
        }
      } catch { /* transient */ }
    }, 1500);
  }

  // Kick off the processing pipeline + poll, given an uploaded doc id.
  function startProcessing(docId: string) {
    setStepIdx(1);
    startPolling(docId);
    fetch("/api/documents/process", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ document_id: docId }),
    }).then(async (res) => {
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Processing failed" }));
        stopPolling(); setErr(error || "Processing failed"); setProcessing(false);
      }
    }).catch((e) => {
      stopPolling(); setErr(e.message || "Processing failed"); setProcessing(false);
    });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    setErr(null);
    setProcessing(true);
    setCurrentFile(file.name);
    setStepIdx(0);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("deal_id", dealId);
    const res = await fetch("/api/documents/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Upload failed" }));
      setErr(error || "Upload failed"); setProcessing(false); setCurrentFile(""); return;
    }
    const { document } = await res.json();
    startProcessing(document.id);
  }

  async function handleDrivePick() {
    setErr(null);
    let picked;
    try { picked = await pickDriveFile(); }
    catch (e: any) { setErr(e.message || "Failed to open Google Drive"); return; }
    if (!picked) return;

    setProcessing(true);
    setStepIdx(0);
    setCurrentFile(picked.name);
    const res = await fetch("/api/documents/drive-import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fileId: picked.fileId,
        name: picked.name,
        mimeType: picked.mimeType,
        accessToken: picked.accessToken,
        deal_id: dealId,
      }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Import failed" }));
      setErr(error || "Import failed"); setProcessing(false); setCurrentFile(""); return;
    }
    const { document } = await res.json();
    startProcessing(document.id);
  }

  return (
    <div
      style={{
        borderRadius: 16,
        background: "var(--surface, #fff)",
        border: "1px solid var(--border)",
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
      }}
    >
      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--divider)", padding: "0 8px" }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setErr(null); }}
              disabled={processing}
              style={{
                padding: "11px 12px 9px",
                borderTop: "none", borderLeft: "none", borderRight: "none",
                background: "transparent",
                cursor: processing ? "default" : "pointer",
                fontSize: 12.5,
                fontWeight: active ? 600 : 500,
                color: active ? "var(--fg)" : "var(--fg-4)",
                borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                marginBottom: -1,
                letterSpacing: "-0.005em",
                opacity: processing ? 0.5 : 1,
                transition: "color 120ms ease, border-color 120ms ease",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              {t.label}
              <span className="kbd">{t.key}</span>
            </button>
          );
        })}
      </div>

      {/* Tab body */}
      <div style={{ padding: 20 }}>
        {processing ? (
          <ProgressTracker currentFile={currentFile} stepIdx={stepIdx} err={err} />
        ) : tab === "upload" ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            style={{
              borderStyle: "dashed", borderWidth: 1,
              borderColor: dragging ? "var(--accent)" : "var(--border-strong)",
              background: dragging ? "var(--accent-tint)" : "var(--bg-2)",
              borderRadius: 6, padding: "28px 20px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 9,
              transition: "all 120ms ease", cursor: "pointer",
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <DocIcon size={26} color="var(--accent)" />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Geist', sans-serif", fontSize: 14, fontWeight: 600, color: "var(--fg)", letterSpacing: "-0.015em", marginBottom: 2 }}>
                Drop the RFP file
              </div>
              <div style={{ fontSize: 12, color: "var(--fg-4)" }}>
                or <span style={{ color: "var(--accent)", textDecoration: "underline" }}>browse</span>
              </div>
            </div>
            <div style={{ fontSize: 10.5, color: "var(--fg-5)", fontFamily: "'Geist Mono', ui-monospace, monospace", marginTop: 2, letterSpacing: "0.04em" }}>
              pdf · docx · txt · ai answers every requirement
            </div>
            {err && (
              <div className="text-[12px] px-3 py-2 rounded mt-2" style={{ color: "var(--err)", background: "var(--err-tint, #fff0f0)" }}>
                {err}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="cloud-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              {CLOUD_PROVIDERS.map((p) => (
                <ProviderTile
                  key={p.id}
                  provider={p}
                  onClick={p.id === "drive" ? handleDrivePick : undefined}
                />
              ))}
            </div>
            <style>{`
              @media (max-width: 640px) { .cloud-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }
              @media (max-width: 420px) { .cloud-grid { grid-template-columns: 1fr !important; } }
            `}</style>
            {err && (
              <div className="text-[12px] px-3 py-2 rounded mt-3" style={{ color: "var(--err)", background: "var(--err-tint, #fff0f0)" }}>
                {err}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Provider tile ────────────────────────────────────────────────────────── */

function ProviderTile({ provider, onClick }: { provider: Provider; onClick?: () => void }) {
  const disabled = !provider.enabled || !onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 10,
        border: "1px solid var(--border)", background: "var(--surface, #fff)",
        cursor: disabled ? "not-allowed" : "pointer", textAlign: "left",
        transition: "all 120ms ease", opacity: disabled ? 0.55 : 1, width: "100%", minWidth: 0,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = "var(--bg-2)";
        e.currentTarget.style.borderColor = "var(--border-strong)";
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = "var(--surface, #fff)";
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      <ProviderMark kind={provider.id} size={28} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {provider.label}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--fg-4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {provider.sub}
        </div>
      </div>
    </button>
  );
}

function ProviderMark({ kind, size = 28 }: { kind: string; size?: number }) {
  if (kind === "drive") return <DriveLogo size={Math.round(size * 0.74)} />;
  const base: React.CSSProperties = {
    width: size, height: size, borderRadius: 6,
    display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    fontSize: size * 0.5, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em",
  };
  switch (kind) {
    case "dropbox":    return <div style={{ ...base, background: "#0061ff" }}>D</div>;
    case "onedrive":   return <div style={{ ...base, background: "#0364b8" }}>O</div>;
    case "box":        return <div style={{ ...base, background: "#0061d5" }}>B</div>;
    case "notion":     return <div style={{ ...base, background: "#000" }}>N</div>;
    case "sharepoint": return <div style={{ ...base, background: "#038387" }}>S</div>;
    default: return null;
  }
}

/* ── Progress tracker ─────────────────────────────────────────────────────── */

function ProgressTracker({ currentFile, stepIdx, err }: { currentFile: string; stepIdx: number; err: string | null }) {
  return (
    <div className="space-y-5">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
      `}</style>
      <div>
        <div className="text-[13px] font-semibold mb-0.5" style={{ color: "var(--fg)" }}>
          {currentFile ? `${currentFile} — ` : ""}
          {stepIdx >= STEPS.length - 1 ? "Done" : `Step ${Math.min(stepIdx + 1, STEPS.length)} of ${STEPS.length}`}
        </div>
        <div className="text-[11.5px]" style={{ color: "var(--fg-4)" }}>
          {STEPS[Math.min(stepIdx, STEPS.length - 1)].detail}
        </div>
      </div>
      <div className="rounded-full overflow-hidden" style={{ height: 4, background: "var(--bg-2)" }}>
        <div
          style={{
            width: `${Math.round((stepIdx / (STEPS.length - 1)) * 100)}%`,
            height: "100%", background: "var(--accent)", borderRadius: 999, transition: "width 0.4s ease",
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
                  background: state === "done" ? "var(--ok)" : state === "active" ? "var(--accent)" : "var(--bg-2)",
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
  );
}

/* ── Icons ────────────────────────────────────────────────────────────────── */

function DocIcon({ size = 40, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <path d="M14 2v6h6"/>
      <path d="M8 13h8"/>
      <path d="M8 17h6"/>
    </svg>
  );
}

function DriveLogo({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 0.89)} viewBox="0 0 87.3 78" aria-hidden style={{ flexShrink: 0 }}>
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
      <path d="M43.65 25 29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3L1.2 48.55c-.787 1.36-1.202 2.903-1.2 4.473h27.5z" fill="#00ac47"/>
      <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z" fill="#ea4335"/>
      <path d="M43.65 25 57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
      <path d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
      <path d="M73.4 26.5 60.75 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
    </svg>
  );
}
