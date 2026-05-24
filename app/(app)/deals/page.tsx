import Link from "next/link";
import { requireMembership } from "@/utils/auth";
import Topbar, { Crumb } from "@/components/Topbar";
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

  // Per-deal completion: count approved questions vs total via two RPC-like joins.
  const dealIds = (deals ?? []).map((d) => d.id);
  let totals: Record<string, { total: number; approved: number }> = {};
  if (dealIds.length > 0) {
    const { data: docRows } = await supabase
      .from("documents")
      .select("id, deal_id")
      .in("deal_id", dealIds);
    const docByDeal = new Map<string, string[]>();
    for (const r of docRows ?? []) {
      const arr = docByDeal.get(r.deal_id) ?? [];
      arr.push(r.id);
      docByDeal.set(r.deal_id, arr);
    }
    const allDocIds = (docRows ?? []).map((r) => r.id);
    if (allDocIds.length > 0) {
      const { data: qs } = await supabase
        .from("questions")
        .select("document_id, status")
        .in("document_id", allDocIds);
      const totalsByDoc = new Map<string, { total: number; approved: number }>();
      for (const q of qs ?? []) {
        const e = totalsByDoc.get(q.document_id) ?? { total: 0, approved: 0 };
        e.total += 1;
        if (q.status === "approved") e.approved += 1;
        totalsByDoc.set(q.document_id, e);
      }
      for (const [dealId, docIds] of docByDeal) {
        const agg = { total: 0, approved: 0 };
        for (const d of docIds) {
          const t = totalsByDoc.get(d);
          if (t) {
            agg.total += t.total;
            agg.approved += t.approved;
          }
        }
        totals[dealId] = agg;
      }
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
            <Link
              href="/deals?view=board"
              className="btn"
              style={
                v === "board"
                  ? { background: "var(--accent-tint)", color: "var(--accent-2)", borderColor: "var(--accent-line)" }
                  : undefined
              }
            >
              Board
            </Link>
            <Link
              href="/deals?view=table"
              className="btn"
              style={
                v === "table"
                  ? { background: "var(--accent-tint)", color: "var(--accent-2)", borderColor: "var(--accent-line)" }
                  : undefined
              }
            >
              Table
            </Link>
            <Link href="/deals/new" className="btn btn-primary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New deal
            </Link>
          </div>
        }
      />
      <div className={v === "board" ? "p-7" : "p-7 max-w-[1200px]"}>
        <DealsBoard view={v} deals={(deals ?? []) as any[]} totals={totals} />
      </div>
    </>
  );
}
