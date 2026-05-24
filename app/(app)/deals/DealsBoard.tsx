"use client";

import Link from "next/link";
import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";

type Deal = {
  id: string;
  name: string;
  client_name: string | null;
  status: string;
  value: number | string | null;
  due_date: string | null;
  is_sample?: boolean;
};

const COLUMNS: { key: string; label: string; aliases: string[] }[] = [
  { key: "new",         label: "New",         aliases: ["new"] },
  { key: "in_progress", label: "In progress", aliases: ["in_progress"] },
  { key: "submitted",   label: "Submitted",   aliases: ["submitted"] },
  { key: "won",         label: "Won",         aliases: ["won"] },
  { key: "lost",        label: "Lost",        aliases: ["lost"] },
];

function resolveColumn(status: string): string {
  return COLUMNS.find((c) => c.aliases.includes(status))?.key ?? "new";
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
    <div className="card flex items-center gap-2 px-3 py-2 mb-3 flex-wrap" style={{ background: "var(--bg-1)" }}>
      <div className="flex items-center gap-1.5" style={{ flex: 1, minWidth: 220 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" style={{ color: "var(--fg-4)", flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          className="input"
          placeholder="Search deals…"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          style={{ border: "none", background: "transparent", padding: "4px 0", flex: 1, fontSize: 13 }}
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
          className="text-[11.5px]"
          style={{ color: "var(--accent)", padding: "4px 8px" }}
          onClick={() => setFilters({ search: "", status: "all", client: "all", due: "all" })}
        >
          Clear filters
        </button>
      )}

      <div className="text-[11.5px] ml-auto" style={{ color: "var(--fg-4)" }}>
        {shown} of {total}
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
  const current = options.find((o) => o.value === value);
  return (
    <div style={{ position: "relative" }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          appearance: "none",
          background: isActive ? "var(--accent-tint)" : "var(--bg-2)",
          color: isActive ? "var(--accent)" : "var(--fg-3)",
          border: isActive ? "1px solid var(--accent-line)" : "1px solid var(--border)",
          borderRadius: 999,
          padding: "4px 26px 4px 10px",
          fontSize: 12,
          cursor: "pointer",
          fontWeight: isActive ? 600 : 500,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {label}: {o.label}
          </option>
        ))}
      </select>
      <svg
        width="10" height="10" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5"
        style={{
          position: "absolute", right: 8, top: "50%",
          transform: "translateY(-50%)", pointerEvents: "none",
          color: isActive ? "var(--accent)" : "var(--fg-4)",
        }}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
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
        <div className="card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ color: "var(--fg-4)" }}>
                <th className="text-left font-medium px-5 py-2.5">Deal</th>
                <th className="text-left font-medium px-5 py-2.5">Client</th>
                <th className="text-left font-medium px-5 py-2.5">Status</th>
                <th className="text-left font-medium px-5 py-2.5">Completion</th>
                <th className="text-left font-medium px-5 py-2.5">Due</th>
                <th className="text-right font-medium px-5 py-2.5">Value</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const t = totals[d.id] ?? { total: 0, approved: 0 };
                const pct = t.total > 0 ? Math.round((t.approved / t.total) * 100) : 0;
                return (
                  <tr key={d.id} className="border-t" style={{ borderColor: "var(--divider)" }}>
                    <td className="px-5 py-3">
                      <Link href={`/deals/${d.id}`} className="font-medium inline-flex items-center gap-2" style={{ color: "var(--fg)" }}>
                        {d.name}
                        {d.is_sample && <SampleBadge />}
                      </Link>
                    </td>
                    <td className="px-5 py-3" style={{ color: "var(--fg-3)" }}>{d.client_name ?? "—"}</td>
                    <td className="px-5 py-3"><StatusBadge status={d.status} /></td>
                    <td className="px-5 py-3" style={{ minWidth: 160 }}>
                      {t.total > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="rounded-full" style={{ width: 80, height: 5, background: "var(--bg-2)" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: pct >= 100 ? "var(--ok)" : "var(--accent)", borderRadius: 999 }} />
                          </div>
                          <span className="num text-[12px]" style={{ color: "var(--fg-3)" }}>{pct}%</span>
                        </div>
                      ) : <span style={{ color: "var(--fg-5)" }}>—</span>}
                    </td>
                    <td className="px-5 py-3" style={{ color: "var(--fg-3)" }}>{d.due_date ? d.due_date.slice(0, 10) : "—"}</td>
                    <td className="px-5 py-3 text-right num" style={{ color: "var(--fg-2)" }}>
                      {d.value ? `$${Number(d.value).toLocaleString()}` : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <DealCardMenu
                        dealId={d.id}
                        dealName={d.name}
                        onRenamed={(n) => renameInList(d.id, n)}
                        onDeleted={() => removeFromList(d.id)}
                      />
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
      <div
        className="flex gap-3"
        style={{ overflowX: "auto", paddingBottom: 12, alignItems: "flex-start" }}
      >
        {COLUMNS.map((col) => {
          const items = grouped.get(col.key) ?? [];
          const isOver = overCol === col.key;

          return (
            <div
              key={col.key}
              style={{ minWidth: 240, width: 240, flexShrink: 0 }}
              onDragOver={(e) => onDragOverCol(e, col.key)}
              onDragLeave={onDragLeaveCol}
              onDrop={(e) => onDrop(e, col.key)}
            >
              <div className="flex items-center justify-between px-1 mb-2">
                <span
                  className="text-[11.5px] uppercase tracking-wider font-semibold"
                  style={{ color: "var(--fg-4)" }}
                >
                  {col.label}
                </span>
                <span className="num text-[11.5px]" style={{ color: "var(--fg-5)" }}>
                  {items.length}
                </span>
              </div>

              <div
                className="space-y-2 rounded-lg p-1.5 transition-colors"
                style={{
                  minHeight: 80,
                  background: isOver ? "var(--accent-tint)" : "transparent",
                  border: isOver ? "1.5px dashed var(--accent-line)" : "1.5px dashed transparent",
                  transition: "background 0.12s, border-color 0.12s",
                }}
              >
                {items.length === 0 && !isOver && (
                  <div
                    className="text-[12px] text-center py-6 rounded"
                    style={{ color: "var(--fg-5)", background: "var(--bg-2)" }}
                  >
                    Drop here
                  </div>
                )}

                {items.map((d) => {
                  const t = totals[d.id] ?? { total: 0, approved: 0 };
                  const pct = t.total > 0 ? Math.round((t.approved / t.total) * 100) : 0;
                  const dueSoon =
                    d.due_date != null &&
                    (new Date(d.due_date).getTime() - Date.now()) / 86_400_000 < 7;
                  const isCardOver = overCardId === d.id && draggingId.current !== d.id;

                  return (
                    <div
                      key={d.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, d.id)}
                      onDragEnd={onDragEnd}
                      onDragOver={(e) => onDragOverCard(e, d.id)}
                      style={{
                        cursor: "grab",
                        borderTop: isCardOver ? "2px solid var(--accent)" : "2px solid transparent",
                        borderRadius: 8,
                        transition: "border-color 0.1s",
                        position: "relative",
                      }}
                    >
                      <Link
                        href={`/deals/${d.id}`}
                        className="card p-3 block"
                        draggable={false}
                        onClick={(e) => {
                          if (draggingId.current) e.preventDefault();
                        }}
                        style={{ userSelect: "none" }}
                      >
                        {/* Header: title + actions menu */}
                        <div className="flex items-start gap-2 mb-1">
                          <div
                            className="text-[13px] font-medium leading-tight"
                            style={{ color: "var(--fg)", flex: 1, minWidth: 0 }}
                          >
                            <span className="inline-flex items-center gap-1.5 flex-wrap">
                              {d.name}
                              {d.is_sample && <SampleBadge />}
                            </span>
                          </div>
                          <DealCardMenu
                            dealId={d.id}
                            dealName={d.name}
                            onRenamed={(n) => renameInList(d.id, n)}
                            onDeleted={() => removeFromList(d.id)}
                          />
                        </div>
                        <div className="text-[11.5px] mb-2" style={{ color: "var(--fg-4)" }}>
                          {d.client_name ?? "No client"}
                        </div>
                        {t.total > 0 && (
                          <div className="rounded-full mb-2" style={{ height: 3, background: "var(--bg-2)" }}>
                            <div
                              style={{
                                width: `${pct}%`,
                                height: "100%",
                                background: pct >= 100 ? "var(--ok)" : "var(--accent)",
                                borderRadius: 999,
                              }}
                            />
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[11px]">
                          <span style={{ color: "var(--fg-4)" }}>
                            {d.value ? `$${Number(d.value).toLocaleString()}` : "—"}
                          </span>
                          <span style={{ color: dueSoon ? "var(--warn)" : "var(--fg-4)" }}>
                            {d.due_date ? d.due_date.slice(0, 10) : "—"}
                          </span>
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
  );
}
