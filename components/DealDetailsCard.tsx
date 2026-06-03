"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CustomFieldInputs, { type Person } from "@/components/CustomFieldInputs";
import {
  coerceValue,
  firstMissingRequired,
  formatValue,
  type DealFieldDef,
} from "@/lib/deal-fields";

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "submitted", label: "Submitted" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

type CoreDeal = {
  name: string;
  client_name: string | null;
  value: number | null;
  due_date: string | null;
  status: string;
};

export default function DealDetailsCard({
  dealId,
  deal,
  defs,
  values,
  people,
  canEdit,
}: {
  dealId: string;
  deal: CoreDeal;
  defs: DealFieldDef[];
  values: Record<string, unknown>;
  people: Person[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const active = defs.filter((d) => !d.archived);
  const [editing, setEditing] = useState(false);
  const [core, setCore] = useState<CoreDeal>(deal);
  const [draft, setDraft] = useState<Record<string, unknown>>(values ?? {});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const peopleMap = new Map(people.map((p) => [p.user_id, p.name || p.email]));

  function startEdit() {
    setCore(deal);
    setDraft(values ?? {});
    setErr(null);
    setEditing(true);
  }

  async function save() {
    setErr(null);
    if (!core.name.trim()) { setErr("Name is required"); return; }
    const missing = firstMissingRequired(active, draft);
    if (missing) { setErr(`${missing} is required`); return; }

    const custom_fields: Record<string, unknown> = {};
    for (const f of active) custom_fields[f.key] = coerceValue(f.type, draft[f.key]);

    const body = {
      name: core.name.trim(),
      client_name: core.client_name?.trim() || null,
      value: core.value === null || (core.value as unknown as string) === "" ? null : Number(core.value),
      due_date: core.due_date || null,
      status: core.status,
      custom_fields,
    };

    setSaving(true);
    const res = await fetch(`/api/deals/${dealId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) { setErr((await res.json()).error || "Failed"); return; }
    setEditing(false);
    router.refresh();
  }

  const fmtMoney = (v: number | null) =>
    v == null ? "—" : v.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const fmtDate = (v: string | null) =>
    v ? new Date(v).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
  const statusLabel = STATUS_OPTIONS.find((s) => s.value === deal.status)?.label ?? deal.status;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Details</h2>
        {canEdit && !editing && (
          <button type="button" className="text-[12px]" style={{ color: "var(--accent)" }} onClick={startEdit}>
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="label">Name</label>
              <input className="input" value={core.name} onChange={(e) => setCore({ ...core, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Client</label>
              <input className="input" value={core.client_name ?? ""} onChange={(e) => setCore({ ...core, client_name: e.target.value })} />
            </div>
            <div className="flex gap-3">
              <div style={{ flex: 1 }}>
                <label className="label">Value (USD)</label>
                <input className="input" type="number" value={core.value ?? ""} onChange={(e) => setCore({ ...core, value: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="label">Due date</label>
                <input className="input" type="date" value={core.due_date ?? ""} onChange={(e) => setCore({ ...core, due_date: e.target.value || null })} />
              </div>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={core.status} onChange={(e) => setCore({ ...core, status: e.target.value })}>
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {active.length > 0 && (
            <div className="space-y-3" style={{ borderTop: "1px solid var(--divider)", paddingTop: 14 }}>
              <CustomFieldInputs defs={active} values={draft} people={people} onChange={(k, v) => setDraft((p) => ({ ...p, [k]: v }))} />
            </div>
          )}

          {err && <div className="text-[12px]" style={{ color: "var(--err)" }}>{err}</div>}
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-primary" disabled={saving} onClick={save}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" className="btn" onClick={() => { setEditing(false); setErr(null); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <dl className="space-y-2.5">
          <Row label="Name" value={deal.name} />
          <Row label="Client" value={deal.client_name || "—"} />
          <Row label="Value" value={fmtMoney(deal.value)} />
          <Row label="Due date" value={fmtDate(deal.due_date)} />
          <Row label="Status" value={statusLabel} />

          {active.map((d) => (
            <div key={d.key} className="flex items-start justify-between gap-3 text-[12.5px]">
              <dt style={{ color: "var(--fg-4)" }}>{d.label}</dt>
              <dd style={{ color: "var(--fg-2)", textAlign: "right", fontWeight: 500 }}>
                {d.type === "url" && values?.[d.key]
                  ? <a href={String(values[d.key])} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>{formatValue(d, values[d.key], peopleMap)}</a>
                  : formatValue(d, values?.[d.key], peopleMap)}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {canEdit && (
        <div style={{ borderTop: "1px solid var(--divider)", marginTop: 14, paddingTop: 12 }}>
          <Link href="/deals/fields" className="text-[11.5px]" style={{ color: "var(--fg-4)" }}>
            Manage custom fields →
          </Link>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-[12.5px]">
      <dt style={{ color: "var(--fg-4)" }}>{label}</dt>
      <dd style={{ color: "var(--fg-2)", textAlign: "right", fontWeight: 500 }}>{value}</dd>
    </div>
  );
}
