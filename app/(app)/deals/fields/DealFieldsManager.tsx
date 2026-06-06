"use client";

import { useState } from "react";
import Select from "@/components/Select";
import { FIELD_TYPES, type DealFieldDef, type FieldType } from "@/lib/deal-fields";

export default function DealFieldsManager({
  initial,
  canEdit,
}: {
  initial: DealFieldDef[];
  canEdit: boolean;
}) {
  const [fields, setFields] = useState<DealFieldDef[]>(initial);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // New-field form state
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [required, setRequired] = useState(false);
  const [optionsText, setOptionsText] = useState("");

  const visible = fields.filter((f) => !f.archived);

  async function createField() {
    setErr(null);
    if (!label.trim()) { setErr("Label required"); return; }
    const options =
      type === "select"
        ? optionsText.split("\n").map((s) => s.trim()).filter(Boolean)
        : undefined;
    if (type === "select" && (!options || options.length === 0)) {
      setErr("Add at least one choice"); return;
    }
    setBusy(true);
    const res = await fetch("/api/deal-fields", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: label.trim(), type, required, options }),
    });
    setBusy(false);
    if (!res.ok) { setErr((await res.json()).error || "Failed"); return; }
    const { field } = await res.json();
    setFields((p) => [...p, field]);
    setLabel(""); setType("text"); setRequired(false); setOptionsText("");
    setAdding(false);
  }

  async function patchField(id: string, patch: Partial<DealFieldDef>) {
    setFields((p) => p.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    await fetch(`/api/deal-fields/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function removeField(id: string) {
    setFields((p) => p.filter((f) => f.id !== id));
    await fetch(`/api/deal-fields/${id}`, { method: "DELETE" });
  }

  async function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= visible.length) return;
    const a = visible[index];
    const b = visible[j];
    // Swap positions and persist both.
    const newFields = fields.map((f) => {
      if (f.id === a.id) return { ...f, position: b.position };
      if (f.id === b.id) return { ...f, position: a.position };
      return f;
    });
    setFields(newFields.sort((x, y) => x.position - y.position));
    await Promise.all([
      fetch(`/api/deal-fields/${a.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ position: b.position }) }),
      fetch(`/api/deal-fields/${b.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ position: a.position }) }),
    ]);
  }

  return (
    <div className="space-y-4">
      {!canEdit && (
        <div className="card p-3 text-[12.5px]" style={{ color: "var(--fg-4)" }}>
          Only admins can edit deal fields. Showing current configuration.
        </div>
      )}

      <div className="card overflow-hidden">
        {visible.length === 0 ? (
          <div className="p-8 text-center text-[13px]" style={{ color: "var(--fg-4)" }}>
            No custom fields yet. Add one to collect extra info on every deal.
          </div>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {visible.map((f, i) => (
              <li
                key={f.id}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: "1px solid var(--divider)" }}
              >
                <span className="mono text-[11px]" style={{ color: "var(--fg-5)", width: 16 }}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div className="text-[13px] font-medium" style={{ color: "var(--fg)" }}>
                    {f.label}
                    {f.required && <span style={{ color: "var(--err)", marginLeft: 4 }}>*</span>}
                  </div>
                  <div className="meta-mono">
                    {FIELD_TYPES.find((t) => t.value === f.type)?.label ?? f.type}
                    {f.type === "select" && f.options?.length ? ` · ${f.options.length} choices` : ""}
                  </div>
                </div>
                {canEdit && (
                  <>
                    <label className="flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--fg-4)" }}>
                      <input
                        type="checkbox"
                        checked={f.required}
                        onChange={(e) => patchField(f.id, { required: e.target.checked })}
                      />
                      required
                    </label>
                    <button type="button" disabled={i === 0} onClick={() => move(i, -1)}
                      className="text-[12px] px-1" style={{ color: "var(--fg-4)", opacity: i === 0 ? 0.3 : 1 }} title="Move up">↑</button>
                    <button type="button" disabled={i === visible.length - 1} onClick={() => move(i, 1)}
                      className="text-[12px] px-1" style={{ color: "var(--fg-4)", opacity: i === visible.length - 1 ? 0.3 : 1 }} title="Move down">↓</button>
                    <button type="button" onClick={() => removeField(f.id)}
                      className="text-[11.5px]" style={{ color: "var(--fg-5)" }} title="Delete">✕</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canEdit && !adding && (
        <button type="button" className="btn" onClick={() => setAdding(true)}>+ Add field</button>
      )}

      {canEdit && adding && (
        <div className="card p-5 space-y-4">
          <h3 className="text-[13.5px] font-semibold" style={{ color: "var(--fg)" }}>New field</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Field label</label>
              <input className="input" value={label} placeholder="e.g. Bid reference" onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div>
              <label className="label">Type</label>
              <Select
                value={type}
                onChange={(v) => setType(v as FieldType)}
                fullWidth
                triggerClassName="input"
                options={FIELD_TYPES.map((t) => ({ value: t.value, label: t.label }))}
              />
            </div>
          </div>

          {type === "select" && (
            <div>
              <label className="label">Choices (one per line)</label>
              <textarea className="textarea" rows={4} value={optionsText}
                placeholder={"Low\nMedium\nHigh"}
                onChange={(e) => setOptionsText(e.target.value)} />
            </div>
          )}

          <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--fg-3)" }}>
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
            Required on every deal
          </label>

          {err && <div className="text-[12px]" style={{ color: "var(--err)" }}>{err}</div>}

          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={createField}>
              {busy ? "Adding…" : "Add field"}
            </button>
            <button type="button" className="btn" onClick={() => { setAdding(false); setErr(null); }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
