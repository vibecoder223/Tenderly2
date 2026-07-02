import { getClaimsUser } from "@/utils/auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { embedTexts, hasEmbeddings } from "@/lib/embeddings";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = createClient(await cookies());
  const user = await getClaimsUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("team_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "No org" }, { status: 400 });

  const { category, keyword, question_text, response_text } = await req.json();
  if (!response_text) return NextResponse.json({ error: "response_text required" }, { status: 400 });

  // Embed the question so a manual answer is matchable for reuse like a captured
  // one. Without an embedding it would sit in the library but never surface.
  const question = typeof question_text === "string" ? question_text.trim() : "";
  let embedding: number[] | null = null;
  if (question && hasEmbeddings()) {
    try {
      const [emb] = await embedTexts([question], "document");
      if (emb) embedding = emb;
    } catch {
      // best-effort — store without embedding rather than failing the add
    }
  }

  const { error } = await supabase.from("response_library").insert({
    org_id: member.org_id,
    category: category || null,
    keyword: keyword || null,
    question_text: question || null,
    response_text,
    embedding,
    source: "manual",
    created_by: user.id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
