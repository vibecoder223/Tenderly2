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
      <div className="p-7 max-w-[900px]">
        {questions.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-[28px] mb-3">✓</div>
            <p className="text-sm font-medium" style={{ color: "var(--fg)" }}>All caught up</p>
            <p className="text-[13px] mt-1" style={{ color: "var(--fg-4)" }}>
              No questions assigned to you that need attention.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="text-[13px]" style={{ color: "var(--fg-4)" }}>
              {questions.length} question{questions.length !== 1 ? "s" : ""} need your attention
            </div>
            {Array.from(byDeal.values()).map(({ deal, qs }) => (
              <div key={deal.id} className="card overflow-hidden">
                <div
                  className="px-5 py-3 border-b flex items-center justify-between"
                  style={{ borderColor: "var(--divider)" }}
                >
                  <div>
                    <Link
                      href={`/deals/${deal.id}`}
                      className="text-sm font-semibold"
                      style={{ color: "var(--fg)" }}
                    >
                      {deal.name}
                    </Link>
                    {deal.client_name && (
                      <span className="text-[12px] ml-2" style={{ color: "var(--fg-4)" }}>
                        {deal.client_name}
                      </span>
                    )}
                  </div>
                  <span className="text-[12px]" style={{ color: "var(--fg-4)" }}>
                    {qs.length} item{qs.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <ul>
                  {[...qs].sort(reviewFirst).map((q) => (
                    <li
                      key={q.id}
                      className="border-t px-5 py-3 flex items-start gap-3"
                      style={{ borderColor: "var(--divider)" }}
                    >
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/deals/${deal.id}/questions/${q.id}`}
                          className="text-[13px] font-medium line-clamp-2"
                          style={{ color: "var(--fg)" }}
                        >
                          {q.question_text}
                        </Link>
                        {q.due_date && (
                          <div className="text-[11.5px] mt-0.5" style={{ color: "var(--fg-5)" }}>
                            Due {q.due_date.slice(0, 10)}
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
