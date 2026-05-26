import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { tryCreateAdminClient } from "@/utils/supabase/admin";
import { logActivity } from "@/utils/activity";
import { ingestKnowledgeDocument } from "@/lib/ingest";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("team_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "No org" }, { status: 400 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const docType = (form.get("doc_type") as string) || "other";
  if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

  const filename = file.name;
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectPath = `${member.org_id}/${Date.now()}-${safe}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const storage = (tryCreateAdminClient() ?? supabase).storage.from("knowledge");
  const { error: uploadErr } = await storage.upload(objectPath, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const writer = tryCreateAdminClient() ?? supabase;
  const { data: row, error: insertErr } = await writer
    .from("knowledge_documents")
    .insert({
      org_id: member.org_id,
      filename,
      file_path: objectPath,
      file_size: bytes.length,
      mime_type: file.type || null,
      doc_type: ["past_proposal", "security_doc", "policy", "other"].includes(docType)
        ? docType
        : "other",
      ingestion_status: "pending",
      uploaded_by: user.id,
    })
    .select()
    .single();
  if (insertErr) {
    await storage.remove([objectPath]);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Await ingestion inside the request. Next.js dev (and some hosts) cancel
  // fire-and-forget promises after the route returns, which left documents
  // permanently stuck on STAGE:parsing. The client already shows an upload
  // progress UI, so a few extra seconds for the response is acceptable.
  try {
    const result = await ingestKnowledgeDocument(writer, {
      id: row.id,
      org_id: row.org_id,
      filename: row.filename,
      file_path: row.file_path,
      mime_type: row.mime_type,
    });
    await logActivity(supabase, {
      org_id: member.org_id,
      user_id: user.id,
      action: "ingested",
      entity_type: "knowledge_document",
      entity_id: row.id,
      metadata: { filename, ...result },
    });
  } catch (e: any) {
    await writer
      .from("knowledge_documents")
      .update({ ingestion_status: "failed", error_message: e.message })
      .eq("id", row.id);
  }

  return NextResponse.json({ knowledge_document: row });
}
