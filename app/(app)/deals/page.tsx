import Link from "next/link";
import { requireMembership } from "@/utils/auth";
import Topbar, { Crumb } from "@/components/Topbar";
import { Page, PageHeader } from "@/components/ui";
import DealsBoard from "./DealsBoard";

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const { supabase, member } = await requireMembership();

  const { data: deals } = await supabase
    .from("deals")
    .select("id, name, client_name, status, value, due_date, owner_id, updated_at, is_sample")
    .eq("org_id", member.org_id)
    .order("updated_at", { ascending: false });

  // Per-deal completion: one query joining questions → documents(deal_id),
  // instead of the old two-hop waterfall (fetch all doc ids, then fetch
  // questions by doc id) — one round-trip fewer and no giant .in() list.
  const dealIds = (deals ?? []).map((d) => d.id);
  const totals: Record<string, { total: number; approved: number }> = {};
  if (dealIds.length > 0) {
    const { data: qs } = await supabase
      .from("questions")
      .select("status, documents!inner(deal_id)")
      .in("documents.deal_id", dealIds);
    for (const q of (qs ?? []) as unknown as { status: string; documents: { deal_id: string } }[]) {
      const dealId = q.documents?.deal_id;
      if (!dealId) continue;
      const e = totals[dealId] ?? { total: 0, approved: 0 };
      e.total += 1;
      if (q.status === "approved") e.approved += 1;
      totals[dealId] = e;
    }
  }

  const v = view === "table" ? "table" : "board";

  return (
    <>
      <Topbar
        crumbs={
          <>
            <Crumb>Workspace</Crumb>
            <Crumb last>Deals</Crumb>
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            {/* Shared .seg/.seg-btn control — matches the List/Board toggle
                on Templates so the app has one segmented-tab style, not two. */}
            <div className="seg">
              <Link href="/deals?view=table" className={`seg-btn${v === "table" ? " active" : ""}`} style={{ textDecoration: "none" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
                List
              </Link>
              <Link href="/deals?view=board" className={`seg-btn${v === "board" ? " active" : ""}`} style={{ textDecoration: "none" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="6" height="18" /><rect x="10" y="3" width="6" height="12" />
                  <rect x="17" y="3" width="4" height="8" />
                </svg>
                Board
              </Link>
            </div>
            <Link href="/deals/fields" className="btn" title="Configure custom deal fields">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
                <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
                <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
                <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
              </svg>
              Fields
            </Link>
            <Link href="/deals/new" className="btn btn-primary">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New deal
            </Link>
          </div>
        }
      />
      <Page>
        <PageHeader title="Deals" sub="Track every RFP from triage to submission." />
        <DealsBoard view={v} deals={(deals ?? []) as any[]} totals={totals} />
      </Page>
    </>
  );
}
