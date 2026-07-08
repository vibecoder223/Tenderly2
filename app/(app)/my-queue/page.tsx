import Link from "next/link";
import { requireMembership } from "@/utils/auth";
import Topbar, { Crumb } from "@/components/Topbar";
import { Page, PageHeader, Readings } from "@/components/ui";
import StatusBadge from "@/components/StatusBadge";

const ACTION: Record<string, string> = {
  todo: "Draft",
  drafting: "Continue",
  review: "Review",
  blocked: "Resolve",
};

// Urgency order across the whole queue — blocked work is a hard stop, so it
// outranks everything, including items already in review.
const URGENCY: Record<string, number> = { blocked: 0, review: 1, drafting: 2, todo: 3 };
const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

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

  const byUrgency = (a: QRow, b: QRow) => {
    const u = (URGENCY[a.status] ?? 9) - (URGENCY[b.status] ?? 9);
    if (u !== 0) return u;
    const p = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
    if (p !== 0) return p;
    const at = a.due_date ? new Date(a.due_date).getTime() : Infinity;
    const bt = b.due_date ? new Date(b.due_date).getTime() : Infinity;
    return at - bt;
  };

  // Groups with the most urgent work bubble to the top, so the deal you need
  // to open first is the first thing on the page.
  const groups = Array.from(byDeal.values())
    .map((g) => ({ ...g, qs: [...g.qs].sort(byUrgency) }))
    .sort((a, b) => byUrgency(a.qs[0], b.qs[0]));

  const counts = { blocked: 0, review: 0, drafting: 0, todo: 0 };
  for (const q of questions) {
    if (q.status in counts) counts[q.status as keyof typeof counts]++;
  }

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
      <Page>
        <PageHeader
          title="My queue"
          sub="Questions assigned to you that need drafting, review, or are blocked."
        />

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
          <>
            <Readings
              items={[
                { label: "Blocked", value: counts.blocked, tone: counts.blocked > 0 ? "err" : undefined },
                { label: "In review", value: counts.review, tone: counts.review > 0 ? "warn" : undefined },
                { label: "Drafting", value: counts.drafting },
                { label: "To do", value: counts.todo },
              ]}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {groups.map(({ deal, qs }) => (
                <section key={deal.id} className="section-card">
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
                        <span className="section-card-count">{deal.client_name}</span>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: "var(--fg-4)" }}>
                      {qs.length} {qs.length === 1 ? "item" : "items"}
                    </span>
                  </div>
                  <ul className="queue">
                    {qs.map((q) => {
                      const daysLeft = q.due_date
                        ? Math.ceil((new Date(q.due_date).getTime() - Date.now()) / 86_400_000)
                        : null;
                      const dueTone = daysLeft == null ? "" : daysLeft < 0 ? "err" : daysLeft <= 3 ? "warn" : "";
                      return (
                        <Link key={q.id} href={`/deals/${deal.id}/questions/${q.id}`} className="queue-row no-sig">
                          <span className="queue-say">
                            <span style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                              {q.priority === "high" && (
                                <span
                                  title="High priority"
                                  style={{
                                    width: 6, height: 6, borderRadius: "50%",
                                    background: "var(--fg-3)", flexShrink: 0, marginTop: 6,
                                  }}
                                />
                              )}
                              <span className="block line-clamp-2">{q.question_text}</span>
                            </span>
                            {q.due_date && (
                              <small style={dueTone ? { color: `var(--${dueTone})`, fontWeight: 500 } : undefined}>
                                {daysLeft != null && daysLeft < 0
                                  ? `${Math.abs(daysLeft)}d overdue`
                                  : `due ${q.due_date.slice(0, 10)}`}
                              </small>
                            )}
                          </span>
                          <StatusBadge status={q.status} />
                          <span className="queue-act">{ACTION[q.status] ?? "Open"}</span>
                        </Link>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
      </Page>
    </>
  );
}
