import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { decision, final_text } = await req.json();

  const { data: response } = await supabase
    .from("responses")
    .select("id, question_id, draft_text")
    .eq("id", id)
    .maybeSingle();
  if (!response) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (decision === "approve") {
    await supabase
      .from("responses")
      .update({
        final_text: final_text ?? response.draft_text,
        status: "approved",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id);
    await supabase
      .from("questions")
      .update({ status: "approved" })
      .eq("id", response.question_id);
  } else if (decision === "reject") {
    await supabase.from("responses").update({ status: "draft" }).eq("id", id);
    await supabase.from("questions").update({ status: "rejected" }).eq("id", response.question_id);
  }

  return NextResponse.json({ ok: true });
}
