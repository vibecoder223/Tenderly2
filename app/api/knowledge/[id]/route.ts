import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { tryCreateAdminClient } from "@/utils/supabase/admin";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Look up the file_path under RLS first to confirm access
  const { data: kdoc } = await supabase
    .from("knowledge_documents")
    .select("id, file_path")
    .eq("id", id)
    .maybeSingle();
  if (!kdoc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const writer = tryCreateAdminClient() ?? supabase;

  // Chunks cascade via FK on knowledge_document_id; row delete also removes them.
  const { error } = await writer.from("knowledge_documents").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort storage purge — leave a stale object rather than fail the delete.
  await (tryCreateAdminClient() ?? supabase).storage.from("knowledge").remove([kdoc.file_path]);

  return NextResponse.json({ ok: true });
}
