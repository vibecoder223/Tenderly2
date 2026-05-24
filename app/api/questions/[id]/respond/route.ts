import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const status = body.status === "submitted" ? "submitted" : "draft";

  const { data: existing } = await supabase
    .from("responses")
    .select("id, version")
    .eq("question_id", id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("responses")
      .update({
        draft_text: body.draft_text ?? null,
        tone: body.tone ?? "technical",
        status,
        submitted_by: status === "submitted" ? user.id : null,
        submitted_at: status === "submitted" ? new Date().toISOString() : null,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("responses").insert({
      question_id: id,
      draft_text: body.draft_text ?? null,
      tone: body.tone ?? "technical",
      status,
      submitted_by: status === "submitted" ? user.id : null,
      submitted_at: status === "submitted" ? new Date().toISOString() : null,
    });
  }

  // Map response state → question workflow state in the new taxonomy.
  // submitted = up for review; draft = still drafting.
  await supabase
    .from("questions")
    .update({ status: status === "submitted" ? "review" : "drafting" })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
