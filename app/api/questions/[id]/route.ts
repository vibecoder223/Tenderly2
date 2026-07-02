import { getClaimsUser } from "@/utils/auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient(await cookies());
  const user = await getClaimsUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: q, error } = await supabase
    .from("questions")
    .select(
      "id, document_id, requirement_id, question_text, status, priority, category, assigned_to, due_date, " +
        "responses(id, draft_text, ai_generated_draft, final_text, status, tone, confidence, gap_flag, " +
        "answer_text_with_markers, " +
        "citations(id, document_filename, section_path, page, quote))"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !q) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: req } = (q as any).requirement_id
    ? await supabase
        .from("extracted_requirements")
        .select("classification, topic, source_page, section, is_mandatory")
        .eq("document_id", (q as any).document_id)
        .eq("requirement_id", (q as any).requirement_id)
        .maybeSingle()
    : { data: null };

  const { data: comments } = await supabase
    .from("question_comments")
    .select("id, author_id, author_name, body, created_at")
    .eq("question_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ question: q, requirement: req ?? null, comments: comments ?? [] });
}
