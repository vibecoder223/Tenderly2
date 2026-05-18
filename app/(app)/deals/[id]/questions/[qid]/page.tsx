import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMembership } from "@/utils/auth";
import QuestionDetail from "./QuestionDetail";

export default async function QuestionDetailPage({
  params,
}: {
  params: Promise<{ id: string; qid: string }>;
}) {
  const { id, qid } = await params;
  const { supabase, member, user } = await requireMembership();

  const { data: deal } = await supabase
    .from("deals")
    .select("id")
    .eq("id", id)
    .eq("org_id", member.org_id)
    .maybeSingle();
  if (!deal) notFound();

  const { data: qRaw } = await supabase
    .from("questions")
    .select(
      "id, document_id, requirement_id, question_text, status, priority, category, assigned_to, due_date, " +
        "responses(id, draft_text, ai_generated_draft, final_text, status, tone, confidence, gap_flag, " +
        "answer_text_with_markers, " +
        "citations(id, document_filename, section_path, page, quote))"
    )
    .eq("id", qid)
    .maybeSingle();
  if (!qRaw) notFound();
  const q = qRaw as any;

  const { data: req } = q.requirement_id
    ? await supabase
        .from("extracted_requirements")
        .select("classification, topic, source_page, section, is_mandatory")
        .eq("document_id", q.document_id)
        .eq("requirement_id", q.requirement_id)
        .maybeSingle()
    : { data: null as any };

  const { data: members } = await supabase
    .from("team_members")
    .select("user_id, name, email")
    .eq("org_id", member.org_id);

  const { data: comments } = await supabase
    .from("question_comments")
    .select("id, author_id, author_name, body, created_at")
    .eq("question_id", qid)
    .order("created_at", { ascending: true });

  return (
    <div className="p-7 max-w-[1300px]">
      <div className="text-[12px] mb-3" style={{ color: "var(--fg-4)" }}>
        <Link href={`/deals/${id}/questions`} style={{ color: "var(--fg-4)" }}>
          ← Back to questions
        </Link>
      </div>
      <QuestionDetail
        dealId={id}
        question={q as any}
        requirement={req as any}
        members={(members ?? []) as any[]}
        comments={(comments ?? []) as any[]}
        currentUser={{ id: user.id, name: (user.user_metadata as any)?.name ?? null, email: user.email ?? "" }}
      />
    </div>
  );
}
