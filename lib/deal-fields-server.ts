import { coerceValue, type FieldType } from "@/lib/deal-fields";

// Keep only values whose key matches a defined (non-archived) field, coerced
// to the field's storage type. Drops unknown keys so deals.custom_fields can
// never accumulate junk from a crafted request body.
export async function sanitizeCustomFields(
  supabase: any,
  orgId: string,
  raw: unknown
): Promise<Record<string, unknown>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const { data: defs } = await supabase
    .from("deal_field_definitions")
    .select("key, type")
    .eq("org_id", orgId)
    .eq("archived", false);

  const out: Record<string, unknown> = {};
  for (const d of (defs ?? []) as { key: string; type: FieldType }[]) {
    if (Object.prototype.hasOwnProperty.call(raw, d.key)) {
      out[d.key] = coerceValue(d.type, (raw as Record<string, unknown>)[d.key]);
    }
  }
  return out;
}
