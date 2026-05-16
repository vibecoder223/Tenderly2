import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMembership } from "@/utils/auth";
import Topbar, { Crumb } from "@/components/Topbar";
import SmeWorkspace from "./SmeWorkspace";

export default async function SmePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ doc?: string; q?: string }>;
}) {
  const { id: dealId } = await params;
  const { doc: docParam, q: qParam } = await searchParams;
  const { supabase, member, user } = await requireMembership();

  const { data: deal } = await supabase
    .from("deals")
    .select("id, name")
    .eq("id", dealId)
    .eq("org_id", member.org_id)
    .maybeSingle();
  if (!deal) notFound();

  let docId = docParam;
  if (!docId) {
    const { data: latest } = await supabase
      .from("documents")
      .select("id")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    docId = latest?.id;
  }
  if (!docId) notFound();

  const { data: questions } = await supabase
    .from("questions")
    .select("id, requirement_id, question_text, status, priority, category, assigned_to, responses(id, draft_text, ai_generated_draft, final_text, status, tone)")
    .eq("document_id", docId)
    .order("created_at", { ascending: true });

  const { data: members } = await supabase
    .from("team_members")
    .select("user_id, name, email")
    .eq("org_id", member.org_id);

  return (
    <>
      <Topbar
        crumbs={
          <>
            <Crumb>
              <Link href={`/deals/${dealId}`} style={{ color: "var(--fg-4)" }}>{deal.name}</Link>
            </Crumb>
            <Crumb last>SME workspace</Crumb>
          </>
        }
        actions={
          <Link href={`/deals/${dealId}/review?doc=${docId}`} className="btn">
            Review →
          </Link>
        }
      />
      <SmeWorkspace
        questions={(questions ?? []) as any[]}
        members={(members ?? []) as any[]}
        currentUserId={user.id}
        focusQuestionId={qParam}
      />
    </>
  );
}
