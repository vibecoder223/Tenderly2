import { getClaimsUser } from "@/utils/auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

async function requireAdmin(supabase: any) {
  const user = await getClaimsUser(supabase);
  if (!user) return { error: "Unauthorized", status: 401 as const };
  const { data: member } = await supabase
    .from("team_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member) return { error: "No org", status: 400 as const };
  if (!["admin", "owner"].includes(member.role)) {
    return { error: "Admins only", status: 403 as const };
  }
  return { member };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createClient(await cookies());
  const m = await requireAdmin(supabase);
  if ("error" in m) return NextResponse.json({ error: m.error }, { status: m.status });

  const { id } = await params;
  const body = await req.json();

  const update: Record<string, unknown> = {};
  if (typeof body.label === "string" && body.label.trim()) update.label = body.label.trim();
  if (typeof body.required === "boolean") update.required = body.required;
  if (typeof body.archived === "boolean") update.archived = body.archived;
  if (typeof body.position === "number") update.position = body.position;
  if (Array.isArray(body.options)) {
    update.options = body.options.map((o: unknown) => String(o).trim()).filter(Boolean);
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("deal_field_definitions")
    .update(update)
    .eq("id", id)
    .eq("org_id", m.member.org_id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ field: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createClient(await cookies());
  const m = await requireAdmin(supabase);
  if ("error" in m) return NextResponse.json({ error: m.error }, { status: m.status });

  const { id } = await params;
  const { error } = await supabase
    .from("deal_field_definitions")
    .delete()
    .eq("id", id)
    .eq("org_id", m.member.org_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
