import Link from "next/link";
import { requireMembership } from "@/utils/auth";
import Topbar, { Crumb } from "@/components/Topbar";
import StatusBadge from "@/components/StatusBadge";

export default async function MyQueuePage() {
  const { supabase, user } = await requireMembership();

  const { data: rows } = await supabase
    .from("questions")
    .select(
      "id, question_text, status, priority, due_date, document_id, documents!inner(deal_id, deals!inner(id, name, client_name))"
    )
    .eq("assigned_to", user.id)
    .not("status", "eq", "approved")
    .order("created_at", { ascending: false });

  type QRow = {
    id: string;
    question_text: string;
    status: string;
    priority: string;
    due_date: string | null;
    document_id: string;
    documents: { deal_id: string; deals: { id: string; name: string; client_name: string | null } };
  };

  const questions: QRow[] = (rows ?? []) as unknown as QRow[];

  const byDeal = new Map<string, { deal: { id: string; name: string; client_name: string | null }; qs: QRow[] }>();
  for (const q of questions) {
    const deal = q.documents?.deals;
    if (!deal) continue;
    if (!byDeal.has(deal.id)) byDeal.set(deal.id, { deal, qs: [] });
    byDeal.get(deal.id)!.qs.push(q);
  }

  const reviewFirst = (a: QRow, b: QRow) => {
    const order: Record<string, number> = { review: 0, drafting: 1, blocked: 2, todo: 3 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9);
  };

  return (
    <>
      <Topbar
        crumbs={
          <>
            <Crumb>Workspace</Crumb>
            <Crumb last>My queue</Crumb>
          </>
        }
      />
      <div className="p-7 max-w-[920px]">
        <div className="page-header">
          <div className="page-title-row">
            <h1 className="page-title">My queue</h1>
            {questions.length > 0 && (
              <span className="page-meta">
                {questions.length} {questions.length === 1 ? "item" : "items"} · {byDeal.size} {byDeal.size === 1 ? "deal" : "deals"}
              </span>
            )}
          </div>
          <p className="page-sub">Questions assigned to you that need drafting, review, or are blocked.</p>
        </div>

        {questions.length === 0 ? (
          <div className="section-card" style={{ padding: 48, textAlign: "center" }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "var(--accent-tint)",
              color: "var(--accent)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              marginBottom: 12,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h2 style={{ fontSize: 16, marginBottom: 4 }}>All caught up</h2>
            <p style={{ fontSize: 13, color: "var(--fg-4)" }}>No questions assigned to you need attention.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {Array.from(byDeal.values()).map(({ deal, qs }) => (
              <div key={deal.id} className="section-card">
                <div className="section-card-head">
                  <div>
                    <Link
                      href={`/deals/${deal.id}`}
                      className="section-card-title"
                      style={{ textDecoration: "none" }}
                    >
                      {deal.name}
                    </Link>
                    {deal.client_name && (
                      <span className="meta-mono" style={{ marginLeft: 8 }}>
                        {deal.client_name}
                      </span>
                    )}
                  </div>
                  <span className="meta-mono">
                    {qs.length} {qs.length === 1 ? "item" : "items"}
                  </span>
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {[...qs].sort(reviewFirst).map((q) => (
                    <li
                      key={q.id}
                      style={{
                        borderTop: "1px solid var(--divider)",
                        padding: "10px 16px",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Link
                          href={`/deals/${deal.id}/questions/${q.id}`}
                          className="line-clamp-2"
                          style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", textDecoration: "none", lineHeight: 1.4 }}
                        >
                          {q.question_text}
                        </Link>
                        {q.due_date && (
                          <div className="meta-mono" style={{ marginTop: 3 }}>
                            due {q.due_date.slice(0, 10)}
                          </div>
                        )}
                      </div>
                      <StatusBadge status={q.status} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
