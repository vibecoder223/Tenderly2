// Shared types + helpers for org-defined deal custom fields.

export type FieldType =
  | "text"
  | "number"
  | "currency"
  | "date"
  | "select"
  | "boolean"
  | "url"
  | "person";

export type DealFieldDef = {
  id: string;
  org_id?: string;
  label: string;
  key: string;
  type: FieldType;
  options: string[] | null;
  required: boolean;
  position: number;
  archived: boolean;
};

export const FIELD_TYPES: { value: FieldType; label: string; hasOptions?: boolean }[] = [
  { value: "text", label: "Single line text" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "date", label: "Date" },
  { value: "select", label: "Choice (dropdown)", hasOptions: true },
  { value: "boolean", label: "Yes / No" },
  { value: "url", label: "URL" },
  { value: "person", label: "Person (team member)" },
];

// label -> stable snake_case key
export function slugifyKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "field";
}

// Coerce a raw form value into the type we store in jsonb.
export function coerceValue(type: FieldType, raw: unknown): unknown {
  if (raw === "" || raw === null || raw === undefined) return null;
  switch (type) {
    case "number":
    case "currency": {
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    }
    case "boolean":
      return raw === true || raw === "true" || raw === "on";
    default:
      return String(raw);
  }
}

// Human-readable display value. `people` maps user_id -> name for person fields.
export function formatValue(
  def: DealFieldDef,
  value: unknown,
  people?: Map<string, string>
): string {
  if (value === null || value === undefined || value === "") return "—";
  switch (def.type) {
    case "currency": {
      const n = Number(value);
      return Number.isFinite(n)
        ? n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })
        : String(value);
    }
    case "number":
      return String(value);
    case "boolean":
      return value ? "Yes" : "No";
    case "date":
      return String(value).slice(0, 10);
    case "person":
      return people?.get(String(value)) ?? String(value);
    default:
      return String(value);
  }
}

// Validate required fields. Returns first missing field label, or null.
export function firstMissingRequired(
  defs: DealFieldDef[],
  values: Record<string, unknown>
): string | null {
  for (const d of defs) {
    if (d.archived || !d.required) continue;
    const v = values[d.key];
    if (v === null || v === undefined || v === "" || (d.type === "boolean" && v === false)) {
      return d.label;
    }
  }
  return null;
}
