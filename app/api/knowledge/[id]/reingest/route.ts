import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { tryCreateAdminClient } from "@/utils/supabase/admin";
import { ingestKnowledgeDocument } from "@/lib/ingest";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: kdoc } = await supabase
    .from("knowledge_documents")
    .select("id, org_id, filename, file_path, mime_type, ingestion_status")
    .eq("id", id)
    .maybeSingle();
  if (!kdoc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const writer = tryCreateAdminClient() ?? supabase;

  // Reset status so the client UI shows progress immediately.
  await writer
    .from("knowledge_documents")
    .update({ ingestion_status: "pending", error_message: null })
    .eq("id", id);

  // Await ingestion inside the request. In Next.js dev (and on some hosts)
  // a fire-and-forget background promise gets cancelled when the route
  // returns — that left documents permanently stuck on STAGE:parsing.
  // Awaiting blocks the response for tens of seconds but actually completes
  // the work; the client already shows a "Retrying…" state, so the wait is
  // acceptable for a manually-triggered retry.
  try {
    await ingestKnowledgeDocument(writer, {
      id: kdoc.id,
      org_id: kdoc.org_id,
      filename: kdoc.filename,
      file_path: kdoc.file_path,
      mime_type: kdoc.mime_type,
    });
  } catch (e: any) {
    await writer
      .from("knowledge_documents")
      .update({ ingestion_status: "failed", error_message: e.message })
      .eq("id", id);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
