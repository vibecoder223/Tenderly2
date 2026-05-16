import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMembership } from "@/utils/auth";
import Topbar, { Crumb } from "@/components/Topbar";
import ReviewList from "./ReviewList";

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ doc?: string }>;
}) {
  const { id: dealId } = await params;
  const { doc: docParam } = await searchParams;
  const { supabase, member } = await requireMembership();

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

  const { data: items } = await supabase
    .from("questions")
    .select(
      "id, requirement_id, question_text, status, responses(id, draft_text, final_text, status)"
    )
    .eq("document_id", docId)
    .in("status", ["submitted", "approved"]);

  return (
    <>
      <Topbar
        crumbs={
          <>
            <Crumb><Link href={`/deals/${dealId}`} style={{ color: "var(--fg-4)" }}>{deal.name}</Link></Crumb>
            <Crumb last>Review</Crumb>
          </>
        }
        actions={
          <Link href={`/deals/${dealId}/export?doc=${docId}`} className="btn btn-primary">
            Export →
          </Link>
        }
      />
      <div className="p-7 max-w-[1000px]">
        <ReviewList items={(items ?? []) as any[]} />
      </div>
    </>
  );
}
