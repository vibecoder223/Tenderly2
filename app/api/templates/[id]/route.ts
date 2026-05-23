import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("team_members").select("org_id").eq("user_id", user.id).maybeSingle();
  if (!member) return NextResponse.json({ error: "No org" }, { status: 400 });

  const body = await req.json();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ["name", "description", "intro", "footer", "accent_color", "font_family", "logo_path"]) {
    if (k in body) update[k] = body[k];
  }
  if ("is_default" in body) {
    if (body.is_default) {
      await supabase.from("proposal_templates").update({ is_default: false }).eq("org_id", member.org_id);
    }
    update.is_default = !!body.is_default;
  }

  const { data, error } = await supabase
    .from("proposal_templates")
    .update(update)
    .eq("id", id)
    .eq("org_id", member.org_id)
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("team_members").select("org_id").eq("user_id", user.id).maybeSingle();
  if (!member) return NextResponse.json({ error: "No org" }, { status: 400 });

  // Look up file path first so we can remove the storage object
  const { data: existing } = await supabase
    .from("proposal_templates")
    .select("file_path")
    .eq("id", id)
    .eq("org_id", member.org_id)
    .maybeSingle();

  const { error } = await supabase
    .from("proposal_templates")
    .delete()
    .eq("id", id)
    .eq("org_id", member.org_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (existing?.file_path) {
    await supabase.storage.from("templates").remove([existing.file_path]);
  }
  return NextResponse.json({ ok: true });
}
