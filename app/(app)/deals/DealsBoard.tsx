"use client";

import Link from "next/link";
import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import { Meter } from "@/components/ui";
import Select from "@/components/Select";

type Deal = {
  id: string;
  name: string;
  client_name: string | null;
  status: string;
  value: number | string | null;
  due_date: string | null;
  is_sample?: boolean;
};

type Tone = "neutral" | "accent" | "warn" | "ok" | "err";

const COLUMNS: { key: string; label: string; aliases: string[]; tone: Tone }[] = [
  { key: "new",         label: "New",         aliases: ["new"],         tone: "neutral" },
  { key: "in_progress", label: "In progress", aliases: ["in_progress"], tone: "accent" },
  { key: "submitted",   label: "Submitted",   aliases: ["submitted"],   tone: "warn" },
  { key: "won",         label: "Won",         aliases: ["won"],         tone: "ok" },
  { key: "lost",        label: "Lost",        aliases: ["lost"],        tone: "err" },
];

// Stage dot classes — the same dot+label vocabulary as .stage/.st elsewhere
// in the app, so the board reads as part of one system, not its own thing.
const DOT_CLASS: Record<Tone, string> = {
  neutral: "",
  accent: "accent",
  warn: "warn",
  ok: "ok",
  err: "err",
};

function resolveColumn(status: string): string {
  return COLUMNS.find((c) => c.aliases.includes(status))?.key ?? "new";
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
}

async function patchStatus(dealId: string, status: string) {
  await fetch(`/api/deals/${dealId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

// ───────────────────────── Filter bar (MS-Lists style) ─────────────────────

type FilterState = {
  search: string;
  status: string;           // column key or "all"
  client: string;           // client name or "all"
  due: "all" | "overdue" | "week" | "month" | "later";
};

function dueBucket(iso: string | null): FilterState["due"] | null {
  if (!iso) return null;
  const days = (new Date(iso).getTime() - Date.now()) / 86_400_000;
  if (days < 0) return "overdue";
  if (days <= 7) return "week";
  if (days <= 30) return "month";
  return "later";
}

function DealsFilterBar({
  filters,
  setFilters,
  clients,
  total,
  shown,
}: {
  filters: FilterState;
  setFilters: (f: FilterState) => void;
  clients: string[];
  total: number;
  shown: number;
}) {
  const active =
    filters.search !== "" ||
    filters.status !== "all" ||
    filters.client !== "all" ||
    filters.due !== "all";

  return (
    <div className="toolbar">
      <div className="search-pill">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          placeholder="Search deals…"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
      </div>

      <FilterChip
        label="Status"
        value={filters.status}
        options={[{ value: "all", label: "All statuses" }, ...COLUMNS.map((c) => ({ value: c.key, label: c.label }))]}
        onChange={(v) => setFilters({ ...filters, status: v })}
      />

      <FilterChip
        label="Client"
        value={filters.client}
        options={[{ value: "all", label: "All clients" }, ...clients.map((c) => ({ value: c, label: c }))]}
        onChange={(v) => setFilters({ ...filters, client: v })}
      />

      <FilterChip
        label="Due"
        value={filters.due}
        options={[
          { value: "all", label: "Any time" },
          { value: "overdue", label: "Overdue" },
          { value: "week", label: "Next 7 days" },
          { value: "month", label: "Next 30 days" },
          { value: "later", label: "Later" },
        ]}
        onChange={(v) => setFilters({ ...filters, due: v as FilterState["due"] })}
      />

      {active && (
        <button
          type="button"
          style={{
            fontSize: 11.5,
            color: "var(--accent)",
            background: "transparent",
            border: "none",
            padding: "4px 8px",
            cursor: "pointer",
            fontWeight: 500,
          }}
          onClick={() => setFilters({ search: "", status: "all", client: "all", due: "all" })}
        >
          Clear
        </button>
      )}

      <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--fg-4)", fontVariantNumeric: "tabular-nums" }}>
        {shown} / {total}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const isActive = value !== "all";
  return (
    <Select
      value={value}
      onChange={onChange}
      triggerClassName={`filter-chip${isActive ? " active" : ""}`}
      ariaLabel={label}
      options={options.map((o) => ({ value: o.value, label: `${label}: ${o.label}` }))}
    />
  );
}

// ───────────────────────── Card menu ─────────────────────────

function DealCardMenu({
  dealId,
  dealName,
  onRenamed,
  onDeleted,
}: {
  dealId: string;
  dealName: string;
  onRenamed: (newName: string) => void;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  async function rename() {
    setOpen(false);
    const next = prompt("Rename deal", dealName);
    if (!next || next.trim() === "" || next === dealName) return;
    const res = await fetch(`/api/deals/${dealId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: next.trim() }),
    });
    if (res.ok) onRenamed(next.trim());
  }

  async function duplicate() {
    setOpen(false);
    const res = await fetch(`/api/deals`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: `${dealName} (copy)`, status: "new" }),
    });
    if (res.ok) window.location.reload();
  }

  async function del() {
    setOpen(false);
    if (!confirm(`Delete "${dealName}"? This removes all its documents, questions and responses.`)) return;
    const res = await fetch(`/api/deals/${dealId}`, { method: "DELETE" });
    if (res.ok) onDeleted();
  }

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button
        type="button"
        aria-label="Deal actions"
        draggable={false}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
        style={{
          width: 22, height: 22, borderRadius: 4,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--fg-4)",
          background: open ? "var(--bg-2)" : "transparent",
          cursor: "pointer",
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="19" cy="12" r="1.7" />
        </svg>
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            minWidth: 150,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
            zIndex: 30,
            padding: 4,
            fontSize: 12.5,
          }}
        >
          <MenuItem label="Rename" onClick={rename} />
          <MenuItem label="Duplicate" onClick={duplicate} />
          <div style={{ height: 1, background: "var(--divider)", margin: "4px 0" }} />
          <MenuItem label="Delete" onClick={del} danger />
        </div>
      )}
    </div>
  );
}

function MenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "6px 10px",
        borderRadius: 4,
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

// ───────────────────────── Main board ─────────────────────────

export default function DealsBoard({
  view,
  deals: initialDeals,
  totals,
}: {
  view: "board" | "table";
  deals: Deal[];
  totals: Record<string, { total: number; approved: number }>;
}) {
  const router = useRouter();
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [filters, setFilters] = useState<FilterState>({
    search: "", status: "all", client: "all", due: "all",
  });

  // Filter pipeline
  const filtered = useMemo(() => {
    return deals.filter((d) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const hay = `${d.name} ${d.client_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.status !== "all" && resolveColumn(d.status) !== filters.status) return false;
      if (filters.client !== "all" && d.client_name !== filters.client) return false;
      if (filters.due !== "all") {
        const b = dueBucket(d.due_date);
        if (b !== filters.due) return false;
      }
      return true;
    });
  }, [deals, filters]);

  const clients = useMemo(() => {
    const s = new Set<string>();
    for (const d of deals) if (d.client_name) s.add(d.client_name);
    return Array.from(s).sort();
  }, [deals]);

  // Drag state
  const draggingId = useRef<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [overCardId, setOverCardId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const m = new Map<string, Deal[]>();
    for (const col of COLUMNS) m.set(col.key, []);
    for (const d of filtered) {
      const key = resolveColumn(d.status);
      m.get(key)!.push(d);
    }
    return m;
  }, [filtered]);

  // ---- Card mutation helpers ----
  const renameInList = useCallback((id: string, newName: string) => {
    setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, name: newName } : d)));
  }, []);
  const removeFromList = useCallback((id: string) => {
    setDeals((prev) => prev.filter((d) => d.id !== id));
    router.refresh();
  }, [router]);

  // ---- Drag handlers ----
  const onDragStart = useCallback((e: React.DragEvent, dealId: string) => {
    draggingId.current = dealId;
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => { (e.target as HTMLElement).style.opacity = "0.4"; }, 0);
  }, []);
  const onDragEnd = useCallback((e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = "1";
    draggingId.current = null;
    setOverCol(null);
    setOverCardId(null);
  }, []);
  const onDragOverCol = useCallback((e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverCol(colKey);
  }, []);
  const onDragLeaveCol = useCallback(() => {
    setOverCol(null);
    setOverCardId(null);
  }, []);
  const onDragOverCard = useCallback((e: React.DragEvent, cardId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setOverCardId(cardId);
  }, []);
  const onDrop = useCallback((e: React.DragEvent, targetColKey: string) => {
    e.preventDefault();
    const id = draggingId.current;
    if (!id) return;
    setDeals((prev) => {
      const deal = prev.find((d) => d.id === id);
      if (!deal) return prev;
      if (resolveColumn(deal.status) === targetColKey) return prev;
      return prev.map((d) => d.id === id ? { ...d, status: targetColKey } : d);
    });
    patchStatus(id, targetColKey);
    setOverCol(null);
    setOverCardId(null);
  }, []);

  // Quick-advance — move a deal to its next pipeline stage without a drag.
  // Useful when triaging a long list of deals one at a time.
  const advance = useCallback((dealId: string, fromColKey: string) => {
    const idx = COLUMNS.findIndex((c) => c.key === fromColKey);
    const next = COLUMNS[idx + 1];
    if (!next) return;
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, status: next.key } : d)));
    patchStatus(dealId, next.key);
  }, []);

  // ---- Empty state ----
  if (deals.length === 0) {
    return (
      <div className="card p-14 text-center">
        <h3 className="text-base font-semibold mb-1" style={{ color: "var(--fg)" }}>No deals yet</h3>
        <p className="text-sm mb-5" style={{ color: "var(--fg-4)" }}>
          Create your first deal to start tracking an RFP through to submission.
        </p>
        <Link href="/deals/new" className="btn btn-primary inline-flex">
          Create deal
        </Link>
      </div>
    );
  }

  // ---- Table view ----
  if (view === "table") {
    return (
      <>
        <DealsFilterBar
          filters={filters}
          setFilters={setFilters}
          clients={clients}
          total={deals.length}
          shown={filtered.length}
        />
        <div className="section-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Deal</th>
                <th>Client</th>
                <th>Status</th>
                <th>Completion</th>
                <th>Due</th>
                <th style={{ textAlign: "right" }}>Value</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const t = totals[d.id] ?? { total: 0, approved: 0 };
                const pct = t.total > 0 ? Math.round((t.approved / t.total) * 100) : 0;
                return (
                  <tr
                    key={d.id}
                    onClick={(e) => {
                      // Don't navigate when clicking inside the kebab menu
                      if ((e.target as HTMLElement).closest("[data-card-menu]")) return;
                      router.push(`/deals/${d.id}`);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <Link
                        href={`/deals/${d.id}`}
                        className="inline-flex items-center gap-2"
                        style={{ color: "var(--fg)", fontWeight: 500, textDecoration: "none" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {d.name}
                        {d.is_sample && <SampleBadge />}
                      </Link>
                    </td>
                    <td style={{ color: "var(--fg-4)", fontSize: 12.5 }}>{d.client_name ?? "—"}</td>
                    <td><StatusBadge status={d.status} /></td>
                    <td style={{ minWidth: 140 }}>
                      {t.total > 0 ? (
                        <Meter pct={pct} width={64} />
                      ) : <span style={{ color: "var(--fg-5)", fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ color: "var(--fg-4)", fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>{d.due_date ? d.due_date.slice(0, 10) : "—"}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, fontSize: 13, color: "var(--fg)", fontVariantNumeric: "tabular-nums" }}>
                      {d.value ? `$${Number(d.value).toLocaleString()}` : "—"}
                    </td>
                    <td>
                      <div data-card-menu onClick={(e) => e.stopPropagation()}>
                        <DealCardMenu
                          dealId={d.id}
                          dealName={d.name}
                          onRenamed={(n) => renameInList(d.id, n)}
                          onDeleted={() => removeFromList(d.id)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  // ---- Board view ----
  return (
    <>
      <DealsFilterBar
        filters={filters}
        setFilters={setFilters}
        clients={clients}
        total={deals.length}
        shown={filtered.length}
      />
      <div className="deal-board">
        {COLUMNS.map((col, colIdx) => {
          const items = grouped.get(col.key) ?? [];
          const isOver = overCol === col.key;
          const subtotal = items.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
          const canAdvance = colIdx < COLUMNS.length - 1;

          return (
            <div key={col.key} className="deal-col">
              <div className="deal-col-head">
                <span className={`deal-col-dot${DOT_CLASS[col.tone] ? " " + DOT_CLASS[col.tone] : ""}`} />
                <span className="deal-col-title">{col.label}</span>
                <span className="deal-col-count">{items.length}</span>
                {subtotal > 0 && <span className="deal-col-sub">{fmtCompact(subtotal)}</span>}
              </div>

              <div
                className={`deal-col-list${isOver ? " over" : ""}`}
                onDragOver={(e) => onDragOverCol(e, col.key)}
                onDragLeave={onDragLeaveCol}
                onDrop={(e) => onDrop(e, col.key)}
              >
                {items.length === 0 && (
                  <div className="deal-col-empty">{isOver ? "Drop here" : "No deals"}</div>
                )}

                {items.map((d) => {
                  const t = totals[d.id] ?? { total: 0, approved: 0 };
                  const pct = t.total > 0 ? Math.round((t.approved / t.total) * 100) : 0;
                  const daysLeft =
                    d.due_date != null
                      ? Math.ceil((new Date(d.due_date).getTime() - Date.now()) / 86_400_000)
                      : null;
                  const dueTone = daysLeft == null ? "" : daysLeft < 0 ? "err" : daysLeft <= 7 ? "warn" : "";
                  const dueLabel =
                    daysLeft == null ? null : daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `Due ${d.due_date!.slice(5, 10)}`;

                  return (
                    <div
                      key={d.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, d.id)}
                      onDragEnd={onDragEnd}
                      onDragOver={(e) => onDragOverCard(e, d.id)}
                      style={{ cursor: "grab" }}
                    >
                      <Link
                        href={`/deals/${d.id}`}
                        className="deal-card"
                        draggable={false}
                        onClick={(e) => { if (draggingId.current) e.preventDefault(); }}
                        style={overCardId === d.id && draggingId.current !== d.id ? { borderColor: "var(--accent)" } : undefined}
                      >
                        <div className="flex items-start gap-2">
                          <span className="deal-card-title">
                            <span className="inline-flex items-center gap-1.5 flex-wrap">
                              {d.name}
                              {d.is_sample && <SampleBadge />}
                            </span>
                          </span>
                          <DealCardMenu
                            dealId={d.id}
                            dealName={d.name}
                            onRenamed={(n) => renameInList(d.id, n)}
                            onDeleted={() => removeFromList(d.id)}
                          />
                        </div>
                        {d.client_name && <div className="deal-card-client">{d.client_name}</div>}

                        {t.total > 0 && (
                          <div className="deal-card-meter">
                            <span className="t"><span className="f" style={{ width: `${pct}%`, background: pct >= 100 ? "var(--ok)" : "var(--accent)" }} /></span>
                            <span className="p">{pct}%</span>
                          </div>
                        )}

                        <div className="deal-card-foot">
                          <div>
                            <div className="deal-card-val">{d.value ? fmtCompact(Number(d.value)) : "—"}</div>
                            {dueLabel && <div className={`deal-card-due${dueTone ? " " + dueTone : ""}`}>{dueLabel}</div>}
                          </div>
                          {canAdvance && (
                            <button
                              type="button"
                              aria-label={`Move to ${COLUMNS[colIdx + 1].label}`}
                              title={`Move to ${COLUMNS[colIdx + 1].label}`}
                              className="deal-card-advance"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); advance(d.id, col.key); }}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12h14" /><path d="m13 6 6 6-6 6" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function SampleBadge() {
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 600,
        padding: "1px 7px",
        borderRadius: 999,
        background: "var(--accent-tint)",
        color: "var(--accent-3)",
        lineHeight: 1.3,
        flexShrink: 0,
      }}
    >
      Sample
    </span>
  );
}
