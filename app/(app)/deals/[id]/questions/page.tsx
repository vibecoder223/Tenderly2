import { notFound } from "next/navigation";
import { requireMembership } from "@/utils/auth";
import QuestionsTable from "./QuestionsTable";

export default async function QuestionsTab({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ doc?: string; status?: string; topic?: string; q?: string }>;
}) {
  const { id } = await params;
  const { doc: docParam, status, topic, q } = await searchParams;
  const { supabase, member, user } = await requireMembership();

  const { data: deal } = await supabase
    .from("deals")
    .select("id")
    .eq("id", id)
    .eq("org_id", member.org_id)
    .maybeSingle();
  if (!deal) notFound();

  let docId = docParam;
  if (!docId) {
    const { data: latest } = await supabase
      .from("documents")
      .select("id")
      .eq("deal_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    docId = latest?.id;
  }

  const { data: documents } = await supabase
    .from("documents")
    .select("id, filename")
    .eq("deal_id", id)
    .order("created_at", { ascending: false });

  let questions: any[] = [];
  if (docId) {
    const { data } = await supabase
      .from("questions")
      .select(
        "id, requirement_id, question_text, status, priority, category, assigned_to, due_date, last_activity_at, " +
          "responses(id, draft_text, final_text, status, confidence, gap_flag, citations(id))"
      )
      .eq("document_id", docId)
      .order("created_at", { ascending: true });
    questions = data ?? [];
  }

  const { data: requirements } = docId
    ? await supabase
        .from("extracted_requirements")
        .select("requirement_id, classification, topic, source_page, section")
        .eq("document_id", docId)
    : { data: [] as any[] };

  const reqMap = new Map(
    (requirements ?? []).map((r: any) => [r.requirement_id, r])
  );

  const { data: members } = await supabase
    .from("team_members")
    .select("user_id, name, email")
    .eq("org_id", member.org_id);

  return (
    <div className="q-page" style={{ padding: "20px 28px" }}>
      <QuestionsTable
        dealId={id}
        documents={(documents ?? []) as any[]}
        currentDocId={docId ?? null}
        questions={questions.map((qq) => ({
          ...qq,
          ...(reqMap.get(qq.requirement_id ?? "") ?? {}),
        }))}
        members={(members ?? []) as any[]}
        initial={{ status, topic, q }}
        currentUser={{
          id: user.id,
          name: (member as any).name ?? null,
          email: (member as any).email ?? user.email ?? "",
        }}
      />
    </div>
  );
}
