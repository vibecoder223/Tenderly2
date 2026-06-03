import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { callGeminiText as callClaudeText } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.GOOGLE_AI_API_KEY) {
    return NextResponse.json(
      { error: "GOOGLE_AI_API_KEY is not configured. Set it in .env.local to use AI regeneration." },
      { status: 503 }
    );
  }

  const { tone } = await req.json();

  const { data: q } = await supabase
    .from("questions")
    .select("id, question_text, document_id, documents(deal_id, deals(org_id, organizations(name)))")
    .eq("id", id)
    .maybeSingle();
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orgName =
    (q as any).documents?.deals?.organizations?.name ??
    "Workspace";

  try {
    const { text } = await callClaudeText({
      system: `You are a senior solutions engineer drafting a response for an RFP. Write a clear, ${tone || "technical"} response in 150–300 words. Be specific and direct.`,
      user: `Company: ${orgName}\n\nQuestion / requirement:\n${q.question_text}\n\nDraft the response now. Output only the response text.`,
      maxTokens: 800,
    });

    const { data: existing } = await supabase
      .from("responses")
      .select("id")
      .eq("question_id", id)
      .limit(1)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("responses")
        .update({ ai_generated_draft: text, draft_text: text, tone: tone || "technical" })
        .eq("id", existing.id);
    } else {
      await supabase.from("responses").insert({
        question_id: id,
        ai_generated_draft: text,
        draft_text: text,
        tone: tone || "technical",
        status: "draft",
      });
    }

    return NextResponse.json({ draft_text: text });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
