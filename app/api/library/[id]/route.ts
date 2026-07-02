import { getClaimsUser } from "@/utils/auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { embedTexts, hasEmbeddings } from "@/lib/embeddings";

export const runtime = "nodejs";

// Edit a library entry. Re-embeds when question_text changes.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient(await cookies());
  const user = await getClaimsUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.response_text === "string") patch.response_text = body.response_text;
  if (typeof body.category === "string") patch.category = body.category || null;

  if (typeof body.question_text === "string") {
    patch.question_text = body.question_text;
    if (body.question_text.trim() && hasEmbeddings()) {
      try {
        const [emb] = await embedTexts([body.question_text.trim()], "document");
        if (emb) patch.embedding = emb;
      } catch { /* leave embedding as-is on failure */ }
    }
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });

  const { error } = await supabase.from("response_library").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient(await cookies());
  const user = await getClaimsUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.from("response_library").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
