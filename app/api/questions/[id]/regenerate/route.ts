import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { tryCreateAdminClient } from "@/utils/supabase/admin";
import { generateAndPersistAnswer } from "@/lib/rag";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY is not configured. Set it in .env.local." },
      { status: 503 }
    );
  }

  const { tone } = await req.json().catch(() => ({ tone: "technical" }));

  const { data: q } = await supabase
    .from("questions")
    .select("id, question_text, document_id, documents(deal_id, deals(org_id, organizations(name)))")
    .eq("id", id)
    .maybeSingle();
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orgId = (q as any).documents?.deals?.org_id ?? "";
  const orgName = (q as any).documents?.deals?.organizations?.name ?? "Workspace";

  const writer = tryCreateAdminClient() ?? supabase;

  try {
    await generateAndPersistAnswer(writer, {
      question_id: id,
      question_text: (q as any).question_text,
      org_id: orgId,
      org_name: orgName,
      tone: tone || "technical",
    });
    const { data: resp } = await supabase
      .from("responses")
      .select("draft_text, final_text")
      .eq("question_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return NextResponse.json({ draft_text: resp?.draft_text || resp?.final_text || "" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
