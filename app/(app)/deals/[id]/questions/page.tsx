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

  // Stage 1 — everything that only needs the deal id, in parallel. The deal
  // check, document list, and member list are independent round-trips.
  const [{ data: deal }, { data: documents }, { data: members }] = await Promise.all([
    supabase
      .from("deals")
      .select("id")
      .eq("id", id)
      .eq("org_id", member.org_id)
      .maybeSingle(),
    supabase
      .from("documents")
      .select("id, filename")
      .eq("deal_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("team_members")
      .select("user_id, name, email")
      .eq("org_id", member.org_id),
  ]);
  if (!deal) notFound();

  // Latest document = first of the already-ordered list; no extra query.
  const docId = docParam ?? (documents ?? [])[0]?.id;

  // Stage 2 — questions + requirements for the selected doc, in parallel.
  const [{ data: questionsRaw }, { data: requirements }] = docId
    ? await Promise.all([
        supabase
          .from("questions")
          .select(
            "id, requirement_id, question_text, status, priority, category, assigned_to, due_date, last_activity_at, " +
              "responses(id, draft_text, final_text, status, confidence, gap_flag, citations(id))"
          )
          .eq("document_id", docId)
          .order("created_at", { ascending: true }),
        supabase
          .from("extracted_requirements")
          .select("requirement_id, classification, topic, source_page, section")
          .eq("document_id", docId),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }];

  const questions: any[] = questionsRaw ?? [];
  const reqMap = new Map(
    (requirements ?? []).map((r: any) => [r.requirement_id, r])
  );

  return (
    <div className="q-page" style={{ padding: "16px 0 0 0" }}>
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
