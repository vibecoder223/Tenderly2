import { getClaimsUser } from "@/utils/auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { tryCreateAdminClient } from "@/utils/supabase/admin";
import { captureApprovedAnswer } from "@/lib/answer-library";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient(await cookies());
  const user = await getClaimsUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { decision, final_text } = await req.json();

  const { data: response } = await supabase
    .from("responses")
    .select("id, question_id, draft_text, questions(question_text, documents(deals(org_id)))")
    .eq("id", id)
    .maybeSingle();
  if (!response) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (decision === "approve") {
    const approvedText = final_text ?? response.draft_text;
    await supabase
      .from("responses")
      .update({
        final_text: approvedText,
        status: "approved",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id);
    await supabase
      .from("questions")
      .update({ status: "approved" })
      .eq("id", response.question_id);

    // Auto-capture into the answer library (best-effort — never blocks approval).
    const q = (response as any).questions;
    const orgId: string = q?.documents?.deals?.org_id ?? "";
    const questionText: string = q?.question_text ?? "";
    let captured = null;
    if (orgId && questionText && approvedText) {
      const writer = tryCreateAdminClient() ?? supabase;
      captured = await captureApprovedAnswer(writer, {
        org_id: orgId,
        question_id: response.question_id,
        question_text: questionText,
        answer_text: approvedText,
        created_by: user.id,
      });
    }
    return NextResponse.json({ ok: true, captured });
  } else if (decision === "reject") {
    await supabase.from("responses").update({ status: "draft" }).eq("id", id);
    await supabase.from("questions").update({ status: "blocked" }).eq("id", response.question_id);
  }

  return NextResponse.json({ ok: true });
}
