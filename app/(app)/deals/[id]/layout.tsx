import { notFound } from "next/navigation";
import { requireMembership } from "@/utils/auth";
import DealHeader from "@/components/DealHeader";
import DealTabs from "@/components/DealTabs";

export default async function DealLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, member } = await requireMembership();

  const { data: deal } = await supabase
    .from("deals")
    .select("id, name, client_name, status, value, due_date")
    .eq("id", id)
    .eq("org_id", member.org_id)
    .maybeSingle();
  if (!deal) notFound();

  // Latest document to compute completion + question count
  const { data: docs } = await supabase
    .from("documents")
    .select("id")
    .eq("deal_id", id)
    .order("created_at", { ascending: false });
  const docIds = (docs ?? []).map((d) => d.id);

  let totalQ = 0;
  let approvedQ = 0;
  let submittedQ = 0;
  if (docIds.length > 0) {
    const { count: t } = await supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .in("document_id", docIds);
    const { count: a } = await supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .in("document_id", docIds);
    const { count: s } = await supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .in("status", ["review"])
      .in("document_id", docIds);
    totalQ = t ?? 0;
    approvedQ = a ?? 0;
    submittedQ = s ?? 0;
  }

  return (
    <>
      <div className="sticky top-0 z-20">
        <DealHeader deal={deal} completion={{ approved: approvedQ, total: totalQ }} />
        <DealTabs dealId={deal.id} counts={{ questions: totalQ, approvals: submittedQ }} />
      </div>
      <div>{children}</div>
    </>
  );
}
