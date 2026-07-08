import { getClaimsUser } from "@/utils/auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { tryCreateAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createClient(await cookies());
  const user = await getClaimsUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("team_members")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "No org" }, { status: 400 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const name = (form.get("name") as string) || "";
  const description = (form.get("description") as string) || "";
  const accent = (form.get("accent_color") as string) || "#00872F";
  const isDefault = form.get("is_default") === "true";

  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });
  if (!name.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  // Validate extension
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext !== "docx") {
    return NextResponse.json({ error: "Only .docx files supported" }, { status: 400 });
  }

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectPath = `${member.org_id}/${Date.now()}-${safe}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const writer = tryCreateAdminClient() ?? supabase;

  // Ensure bucket exists (idempotent)
  try {
    await writer.storage.createBucket("templates", { public: false });
  } catch {}

  const storage = writer.storage.from("templates");
  let { error: upErr } = await storage.upload(objectPath, bytes, {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    upsert: false,
  });
  if (upErr && /bucket.*not found/i.test(upErr.message)) {
    // Retry once after explicit create
    await writer.storage.createBucket("templates", { public: false });
    ({ error: upErr } = await storage.upload(objectPath, bytes, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: false,
    }));
  }
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Enforce single default
  if (isDefault) {
    await writer.from("proposal_templates").update({ is_default: false }).eq("org_id", member.org_id);
  }

  const { data: row, error: insertErr } = await writer
    .from("proposal_templates")
    .insert({
      org_id: member.org_id,
      name: name.trim(),
      description: description || null,
      kind: "docx",
      file_path: objectPath,
      file_name: file.name,
      accent_color: accent,
      is_default: isDefault,
      created_by: user.id,
    })
    .select()
    .single();
  if (insertErr) {
    await storage.remove([objectPath]);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ template: row });
}
