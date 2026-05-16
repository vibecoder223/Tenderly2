import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { tryCreateAdminClient } from "@/utils/supabase/admin";
import { logActivity } from "@/utils/activity";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const dealId = form.get("deal_id") as string | null;
  if (!file || !dealId) {
    return NextResponse.json({ error: "file and deal_id required" }, { status: 400 });
  }

  const { data: deal } = await supabase
    .from("deals")
    .select("id, org_id")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  const filename = file.name;
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectPath = `${dealId}/${Date.now()}-${safeName}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  // Prefer admin for storage write to avoid edge cases with RLS on storage.objects.
  // Falls back to user-context — the migration has Storage RLS policies for org members.
  const storage = (tryCreateAdminClient() ?? supabase).storage.from("documents");

  const { error: uploadErr } = await storage.upload(objectPath, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { data: doc, error: insertErr } = await supabase
    .from("documents")
    .insert({
      deal_id: dealId,
      filename,
      file_path: objectPath,
      file_size: bytes.length,
      mime_type: file.type || null,
      processing_status: "uploaded",
    })
    .select()
    .single();
  if (insertErr) {
    await storage.remove([objectPath]);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  await logActivity(supabase, {
    org_id: deal.org_id,
    user_id: user.id,
    action: "uploaded",
    entity_type: "document",
    entity_id: doc.id,
    metadata: { filename, size: bytes.length },
  });

  return NextResponse.json({ document: doc });
}
