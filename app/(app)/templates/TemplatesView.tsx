"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";

type T = {
  id: string;
  name: string;
  description: string | null;
  intro: string | null;
  footer: string | null;
  accent_color: string;
  font_family: string;
  is_default: boolean;
  kind?: "text" | "docx" | null;
  file_name?: string | null;
  logo_path?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type TemplateKind = "ai" | "text" | "docx";

function classifyTemplate(t: T): TemplateKind {
  if (t.kind === "docx") return "docx";
  if (introToSections(t.intro)) return "ai";
  return "text";
}

function formatUpdated(iso: string | null | undefined): string {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

const SECTIONS_PREFIX = "__SECTIONS__:";

type SectionType = "ai" | "static" | "qa";
type TemplateSection = {
  id: string;
  name: string;
  type: SectionType;
  instruction?: string;
  content?: string;
};

// ---- Presets ----

const PRESET_STANDARD: TemplateSection[] = [
  {
    id: "1", name: "Executive Summary", type: "ai",
    instruction: "Write a persuasive 2-paragraph executive summary for this RFP response. Open with [Company Name]'s understanding of [Client Name]'s needs, then outline the proposed approach and key differentiators. Reference [RFP Title] and emphasise measurable outcomes.",
  },
  {
    id: "2", name: "Client Understanding", type: "ai",
    instruction: "Describe [Client Name]'s business context, sector ([Sector]), and the pain points evident from the RFP. Articulate their goals and success criteria in outcome-focused language. Show that [Company Name] has deeply understood the brief.",
  },
  {
    id: "3", name: "Proposed Solution", type: "ai",
    instruction: "Describe [Company Name]'s proposed solution for [RFP Title]. Explain how it maps to [Client Name]'s requirements. Highlight the core components, the delivery methodology, and why this approach is the best fit for [Sector] in [Region].",
  },
  { id: "4", name: "Questions and Answers", type: "qa" },
  {
    id: "5", name: "Declaration", type: "static",
    content: "We, [Company Name], confirm that all information provided in this proposal is accurate, complete, and submitted in good faith in response to [RFP Title] issued by [Client Name].\n\nThis proposal is valid for 90 days from [Date].\n\nAuthorised Signatory: ___________________________\n[Company Name] | [Date]",
  },
];

const PRESET_FULL: TemplateSection[] = [
  ...PRESET_STANDARD.slice(0, 3),
  {
    id: "4b", name: "Technical Approach", type: "ai",
    instruction: "Describe [Company Name]'s technical delivery approach for [RFP Title]. Cover methodology, tools, phases, and how this de-risks delivery for [Client Name] in [Sector].",
  },
  { id: "5b", name: "Questions and Answers", type: "qa" },
  {
    id: "6b", name: "Commercials", type: "static",
    content: "Contract Value: [Value]\nContract Type: [Contract Type]\nContract Duration: [Contract Duration]\nSubmission Method: [Submission Method]",
  },
  {
    id: "7b", name: "Team and Governance", type: "static",
    content: "Engagement Lead: [Owner]\nSector: [Sector]\nRegion: [Region]",
  },
  PRESET_STANDARD[4],
];

// ---- Helpers ----

function sectionsToIntro(sections: TemplateSection[]): string {
  return SECTIONS_PREFIX + JSON.stringify(sections);
}

function introToSections(intro: string | null): TemplateSection[] | null {
  if (!intro?.startsWith(SECTIONS_PREFIX)) return null;
  try {
    return JSON.parse(intro.slice(SECTIONS_PREFIX.length));
  } catch {
    return null;
  }
}

function sectionSummary(sections: TemplateSection[]): string {
  return sections.map((s) => {
    if (s.type === "qa") return "Q&A";
    if (s.type === "ai") return `✦ ${s.name}`;
    return s.name;
  }).join(" · ");
}

const TYPE_LABELS: Record<SectionType, string> = {
  ai: "AI-generated",
  static: "Static text",
  qa: "Q&A block",
};

const TYPE_COLORS: Record<SectionType, string> = {
  ai: "var(--accent)",
  static: "var(--fg-4)",
  qa: "#16a34a",
};

const AVAILABLE_SECTIONS = [
  { name: "Executive Summary", type: "ai" as SectionType, instruction: "Write a persuasive executive summary for this RFP response." },
  { name: "Client Understanding", type: "ai" as SectionType, instruction: "Describe the client's business context, pain points and goals." },
  { name: "Proposed Solution", type: "ai" as SectionType, instruction: "Describe the proposed solution and how it maps to client requirements." },
  { name: "Technical Approach", type: "ai" as SectionType, instruction: "Describe the technical delivery approach and methodology." },
  { name: "Implementation Timeline", type: "static" as SectionType, content: "Phase 1: Discovery (Weeks 1–2)\nPhase 2: Design & Build (Weeks 3–6)\nPhase 3: Deployment (Weeks 7–9)\nPhase 4: Support (Ongoing)" },
  { name: "Team and Governance", type: "static" as SectionType, content: "Engagement Lead: [Owner]\nClient Contact: [Client Name] representative" },
  { name: "Experience & Case Studies", type: "ai" as SectionType, instruction: "Summarise the most relevant prior experience for this engagement in [Sector]." },
  { name: "Commercials", type: "static" as SectionType, content: "Contract Value: [Value]\nContract Type: [Contract Type]\nDuration: [Contract Duration]" },
  { name: "Risks & Mitigation", type: "static" as SectionType, content: "Risk: Scope creep — Mitigation: Formal change control\nRisk: Timeline slippage — Mitigation: Weekly milestone tracking" },
  { name: "Questions and Answers", type: "qa" as SectionType },
  { name: "Declaration", type: "static" as SectionType, content: "We, [Company Name], confirm all information is accurate.\n\nAuthorised Signatory: ___________________________\n[Company Name] | [Date]" },
];

// ---- Main component ----

const FONTS = [
  { value: "default", label: "Default (sans)" },
  { value: "serif", label: "Serif (Times)" },
  { value: "mono", label: "Monospace" },
];

export default function TemplatesView({ initial }: { initial: T[] }) {
  const router = useRouter();
  const [templates, setTemplates] = useState<T[]>(initial);
  const [mode, setMode] = useState<"list" | "sections" | "text" | "docx">("list");
  const [editing, setEditing] = useState<T | null>(null);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<"all" | "ai" | "text" | "docx">("all");

  function openNew(type: "sections" | "text" | "docx") {
    setCreating(true);
    setMode(type);
    setEditing({
      id: "",
      name: "",
      description: "",
      intro: type === "sections" ? sectionsToIntro(PRESET_STANDARD) : "",
      footer: "",
      accent_color: "#3B47D6",
      font_family: "default",
      is_default: templates.length === 0,
    });
  }

  async function save(t: T) {
    const method = creating ? "POST" : "PATCH";
    const url = creating ? "/api/templates" : `/api/templates/${t.id}`;
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(t),
    });
    if (!res.ok) return;
    const { template } = await res.json();
    if (creating) setTemplates([template, ...templates]);
    else setTemplates(templates.map((x) => (x.id === template.id ? template : x)));
    setEditing(null);
    setCreating(false);
    setMode("list");
    router.refresh();
  }

  async function del(id: string) {
    if (!confirm("Delete this template?")) return;
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
    setTemplates(templates.filter((t) => t.id !== id));
  }

  async function setDefault(id: string) {
    const res = await fetch(`/api/templates/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ is_default: true }),
    });
    if (res.ok) setTemplates(templates.map((t) => ({ ...t, is_default: t.id === id })));
  }

  function cancel() { setEditing(null); setCreating(false); setMode("list"); }

  if (editing && mode === "sections") {
    return <SectionBuilderForm t={editing} isNew={creating} onCancel={cancel} onSave={save} />;
  }
  if (editing && mode === "text") {
    return <TextTemplateForm t={editing} isNew={creating} onCancel={cancel} onSave={save} />;
  }
  if (mode === "docx") {
    return (
      <UploadDocxForm
        onCancel={cancel}
        onSaved={(t) => {
          setTemplates([t, ...templates]);
          setMode("list");
          setCreating(false);
          router.refresh();
        }}
      />
    );
  }

  // ---- Template list ----
  const counts = useMemo(() => {
    const c = { all: templates.length, ai: 0, text: 0, docx: 0 };
    for (const t of templates) c[classifyTemplate(t)]++;
    return c;
  }, [templates]);

  const visible = useMemo(() => {
    if (tab === "all") return templates;
    return templates.filter((t) => classifyTemplate(t) === tab);
  }, [templates, tab]);

  function openEditor(t: T) {
    const sections = introToSections(t.intro);
    setEditing(t);
    setCreating(false);
    setMode(sections ? "sections" : "text");
  }

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold" style={{ color: "var(--fg)" }}>Proposal templates</h1>
          <p className="text-[13px]" style={{ color: "var(--fg-4)" }}>
            AI-native, structured, and Word templates for your deal exports.
          </p>
        </div>
        <AddTemplateMenu onSelect={openNew} />
      </div>

      {/* Tabs */}
      {templates.length > 0 && (
        <div className="flex items-center gap-1 border-b" style={{ borderColor: "var(--divider)" }}>
          {([
            { key: "all", label: "All" },
            { key: "ai", label: "AI Templates" },
            { key: "text", label: "Text Templates" },
            { key: "docx", label: "Word Templates" },
          ] as const).map((opt) => {
            const active = tab === opt.key;
            const count = counts[opt.key];
            return (
              <button
                key={opt.key}
                onClick={() => setTab(opt.key)}
                className="text-[12.5px] font-medium"
                style={{
                  padding: "8px 12px",
                  marginBottom: -1,
                  borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                  color: active ? "var(--fg)" : "var(--fg-4)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {opt.label}
                <span
                  className="text-[11px] num"
                  style={{
                    background: active ? "var(--accent-tint)" : "var(--bg-2)",
                    color: active ? "var(--accent)" : "var(--fg-4)",
                    padding: "1px 6px",
                    borderRadius: 999,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {templates.length === 0 ? (
        <EmptyState onAI={() => openNew("sections")} onWord={() => openNew("docx")} />
      ) : visible.length === 0 ? (
        <div className="card p-10 text-center text-[13px]" style={{ color: "var(--fg-4)" }}>
          No templates in this category yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {visible.map((t) => (
            <TemplateCard
              key={t.id}
              t={t}
              onEdit={() => openEditor(t)}
              onDelete={() => del(t.id)}
              onSetDefault={() => setDefault(t.id)}
              onDuplicate={async () => {
                const sections = introToSections(t.intro);
                const res = await fetch("/api/templates", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    name: `${t.name} (copy)`,
                    description: t.description,
                    intro: t.intro,
                    footer: t.footer,
                    accent_color: t.accent_color,
                    font_family: t.font_family,
                    is_default: false,
                  }),
                });
                if (res.ok) {
                  const { template } = await res.json();
                  setTemplates([template, ...templates]);
                }
                // Silence unused var
                void sections;
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Empty state ----

function EmptyState({ onAI, onWord }: { onAI: () => void; onWord: () => void }) {
  return (
    <div className="card p-10 text-center">
      <div style={{ width: 44, height: 44, margin: "0 auto 12px",
        borderRadius: 10, background: "var(--accent-tint)", color: "var(--accent)",
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 2 L14 8 L20 8 L15 12 L17 18 L12 14.5 L7 18 L9 12 L4 8 L10 8 Z" />
        </svg>
      </div>
      <h3 className="text-base font-semibold mb-1" style={{ color: "var(--fg)" }}>
        Start with an AI-native template
      </h3>
      <p className="text-[13px] mb-5" style={{ color: "var(--fg-4)", maxWidth: 480, margin: "0 auto 20px" }}>
        AI templates auto-write your executive summary, client understanding, and proposed solution
        for every deal — grounded in your knowledge base.
      </p>
      <div className="flex items-center justify-center gap-2">
        <button className="btn btn-primary" onClick={onAI}>Build AI template</button>
        <button className="btn" onClick={onWord}>Import Word template</button>
      </div>
    </div>
  );
}

// ---- Template card ----

function TemplateCard({
  t,
  onEdit,
  onDelete,
  onDuplicate,
  onSetDefault,
}: {
  t: T;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSetDefault: () => void;
}) {
  const sections = introToSections(t.intro);
  const kind = classifyTemplate(t);
  const aiCount = sections?.filter((s) => s.type === "ai").length ?? 0;
  const staticCount = sections?.filter((s) => s.type === "static").length ?? 0;
  const hasQa = sections?.some((s) => s.type === "qa") ?? false;
  const updated = formatUpdated(t.updated_at ?? t.created_at ?? null);

  const KIND_BADGE: Record<TemplateKind, { label: string; bg: string; fg: string }> = {
    ai:   { label: "AI Native",     bg: "color-mix(in srgb, var(--accent) 12%, white)", fg: "var(--accent)" },
    text: { label: "Text Template", bg: "var(--bg-2)",                                   fg: "var(--fg-3)" },
    docx: { label: "Word Template", bg: "color-mix(in srgb, #2563eb 12%, white)",        fg: "#2563eb" },
  };
  const badge = KIND_BADGE[kind];

  return (
    <div className="card p-5 flex flex-col" style={{ minHeight: 220 }}>
      {/* HEADER */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <h3 className="text-[14px] font-semibold truncate" style={{ color: "var(--fg)", maxWidth: 200 }}>
              {t.name}
            </h3>
            {t.is_default && (
              <span className="badge" style={{
                background: "color-mix(in srgb, var(--ok) 12%, white)",
                color: "var(--ok)",
                fontWeight: 600,
              }}>
                ✓ Default
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="badge" style={{
              background: badge.bg, color: badge.fg, fontWeight: 600, fontSize: 10.5,
            }}>
              {badge.label}
            </span>
            {kind === "ai" && aiCount > 0 && (
              <span className="badge" style={{ background: "var(--bg-2)", color: "var(--fg-4)", fontSize: 10.5 }}>
                Auto-fill capable
              </span>
            )}
            {hasQa && (
              <span className="badge" style={{ background: "var(--bg-2)", color: "var(--fg-4)", fontSize: 10.5 }}>
                Compliance-aware
              </span>
            )}
            {kind === "docx" && (
              <span className="badge" style={{ background: "var(--bg-2)", color: "var(--fg-4)", fontSize: 10.5 }}>
                Placeholder fill
              </span>
            )}
          </div>
        </div>

        <CardMenu
          isDefault={t.is_default}
          onEdit={kind === "docx" ? null : onEdit}
          onDuplicate={onDuplicate}
          onSetDefault={onSetDefault}
          onDelete={onDelete}
        />
      </div>

      {/* DESCRIPTION */}
      {t.description ? (
        <p className="text-[12px] line-clamp-2 mb-3" style={{ color: "var(--fg-4)" }}>
          {t.description}
        </p>
      ) : null}

      {/* BODY */}
      <div className="flex-1">
        {kind === "ai" && sections ? (
          <SectionsPreview sections={sections} aiCount={aiCount} staticCount={staticCount} hasQa={hasQa} />
        ) : kind === "docx" ? (
          <div className="rounded p-3" style={{ background: "var(--bg-2)" }}>
            <div className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.6" style={{ color: "var(--fg-4)", flexShrink: 0 }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span className="text-[12px] truncate" style={{ color: "var(--fg-3)" }}>
                {t.file_name || "uploaded.docx"}
              </span>
            </div>
            <p className="text-[11px] mt-2" style={{ color: "var(--fg-4)" }}>
              AI replaces placeholder tokens at export time. Structure & branding preserved.
            </p>
          </div>
        ) : (
          <p className="text-[12px] line-clamp-3" style={{ color: "var(--fg-4)" }}>
            {t.intro ? t.intro.slice(0, 200) : "(no intro text)"}
          </p>
        )}
      </div>

      {/* FOOTER */}
      <div className="flex items-center justify-between gap-2 mt-4 pt-3"
        style={{ borderTop: "1px solid var(--divider)" }}>
        <div className="text-[11px]" style={{ color: "var(--fg-5)" }}>
          Updated {updated}
        </div>
        <div className="flex items-center gap-2">
          {kind !== "docx" && (
            <button className="btn text-[12px]" onClick={onEdit} style={{ padding: "4px 12px" }}>
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Sections preview (grouped) ----

function SectionsPreview({
  sections,
  aiCount,
  staticCount,
  hasQa,
}: {
  sections: TemplateSection[];
  aiCount: number;
  staticCount: number;
  hasQa: boolean;
}) {
  const aiNames = sections.filter((s) => s.type === "ai").map((s) => s.name);
  const staticNames = sections.filter((s) => s.type === "static").map((s) => s.name);

  return (
    <div className="space-y-2">
      {aiCount > 0 && (
        <SectionGroup
          label={`AI Sections (${aiCount})`}
          color="var(--accent)"
          names={aiNames}
        />
      )}
      {staticCount > 0 && (
        <SectionGroup
          label={`Static (${staticCount})`}
          color="var(--fg-3)"
          names={staticNames}
        />
      )}
      {hasQa && (
        <SectionGroup
          label="Q&A Block"
          color="#16a34a"
          names={["Compliance matrix"]}
        />
      )}
    </div>
  );
}

function SectionGroup({ label, color, names }: { label: string; color: string; names: string[] }) {
  return (
    <div className="text-[11.5px]">
      <div style={{ color, fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ color: "var(--fg-4)", paddingLeft: 8 }} className="line-clamp-2">
        {names.join(" · ")}
      </div>
    </div>
  );
}

// ---- Card kebab menu ----

function CardMenu({
  isDefault,
  onEdit,
  onDuplicate,
  onSetDefault,
  onDelete,
}: {
  isDefault: boolean;
  onEdit: (() => void) | null;
  onDuplicate: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        aria-label="Template actions"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 28, height: 28, borderRadius: 6,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--fg-4)",
          background: open ? "var(--bg-2)" : "transparent",
          cursor: "pointer",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", right: 0,
          minWidth: 170, background: "var(--surface)",
          border: "1px solid var(--border)", borderRadius: 8,
          boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
          zIndex: 30, padding: 4, fontSize: 12.5,
        }}>
          {onEdit && <MenuRow label="Edit" onClick={() => { setOpen(false); onEdit(); }} />}
          <MenuRow label="Duplicate" onClick={() => { setOpen(false); onDuplicate(); }} />
          {!isDefault && <MenuRow label="Set as default" onClick={() => { setOpen(false); onSetDefault(); }} />}
          <div style={{ height: 1, background: "var(--divider)", margin: "4px 0" }} />
          <MenuRow label="Delete" danger onClick={() => { setOpen(false); onDelete(); }} />
        </div>
      )}
    </div>
  );
}

function MenuRow({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "block", width: "100%", textAlign: "left",
        padding: "6px 10px", borderRadius: 4,
        background: "transparent",
        color: danger ? "var(--err)" : "var(--fg)",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-2)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {label}
    </button>
  );
}

// ---- Add template dropdown ----

function AddTemplateMenu({ onSelect }: { onSelect: (type: "sections" | "text" | "docx") => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className="btn btn-primary"
        onClick={() => setOpen((o) => !o)}
        style={{ paddingRight: 10, gap: 6 }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        New template
        <svg
          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          style={{
            opacity: 0.85,
            marginLeft: 2,
            transition: "transform var(--dur-fast) var(--ease)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          className="elevated"
          style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50,
            width: 320, padding: 6,
            animation: "fadeUp var(--dur) var(--ease) both",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <AddTemplateOption
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 L14 8 L20 8 L15 12 L17 18 L12 14.5 L7 18 L9 12 L4 8 L10 8 Z" />
              </svg>
            }
            accent="var(--accent)"
            title="AI section builder"
            description="Compose sections — AI writes execs, client understanding, and proposed solution per deal."
            onClick={() => { setOpen(false); onSelect("sections"); }}
          />
          <AddTemplateOption
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16v16H4z" /><path d="M8 9h8M8 13h8M8 17h5" />
              </svg>
            }
            accent="var(--fg-3)"
            title="Text template"
            description="Plain intro & footer with [bracket tokens]. No AI sections."
            onClick={() => { setOpen(false); onSelect("text"); }}
          />
          <AddTemplateOption
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            }
            accent="oklch(0.50 0.18 250)"
            title="Import Word template"
            description="Upload an existing .docx. AI fills placeholders while preserving structure."
            onClick={() => { setOpen(false); onSelect("docx"); }}
          />
        </div>
      )}
    </div>
  );
}

function AddTemplateOption({
  icon, accent, title, description, onClick,
}: {
  icon: React.ReactNode;
  accent: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        width: "100%", textAlign: "left",
        padding: "10px 10px",
        borderRadius: 7,
        background: "transparent",
        border: "1px solid transparent",
        cursor: "pointer",
        transition: "background var(--dur-fast) var(--ease)",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--bg-2)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
    >
      <span
        style={{
          width: 26, height: 26, borderRadius: 7,
          flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "color-mix(in srgb, " + accent + " 10%, white)",
          color: accent,
          marginTop: 1,
        }}
      >
        {icon}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--fg)", lineHeight: 1.3 }}>
          {title}
        </span>
        <span style={{ display: "block", fontSize: 11.5, color: "var(--fg-4)", lineHeight: 1.45, marginTop: 2 }}>
          {description}
        </span>
      </span>
    </button>
  );
}

// ---- Section builder form ----

function SectionBuilderForm({
  t, isNew, onCancel, onSave,
}: { t: T; isNew: boolean; onCancel: () => void; onSave: (t: T) => void }) {
  const existingSections = introToSections(t.intro) ?? PRESET_STANDARD;
  const [name, setName] = useState(t.name);
  const [description, setDescription] = useState(t.description ?? "");
  const [accentColor, setAccentColor] = useState(t.accent_color);
  const [isDefault, setIsDefault] = useState(t.is_default);
  const [sections, setSections] = useState<TemplateSection[]>(existingSections);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  const [saving, setSaving] = useState(false);

  function updateSection(id: string, patch: Partial<TemplateSection>) {
    setSections((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s));
  }

  function removeSection(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id));
  }

  function addSection(template: typeof AVAILABLE_SECTIONS[0]) {
    const newSec: TemplateSection = {
      id: Date.now().toString(),
      name: template.name,
      type: template.type,
      instruction: (template as any).instruction,
      content: (template as any).content,
    };
    setSections((prev) => [...prev, newSec]);
    setExpandedId(newSec.id);
    setAddingSection(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || sections.length === 0) return;
    setSaving(true);
    await onSave({
      ...t,
      name: name.trim(),
      description: description || null,
      intro: sectionsToIntro(sections),
      footer: null,
      accent_color: accentColor,
      font_family: "default",
      is_default: isDefault,
    });
    setSaving(false);
  }

  function applyPreset(preset: TemplateSection[]) {
    setSections(preset);
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="card p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold mb-0.5" style={{ color: "var(--fg)" }}>
            {isNew ? "New section template" : `Edit: ${t.name}`}
          </h2>
          <p className="text-[12.5px]" style={{ color: "var(--fg-4)" }}>
            AI sections are auto-written at export time using your deal's context. Use <code className="mono">[Client Name]</code>, <code className="mono">[Company Name]</code>, <code className="mono">[RFP Title]</code> etc. in instructions.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Template name</label>
            <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard proposal" />
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="When to use this" />
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="label">Accent color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)}
                style={{ width: 42, height: 32, padding: 0, border: "1px solid var(--border)", borderRadius: 6 }} />
              <input className="input mono" style={{ width: 96 }} value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
            </div>
          </div>

          <LogoUpload templateId={t.id} disabled={isNew} currentLogoPath={t.logo_path ?? null} />

          <div style={{ paddingTop: 20 }}>
            <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--fg-3)" }}>
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
              Set as default
            </label>
          </div>
          <div style={{ paddingTop: 20, marginLeft: "auto", display: "flex", gap: 8 }}>
            <button type="button" className="btn text-[11.5px]" onClick={() => applyPreset(PRESET_STANDARD)}>Use standard preset</button>
            <button type="button" className="btn text-[11.5px]" onClick={() => applyPreset(PRESET_FULL)}>Use full preset</button>
          </div>
        </div>
      </div>

      {/* Sections list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[12px] font-semibold" style={{ color: "var(--fg-3)" }}>
            Sections ({sections.length})
          </h3>
          <button
            type="button"
            className="btn text-[11.5px]"
            onClick={() => setAddingSection((v) => !v)}
          >
            + Add section
          </button>
        </div>

        {addingSection && (
          <div className="card p-4" style={{ background: "var(--bg-2)" }}>
            <p className="text-[12px] font-medium mb-3" style={{ color: "var(--fg-3)" }}>Choose a section to add:</p>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_SECTIONS.filter(
                (a) => !sections.some((s) => s.name === a.name)
              ).map((a) => (
                <button
                  key={a.name}
                  type="button"
                  className="card text-left px-3 py-2"
                  style={{ cursor: "pointer" }}
                  onClick={() => addSection(a)}
                >
                  <div className="text-[12.5px] font-medium" style={{ color: "var(--fg)" }}>{a.name}</div>
                  <div className="text-[11px]" style={{ color: TYPE_COLORS[a.type] }}>{TYPE_LABELS[a.type]}</div>
                </button>
              ))}
            </div>
            <button type="button" className="btn mt-3 text-[11.5px]" onClick={() => setAddingSection(false)}>Cancel</button>
          </div>
        )}

        {sections.map((sec, i) => {
          const isExpanded = expandedId === sec.id;
          return (
            <div key={sec.id} className="card overflow-hidden">
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                style={{ background: isExpanded ? "var(--surface)" : "transparent" }}
                onClick={() => setExpandedId(isExpanded ? null : sec.id)}
              >
                <span className="text-[11px] mono" style={{ color: "var(--fg-5)", width: 16 }}>{i + 1}</span>
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{ background: TYPE_COLORS[sec.type] + "22", color: TYPE_COLORS[sec.type] }}>
                  {TYPE_LABELS[sec.type]}
                </span>
                <span className="text-[13px] font-medium" style={{ color: "var(--fg)", flex: 1 }}>{sec.name}</span>
                {sec.type !== "qa" && (
                  <span className="text-[11px]" style={{ color: "var(--fg-5)" }}>
                    {isExpanded ? "▲" : "▼"}
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeSection(sec.id); }}
                  className="text-[11.5px]"
                  style={{ color: "var(--fg-5)" }}
                >✕</button>
              </div>

              {isExpanded && sec.type !== "qa" && (
                <div className="px-4 pb-4 space-y-3" style={{ borderTop: "1px solid var(--divider)" }}>
                  <div className="pt-3">
                    <label className="label">Section name</label>
                    <input
                      className="input"
                      value={sec.name}
                      onChange={(e) => updateSection(sec.id, { name: e.target.value })}
                    />
                  </div>
                  {sec.type === "ai" && (
                    <div>
                      <label className="label">AI instruction</label>
                      <textarea
                        className="textarea"
                        rows={4}
                        value={sec.instruction ?? ""}
                        onChange={(e) => updateSection(sec.id, { instruction: e.target.value })}
                        placeholder="Tell the AI what to write. Use [Client Name], [RFP Title], [Sector] etc."
                      />
                      <p className="text-[11px] mt-1" style={{ color: "var(--fg-5)" }}>
                        At export time, Groq generates this section using your deal's context + this instruction.
                      </p>
                    </div>
                  )}
                  {sec.type === "static" && (
                    <div>
                      <label className="label">Content</label>
                      <textarea
                        className="textarea"
                        rows={5}
                        value={sec.content ?? ""}
                        onChange={(e) => updateSection(sec.id, { content: e.target.value })}
                        placeholder="Static text. Use [Client Name], [Company Name], [Date], [Value] etc."
                      />
                    </div>
                  )}
                </div>
              )}

              {isExpanded && sec.type === "qa" && (
                <div className="px-4 pb-3 pt-2 text-[12px]" style={{ color: "var(--fg-4)", borderTop: "1px solid var(--divider)" }}>
                  All approved Q&amp;A responses from the deal are injected here automatically.
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <button type="submit" className="btn btn-primary" disabled={saving || !name.trim() || sections.length === 0}>
          {saving ? "Saving…" : isNew ? "Create template" : "Save changes"}
        </button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

// ---- Text template form (existing) ----

const SAMPLE_INTRO = `Dear [Client Name],

Thank you for the opportunity to respond to [RFP Title]. [Company Name] has reviewed the requirements in detail and is excited to present this proposal.

The following pages address each requirement in turn, with sources cited where applicable.`;

const SAMPLE_FOOTER = `We welcome the chance to discuss this response further.

Sincerely,
[Owner]
[Company Name]`;

function TextTemplateForm({
  t, isNew, onCancel, onSave,
}: { t: T; isNew: boolean; onCancel: () => void; onSave: (t: T) => void }) {
  const [form, setForm] = useState({
    ...t,
    intro: t.intro && !t.intro.startsWith(SECTIONS_PREFIX) ? t.intro : SAMPLE_INTRO,
    footer: t.footer ?? SAMPLE_FOOTER,
  });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <form onSubmit={submit} className="card p-7 space-y-6">
      <div>
        <h2 className="text-base font-semibold" style={{ color: "var(--fg)" }}>
          {isNew ? "New text template" : `Edit: ${t.name}`}
        </h2>
        <p className="text-[12px] mt-0.5" style={{ color: "var(--fg-4)" }}>
          Use <code className="mono">[Client Name]</code>, <code className="mono">[Company Name]</code>, <code className="mono">[RFP Title]</code>, <code className="mono">[Date]</code>, <code className="mono">[Owner]</code> etc.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Template name</label>
          <input className="input" value={form.name} required onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Government RFP — formal" />
        </div>
        <div>
          <label className="label">Description (optional)</label>
          <input className="input" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="When to use" />
        </div>
      </div>

      <div>
        <label className="label">Cover / Intro</label>
        <textarea className="textarea" rows={8} value={form.intro ?? ""} onChange={(e) => setForm({ ...form, intro: e.target.value })} />
        <p className="text-[11px] mt-1" style={{ color: "var(--fg-5)" }}>
          Appears before the Q&amp;A block. Also supports <code className="mono">[AI: write an executive summary...]</code> for AI-generated paragraphs.
        </p>
      </div>

      <div>
        <label className="label">Footer / Closing</label>
        <textarea className="textarea" rows={5} value={form.footer ?? ""} onChange={(e) => setForm({ ...form, footer: e.target.value })} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="label">Accent color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={form.accent_color} onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
              style={{ width: 42, height: 32, padding: 0, border: "1px solid var(--border)", borderRadius: 6 }} />
            <input className="input mono" style={{ flex: 1 }} value={form.accent_color} onChange={(e) => setForm({ ...form, accent_color: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Font</label>
          <select className="select" value={form.font_family} onChange={(e) => setForm({ ...form, font_family: e.target.value })}>
            {FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Default</label>
          <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--fg-3)" }}>
            <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
            Use by default
          </label>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : isNew ? "Create template" : "Save changes"}
        </button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

// ---- Upload .docx form ----

function UploadDocxForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: (t: T) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accent, setAccent] = useState("#3B47D6");
  const [isDefault, setIsDefault] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !name.trim()) return;
    setErr(null);
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", name.trim());
    fd.append("description", description);
    fd.append("accent_color", accent);
    fd.append("is_default", String(isDefault));
    const res = await fetch("/api/templates/upload", { method: "POST", body: fd });
    setBusy(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Upload failed" }));
      setErr(error || "Upload failed");
      return;
    }
    const { template } = await res.json();
    onSaved(template);
  }

  return (
    <form onSubmit={submit} className="card p-7 space-y-6">
      <div>
        <h2 className="text-base font-semibold" style={{ color: "var(--fg)" }}>Upload .docx template</h2>
        <p className="text-[12.5px] mt-1" style={{ color: "var(--fg-4)" }}>
          Your Word file becomes the <strong>golden template</strong>. TenderOps fills placeholders only — never rewrites sections.
        </p>
      </div>

      <div className="card p-4" style={{ background: "var(--bg-2)", border: "1px dashed var(--border-strong)" }}>
        <h3 className="text-[12.5px] font-semibold mb-2" style={{ color: "var(--fg-3)" }}>Supported placeholders</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11.5px]" style={{ color: "var(--fg-4)" }}>
          <div><code className="mono">[Client Name]</code> → deal client</div>
          <div><code className="mono">[Company Name]</code> → your org</div>
          <div><code className="mono">[RFP Title]</code> → deal name</div>
          <div><code className="mono">[Date]</code> → today</div>
          <div><code className="mono">[Due Date]</code> → deadline</div>
          <div><code className="mono">[Owner]</code> → deal owner</div>
          <div><code className="mono">[Value]</code> → contract value</div>
          <div><code className="mono">[Sector]</code> / <code className="mono">[Region]</code></div>
        </div>
        <p className="text-[11px] mt-2" style={{ color: "var(--fg-5)" }}>
          AI sections: <code className="mono">[AI: Write an executive summary for this RFP response]</code>
          <br />
          Q&A injection: add a heading "Questions and Answers" — all responses are inserted below it.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Template name</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Government RFP master" />
        </div>
        <div>
          <label className="label">Description (optional)</label>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="When to use" />
        </div>
      </div>

      <div>
        <label className="label">Word document (.docx)</label>
        <input type="file" accept=".docx" required onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-[13px]" style={{ color: "var(--fg-3)" }} />
        {file && (
          <p className="text-[11.5px] mt-1" style={{ color: "var(--fg-4)" }}>
            {file.name} — {Math.round(file.size / 1024)} KB
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Accent color (previews)</label>
          <div className="flex items-center gap-2">
            <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)}
              style={{ width: 42, height: 32, padding: 0, border: "1px solid var(--border)", borderRadius: 6 }} />
            <input className="input mono" style={{ flex: 1 }} value={accent} onChange={(e) => setAccent(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Set as default</label>
          <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--fg-3)" }}>
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            Use by default
          </label>
        </div>
      </div>

      {err && <div className="text-xs" style={{ color: "var(--err)" }}>{err}</div>}

      <div className="flex items-center gap-2 pt-2">
        <button type="submit" className="btn btn-primary" disabled={busy || !file}>
          {busy ? "Uploading…" : "Upload template"}
        </button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

// ---- Logo upload ----

function LogoUpload({
  templateId,
  disabled,
  currentLogoPath,
}: {
  templateId: string;
  disabled: boolean;
  currentLogoPath: string | null;
}) {
  const [path, setPath] = useState<string | null>(currentLogoPath);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setErr("PNG or JPG only.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setErr("Max 4 MB.");
      return;
    }
    setBusy(true);
    setPreviewUrl(URL.createObjectURL(file));
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/templates/${templateId}/logo`, { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Upload failed");
      setPath(j.logo_path);
    } catch (e: any) {
      setErr(e.message);
      setPreviewUrl(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/templates/${templateId}/logo`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Delete failed");
      setPath(null);
      setPreviewUrl(null);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (disabled) {
    return (
      <div>
        <label className="label">Logo</label>
        <div className="text-[11.5px]" style={{ color: "var(--fg-5)", paddingTop: 6 }}>
          Save the template first, then upload a logo.
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="label">Logo</label>
      <div className="flex items-center gap-2">
        <div
          style={{
            width: 56, height: 32, borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--bg-2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden",
            fontSize: 10, color: "var(--fg-5)",
          }}
        >
          {previewUrl || path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl ?? `/api/templates/${templateId}/logo/raw?t=${encodeURIComponent(path ?? "")}`}
              alt="logo"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : (
            "—"
          )}
        </div>
        <label className="btn text-[11.5px]" style={{ cursor: busy ? "wait" : "pointer" }}>
          {busy ? "…" : path ? "Replace" : "Upload"}
          <input type="file" accept="image/png,image/jpeg" hidden onChange={handlePick} disabled={busy} />
        </label>
        {path && (
          <button type="button" className="btn text-[11.5px]" onClick={handleRemove} disabled={busy}>
            Remove
          </button>
        )}
      </div>
      {err && <div className="text-[11px] mt-1" style={{ color: "var(--err)" }}>{err}</div>}
    </div>
  );
}
