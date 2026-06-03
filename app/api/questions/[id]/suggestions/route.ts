import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { suggestAnswers, LIBRARY_SUGGEST_MIN } from "@/lib/answer-library";

export const runtime = "nodejs";

/**
 * Nearest approved answers for this question, for the Reuse card.
 * Returns only matches at/above LIBRARY_SUGGEST_MIN, best first.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: q } = await supabase
    .from("questions")
    .select("id, question_text, documents(deals(org_id))")
    .eq("id", id)
    .maybeSingle();
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orgId: string = (q as any).documents?.deals?.org_id ?? "";
  const questionText: string = (q as any).question_text ?? "";
  if (!orgId || !questionText) return NextResponse.json({ suggestions: [] });

  const matches = await suggestAnswers(supabase, {
    org_id: orgId,
    question_text: questionText,
    limit: 3,
  });

  // Don't suggest an answer captured from this very question.
  const suggestions = matches
    .filter((m) => m.similarity >= LIBRARY_SUGGEST_MIN)
    .filter((m) => m.source_question_id !== id);

  return NextResponse.json({ suggestions });
}
