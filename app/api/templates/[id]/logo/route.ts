import { getClaimsUser } from "@/utils/auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { tryCreateAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/jpg"]);
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient(await cookies());
  const user = await getClaimsUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("team_members").select("org_id").eq("user_id", user.id).maybeSingle();
  if (!member) return NextResponse.json({ error: "No org" }, { status: 400 });

  // Verify template belongs to org and load any existing logo for cleanup.
  const { data: existing } = await supabase
    .from("proposal_templates")
    .select("id, logo_path")
    .eq("id", id)
    .eq("org_id", member.org_id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "Logo must be PNG or JPG" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Logo must be under 4 MB" }, { status: 400 });
  }

  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = `${member.org_id}/${id}/logo-${Date.now()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const writer = tryCreateAdminClient() ?? supabase;
  const { error: upErr } = await writer.storage.from("templates").upload(path, bytes, {
    contentType: file.type,
    upsert: true,
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Best-effort cleanup of any old logo for this template.
  if (existing.logo_path && existing.logo_path !== path) {
    await writer.storage.from("templates").remove([existing.logo_path]);
  }

  const { error: updErr } = await writer
    .from("proposal_templates")
    .update({ logo_path: path, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", member.org_id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, logo_path: path });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient(await cookies());
  const user = await getClaimsUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("team_members").select("org_id").eq("user_id", user.id).maybeSingle();
  if (!member) return NextResponse.json({ error: "No org" }, { status: 400 });

  const { data: existing } = await supabase
    .from("proposal_templates")
    .select("id, logo_path")
    .eq("id", id)
    .eq("org_id", member.org_id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const writer = tryCreateAdminClient() ?? supabase;
  if (existing.logo_path) {
    await writer.storage.from("templates").remove([existing.logo_path]);
  }
  await writer
    .from("proposal_templates")
    .update({ logo_path: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", member.org_id);

  return NextResponse.json({ ok: true });
}
