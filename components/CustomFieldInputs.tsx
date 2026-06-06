"use client";

import type { DealFieldDef } from "@/lib/deal-fields";
import Select from "@/components/Select";

export type Person = { user_id: string; name: string | null; email: string };

export default function CustomFieldInputs({
  defs,
  values,
  people,
  onChange,
}: {
  defs: DealFieldDef[];
  values: Record<string, unknown>;
  people?: Person[];
  onChange: (key: string, value: unknown) => void;
}) {
  const active = defs.filter((d) => !d.archived);
  if (active.length === 0) return null;

  return (
    <>
      {active.map((d) => {
        const v = values[d.key];
        const labelEl = (
          <label className="label">
            {d.label}
            {d.required && <span style={{ color: "var(--err)", marginLeft: 3 }}>*</span>}
          </label>
        );

        if (d.type === "boolean") {
          return (
            <label key={d.key} className="flex items-center gap-2 text-[13px]" style={{ color: "var(--fg-3)" }}>
              <input
                type="checkbox"
                checked={v === true}
                onChange={(e) => onChange(d.key, e.target.checked)}
              />
              {d.label}
            </label>
          );
        }

        return (
          <div key={d.key}>
            {labelEl}
            {d.type === "select" ? (
              <Select
                value={(v as string) ?? ""}
                onChange={(val) => onChange(d.key, val)}
                fullWidth
                triggerClassName="input"
                placeholder="—"
                options={[{ value: "", label: "—" }, ...(d.options ?? []).map((o) => ({ value: o, label: o }))]}
              />
            ) : d.type === "person" ? (
              <Select
                value={(v as string) ?? ""}
                onChange={(val) => onChange(d.key, val)}
                fullWidth
                triggerClassName="input"
                placeholder="—"
                options={[{ value: "", label: "—" }, ...(people ?? []).map((p) => ({ value: p.user_id, label: p.name || p.email }))]}
              />
            ) : (
              <input
                className={`input${d.type === "number" || d.type === "currency" ? " mono" : ""}`}
                type={
                  d.type === "number" || d.type === "currency" ? "number"
                  : d.type === "date" ? "date"
                  : d.type === "url" ? "url"
                  : "text"
                }
                value={(v as string) ?? ""}
                onChange={(e) => onChange(d.key, e.target.value)}
                placeholder={d.type === "url" ? "https://…" : undefined}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
