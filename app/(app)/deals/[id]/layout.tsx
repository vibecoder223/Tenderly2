import { notFound } from "next/navigation";
import { requireMembership } from "@/utils/auth";
import DealHeader from "@/components/DealHeader";
import DealTabs from "@/components/DealTabs";
import KnowledgeEmptyBanner from "@/components/KnowledgeEmptyBanner";

export default async function DealLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, member } = await requireMembership();

  // One parallel batch — this layout runs on EVERY deal subpage navigation,
  // so sequential awaits here tax every tab switch. Question counts come from
  // a single status-only select (joined through documents) instead of three
  // separate count round-trips.
  const [{ data: deal }, { data: qStatusRows }, { count: kbReady }] = await Promise.all([
    supabase
      .from("deals")
      .select("id, name, client_name, status, value, due_date")
      .eq("id", id)
      .eq("org_id", member.org_id)
      .maybeSingle(),
    supabase
      .from("questions")
      .select("status, documents!inner(deal_id)")
      .eq("documents.deal_id", id),
    // Detect empty knowledge base (org-scoped). Sample docs are excluded so
    // users still see the nudge to upload real source material.
    supabase
      .from("knowledge_documents")
      .select("id", { count: "exact", head: true })
      .eq("org_id", member.org_id)
      .eq("ingestion_status", "ready"),
  ]);
  if (!deal) notFound();

  const qStatuses = (qStatusRows ?? []) as { status: string }[];
  const totalQ = qStatuses.length;
  const approvedQ = qStatuses.filter((q) => q.status === "approved").length;
  const submittedQ = qStatuses.filter((q) => q.status === "review").length;
  const showKbBanner = (kbReady ?? 0) === 0;

  return (
    <>
      <div className="sticky top-0 z-20">
        <DealHeader deal={deal} completion={{ approved: approvedQ, total: totalQ }} />
        <DealTabs dealId={deal.id} counts={{ questions: totalQ, approvals: submittedQ }} />
      </div>
      {showKbBanner && <KnowledgeEmptyBanner />}
      <div>{children}</div>
    </>
  );
}
