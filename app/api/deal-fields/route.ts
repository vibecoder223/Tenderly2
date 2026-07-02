import { getClaimsUser } from "@/utils/auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { slugifyKey, FIELD_TYPES, type FieldType } from "@/lib/deal-fields";

const VALID_TYPES = new Set(FIELD_TYPES.map((t) => t.value));

async function getMember(supabase: any) {
  const user = await getClaimsUser(supabase);
  if (!user) return { error: "Unauthorized", status: 401 as const };
  const { data: member } = await supabase
    .from("team_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member) return { error: "No org", status: 400 as const };
  return { user, member };
}

export async function GET() {
  const supabase = createClient(await cookies());
  const m = await getMember(supabase);
  if ("error" in m) return NextResponse.json({ error: m.error }, { status: m.status });

  const { data, error } = await supabase
    .from("deal_field_definitions")
    .select("*")
    .eq("org_id", m.member.org_id)
    .order("position", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ fields: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = createClient(await cookies());
  const m = await getMember(supabase);
  if ("error" in m) return NextResponse.json({ error: m.error }, { status: m.status });
  if (!["admin", "owner"].includes(m.member.role)) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = await req.json();
  const label = String(body.label ?? "").trim();
  const type = body.type as FieldType;
  if (!label) return NextResponse.json({ error: "label required" }, { status: 400 });
  if (!VALID_TYPES.has(type)) return NextResponse.json({ error: "invalid type" }, { status: 400 });

  const options =
    type === "select" && Array.isArray(body.options)
      ? body.options.map((o: unknown) => String(o).trim()).filter(Boolean)
      : null;
  if (type === "select" && (!options || options.length === 0)) {
    return NextResponse.json({ error: "select fields need at least one option" }, { status: 400 });
  }

  // Unique key per org; suffix on collision.
  const base = slugifyKey(label);
  const { data: existing } = await supabase
    .from("deal_field_definitions")
    .select("key")
    .eq("org_id", m.member.org_id);
  const taken = new Set((existing ?? []).map((r: any) => r.key));
  let key = base;
  let i = 2;
  while (taken.has(key)) key = `${base}_${i++}`;

  const position = (existing?.length ?? 0);

  const { data, error } = await supabase
    .from("deal_field_definitions")
    .insert({
      org_id: m.member.org_id,
      label,
      key,
      type,
      options,
      required: !!body.required,
      position,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ field: data });
}
