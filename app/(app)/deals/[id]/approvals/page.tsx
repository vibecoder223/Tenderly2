import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMembership } from "@/utils/auth";
import ReviewList from "../review/ReviewList";

export default async function ApprovalsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ doc?: string }>;
}) {
  const { id } = await params;
  const { doc: docParam } = await searchParams;
  const { supabase, member } = await requireMembership();

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
  if (!docId) {
    return (
      <div className="p-7 max-w-[1100px]">
        <div className="card p-10 text-center">
          <h3 className="text-base font-semibold mb-1" style={{ color: "var(--fg)" }}>
            Nothing to approve yet
          </h3>
          <p className="text-sm mb-4" style={{ color: "var(--fg-4)" }}>
            Upload an RFP and let the team draft responses first.
          </p>
          <Link href={`/deals/${id}/documents`} className="btn btn-primary">
            Go to documents
          </Link>
        </div>
      </div>
    );
  }

  const { data: items } = await supabase
    .from("questions")
    .select(
      "id, requirement_id, question_text, status, responses(id, draft_text, final_text, status, confidence, gap_flag, citations(id, document_filename, section_path, page, quote))"
    )
    .eq("document_id", docId)
    .in("status", ["submitted", "in_review", "approved", "in_progress"]);

  return (
    <div className="p-7 max-w-[1100px]">
      <ReviewList items={(items ?? []) as any[]} />
    </div>
  );
}
