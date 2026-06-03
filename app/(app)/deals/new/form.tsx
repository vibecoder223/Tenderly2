"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CustomFieldInputs, { type Person } from "@/components/CustomFieldInputs";
import {
  coerceValue,
  firstMissingRequired,
  FIELD_TYPES,
  type DealFieldDef,
  type FieldType,
} from "@/lib/deal-fields";

export default function NewDealForm({
  fields = [],
  people = [],
  canManage = false,
}: {
  fields?: DealFieldDef[];
  people?: Person[];
  canManage?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [value, setValue] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [custom, setCustom] = useState<Record<string, unknown>>({});
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Org custom-field definitions, editable inline (Microsoft-Lists style).
  const [defs, setDefs] = useState<DealFieldDef[]>(fields.filter((f) => !f.archived));

  function setCustomField(key: string, v: unknown) {
    setCustom((prev) => ({ ...prev, [key]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const missing = firstMissingRequired(defs, custom);
    if (missing) { setErr(`${missing} is required`); return; }

    const custom_fields: Record<string, unknown> = {};
    for (const f of defs) custom_fields[f.key] = coerceValue(f.type, custom[f.key]);

    setLoading(true);
    const res = await fetch("/api/deals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        client_name: client || null,
        value: value ? Number(value) : null,
        due_date: dueDate || null,
        custom_fields,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed" }));
      setErr(error || "Failed");
      return;
    }
    const { deal } = await res.json();
    router.push(`/deals/${deal.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card p-6 space-y-5">
      <div>
        <label className="label">Deal name</label>
        <input
          className="input"
          required
          value={name}
          placeholder="e.g. Acme Corp — Q1 2026 RFP"
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Client / company</label>
        <input
          className="input"
          value={client}
          placeholder="Acme Corp"
          onChange={(e) => setClient(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Estimated value (USD)</label>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Due date</label>
          <input
            className="input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>

      <div className="pt-1" style={{ borderTop: "1px solid var(--divider)" }}>
        <div className="flex items-center justify-between pt-4 mb-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--fg-5)" }}>
            Additional details
          </div>
        </div>

        {defs.length === 0 && (
          <p className="text-[12.5px] mb-3" style={{ color: "var(--fg-4)" }}>
            {canManage
              ? "Add custom details for every deal — like a Microsoft List."
              : "No custom details defined yet."}
          </p>
        )}

        {defs.length > 0 && (
          <CustomFieldInputs
            defs={defs}
            values={custom}
            people={people}
            onChange={setCustomField}
          />
        )}

        {canManage && (
          <AddFieldInline
            onAdded={(def) => setDefs((prev) => [...prev, def])}
          />
        )}
      </div>

      {err && <div className="text-xs" style={{ color: "var(--err)" }}>{err}</div>}
      <div className="pt-1">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Creating…" : "Create deal"}
        </button>
      </div>
    </form>
  );
}

function AddFieldInline({ onAdded }: { onAdded: (def: DealFieldDef) => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [optionsRaw, setOptionsRaw] = useState("");
  const [required, setRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const needsOptions = type === "select";

  function reset() {
    setLabel(""); setType("text"); setOptionsRaw(""); setRequired(false); setErr(null);
  }

  async function add() {
    setErr(null);
    if (!label.trim()) { setErr("Field name required"); return; }
    const options = needsOptions
      ? optionsRaw.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;
    if (needsOptions && (!options || options.length === 0)) {
      setErr("Add at least one choice (comma-separated)"); return;
    }
    setBusy(true);
    const res = await fetch("/api/deal-fields", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: label.trim(), type, options, required }),
    });
    setBusy(false);
    if (!res.ok) {
      setErr((await res.json().catch(() => ({}))).error || "Failed to add field");
      return;
    }
    const { field } = await res.json();
    onAdded(field as DealFieldDef);
    reset();
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        className="flex items-center gap-1.5 mt-3 text-[12.5px]"
        style={{ color: "var(--accent)" }}
        onClick={() => setOpen(true)}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add detail field
      </button>
    );
  }

  return (
    <div
      className="mt-3 p-4 space-y-3"
      style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 8 }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Field name</label>
          <input
            className="input"
            autoFocus
            value={label}
            placeholder="e.g. Region"
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value as FieldType)}>
            {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {needsOptions && (
        <div>
          <label className="label">Choices (comma-separated)</label>
          <input
            className="input"
            value={optionsRaw}
            placeholder="EMEA, AMER, APAC"
            onChange={(e) => setOptionsRaw(e.target.value)}
          />
        </div>
      )}

      <label className="flex items-center gap-2 text-[12.5px]" style={{ color: "var(--fg-3)" }}>
        <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
        Required on every deal
      </label>

      {err && <div className="text-[12px]" style={{ color: "var(--err)" }}>{err}</div>}

      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={add}>
          {busy ? "Adding…" : "Add field"}
        </button>
        <button type="button" className="btn" onClick={() => { reset(); setOpen(false); }}>Cancel</button>
        <span className="text-[11px]" style={{ color: "var(--fg-5)" }}>Reused on all future deals</span>
      </div>
    </div>
  );
}
