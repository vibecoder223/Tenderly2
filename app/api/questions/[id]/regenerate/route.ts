import { getClaimsUser } from "@/utils/auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { tryCreateAdminClient } from "@/utils/supabase/admin";
import { generateAndPersistAnswer } from "@/lib/rag";
import { hasLlmKey } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient(await cookies());
  const user = await getClaimsUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasLlmKey()) {
    return NextResponse.json(
      { error: "No LLM API key configured. Set OPENROUTER_API_KEY (or CEREBRAS_API_KEY) in .env.local." },
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

  // Guard: AI drafts retrieve from the knowledge base. Empty KB = empty drafts.
  // Bail with a clear error rather than producing hallucinated output.
  const { count: kbReady } = await supabase
    .from("knowledge_documents")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("ingestion_status", "ready");
  if (!kbReady || kbReady === 0) {
    return NextResponse.json(
      {
        error:
          "Your knowledge base is empty. Upload at least one past proposal, policy, or security doc before generating drafts.",
      },
      { status: 409 }
    );
  }

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
