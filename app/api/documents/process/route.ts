import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { tryCreateAdminClient } from "@/utils/supabase/admin";
import { runFullPipeline } from "@/lib/agents";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { document_id } = await req.json();
  if (!document_id) return NextResponse.json({ error: "document_id required" }, { status: 400 });

  const { data: doc } = await supabase
    .from("documents")
    .select("id, deal_id, deals(org_id, organizations(name))")
    .eq("id", document_id)
    .maybeSingle();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If the LLM key is missing, mark the document with a clear state and return
  // success — upload UX shouldn't error out.
  if (!process.env.CEREBRAS_API_KEY) {
    await supabase
      .from("documents")
      .update({
        processing_status: "uploaded",
        error_message:
          "CEREBRAS_API_KEY not configured. The file is stored, but the AI pipeline is disabled until a key is set in .env.local.",
      })
      .eq("id", document_id);
    return NextResponse.json({ ok: true, skipped: true, reason: "llm_key_missing" });
  }

  // Prefer admin for the pipeline (writes across many tables across long runs).
  // Falls back to user-context client where RLS already permits these writes.
  const writer = tryCreateAdminClient() ?? supabase;

  const orgName =
    (doc as any).deals?.organizations?.name ??
    (doc as any).deals?.[0]?.organizations?.[0]?.name ??
    "Workspace";

  try {
    await runFullPipeline(writer, document_id, { orgName });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Pipeline failed" }, { status: 500 });
  }
}
