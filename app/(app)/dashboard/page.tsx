import Link from "next/link";
import { requireMembership } from "@/utils/auth";
import Topbar, { Crumb } from "@/components/Topbar";
import StatusBadge from "@/components/StatusBadge";

export default async function DashboardPage() {
  const { supabase, member } = await requireMembership();
  const orgId = member.org_id;

  const [{ data: deals }, { data: kdocs }, { data: activity }] = await Promise.all([
    supabase
      .from("deals")
      .select("id, name, client_name, status, value, due_date, updated_at")
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("knowledge_documents")
      .select("id, ingestion_status")
      .eq("org_id", orgId),
    supabase
      .from("activity_log")
      .select("action, entity_type, metadata, created_at, user_id")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const allDeals = deals ?? [];
  const dealIds = allDeals.map((d) => d.id);

  let questionTotals = { total: 0, approved: 0, inReview: 0, unanswered: 0 };
  let dealCompletion = new Map<string, { total: number; approved: number }>();
  let mandatoryUnanswered = 0;

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
        .select("document_id, status, requirement_id")
        .in("document_id", allDocIds);
      const totalsByDoc = new Map<string, { total: number; approved: number }>();
      for (const q of qs ?? []) {
        questionTotals.total += 1;
        if (q.status === "approved") questionTotals.approved += 1;
        if (q.status === "review") questionTotals.inReview += 1;
        if (q.status === "todo") questionTotals.unanswered += 1;
        const e = totalsByDoc.get(q.document_id) ?? { total: 0, approved: 0 };
        e.total += 1;
        if (q.status === "approved") e.approved += 1;
        totalsByDoc.set(q.document_id, e);
      }
      for (const [dealId, dIds] of docByDeal) {
        const agg = { total: 0, approved: 0 };
        for (const d of dIds) {
          const t = totalsByDoc.get(d);
          if (t) {
            agg.total += t.total;
            agg.approved += t.approved;
          }
        }
        dealCompletion.set(dealId, agg);
      }
      // Unanswered mandatory items across the org
      const { count: mu } = await supabase
        .from("extracted_requirements")
        .select("id", { count: "exact", head: true })
        .eq("is_mandatory", true)
        .in("document_id", allDocIds);
      // We treat all mandatory items as potentially unanswered then subtract approvedQ where requirement matches:
      const mustAnsweredIds = new Set(
        (qs ?? [])
          .filter((q: any) => q.status === "approved")
          .map((q: any) => q.requirement_id)
      );
      const { data: reqRows } = await supabase
        .from("extracted_requirements")
        .select("requirement_id, is_mandatory")
        .eq("is_mandatory", true)
        .in("document_id", allDocIds);
      mandatoryUnanswered =
        (reqRows ?? []).filter((r: any) => !mustAnsweredIds.has(r.requirement_id)).length;
    }
  }

  const activeDeals = allDeals.filter((d) =>
    ["new", "in_progress"].includes(d.status)
  );
  const overdue = activeDeals.filter(
    (d) => d.due_date && new Date(d.due_date).getTime() < Date.now()
  );
  const dueSoon = activeDeals.filter(
    (d) =>
      d.due_date &&
      new Date(d.due_date).getTime() >= Date.now() &&
      (new Date(d.due_date).getTime() - Date.now()) / 86_400_000 < 7
  );
  const kbReady = (kdocs ?? []).filter((k) => k.ingestion_status === "ready").length;

  const isEmpty = allDeals.length === 0;

  return (
    <>
      <Topbar
        crumbs={
          <>
            <Crumb>Workspace</Crumb>
            <Crumb last>Dashboard</Crumb>
          </>
        }
        actions={
          <Link href="/deals/new" className="btn btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New deal
          </Link>
        }
      />
      <div className="p-7 max-w-[1300px] space-y-6">
        <div>
          <h1 className="text-[20px] font-semibold mb-1" style={{ color: "var(--fg)" }}>
            {member.organizations?.name}
          </h1>
          <p className="text-sm" style={{ color: "var(--fg-4)" }}>
            RFP operations at a glance.
          </p>
        </div>

        {isEmpty ? (
          <OnboardingCard kbReady={kbReady} />
        ) : (
          <>
            <div className="grid grid-cols-4 gap-4">
              <Tile label="Active deals" value={activeDeals.length} />
              <Tile label="Due this week" value={dueSoon.length} tone={dueSoon.length > 0 ? "warn" : undefined} />
              <Tile label="Overdue" value={overdue.length} tone={overdue.length > 0 ? "err" : undefined} />
              <Tile
                label="Unanswered mandatory"
                value={mandatoryUnanswered}
                tone={mandatoryUnanswered > 0 ? "err" : "ok"}
              />
            </div>

            <div className="grid grid-cols-3 gap-6">
              <section className="col-span-2 card overflow-hidden">
                <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: "var(--divider)" }}>
                  <h2 className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Active deals</h2>
                  <Link href="/deals" className="text-[12px]" style={{ color: "var(--accent)" }}>
                    View all
                  </Link>
                </div>
                {activeDeals.length === 0 ? (
                  <div className="p-8 text-center text-sm" style={{ color: "var(--fg-4)" }}>
                    No active deals right now.
                  </div>
                ) : (
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr style={{ color: "var(--fg-4)" }}>
                        <th className="text-left font-medium px-5 py-2.5">Deal</th>
                        <th className="text-left font-medium px-5 py-2.5">Status</th>
                        <th className="text-left font-medium px-5 py-2.5">Completion</th>
                        <th className="text-left font-medium px-5 py-2.5">Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeDeals.slice(0, 6).map((d) => {
                        const t = dealCompletion.get(d.id) ?? { total: 0, approved: 0 };
                        const pct = t.total > 0 ? Math.round((t.approved / t.total) * 100) : 0;
                        const due = d.due_date ? new Date(d.due_date).getTime() : 0;
                        const overdueRow = due > 0 && due < Date.now();
                        const dueSoonRow =
                          due > 0 && !overdueRow && (due - Date.now()) / 86_400_000 < 7;
                        return (
                          <tr key={d.id} className="border-t" style={{ borderColor: "var(--divider)" }}>
                            <td className="px-5 py-3">
                              <Link
                                href={`/deals/${d.id}`}
                                className="font-medium"
                                style={{ color: "var(--fg)" }}
                              >
                                {d.name}
                              </Link>
                              <div className="text-[11.5px]" style={{ color: "var(--fg-4)" }}>
                                {d.client_name ?? ""}
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <StatusBadge status={d.status} />
                            </td>
                            <td className="px-5 py-3" style={{ minWidth: 160 }}>
                              {t.total > 0 ? (
                                <div className="flex items-center gap-2">
                                  <div className="rounded-full" style={{ width: 80, height: 5, background: "var(--bg-2)" }}>
                                    <div
                                      style={{
                                        width: `${pct}%`,
                                        height: "100%",
                                        background: pct >= 100 ? "var(--ok)" : "var(--accent)",
                                        borderRadius: 999,
                                      }}
                                    />
                                  </div>
                                  <span className="num text-[12px]" style={{ color: "var(--fg-3)" }}>
                                    {pct}%
                                  </span>
                                </div>
                              ) : (
                                <span style={{ color: "var(--fg-5)" }}>Not started</span>
                              )}
                            </td>
                            <td
                              className="px-5 py-3"
                              style={{ color: overdueRow ? "var(--err)" : dueSoonRow ? "var(--warn)" : "var(--fg-3)" }}
                            >
                              {d.due_date ? d.due_date.slice(0, 10) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </section>

              <section className="card overflow-hidden">
                <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--divider)" }}>
                  <h2 className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Recent activity</h2>
                </div>
                {(activity ?? []).length === 0 ? (
                  <div className="p-6 text-center text-sm" style={{ color: "var(--fg-4)" }}>
                    No activity yet.
                  </div>
                ) : (
                  <ul>
                    {(activity ?? []).map((a, i) => (
                      <li
                        key={i}
                        className="px-5 py-3 border-t text-[12.5px]"
                        style={{ borderColor: "var(--divider)" }}
                      >
                        <div style={{ color: "var(--fg-2)" }}>
                          {a.action}{" "}
                          <span style={{ color: "var(--fg-4)" }}>{a.entity_type}</span>
                          {a.metadata?.filename ? `: ${a.metadata.filename}` : ""}
                          {a.metadata?.name ? `: ${a.metadata.name}` : ""}
                        </div>
                        <div className="text-[11px]" style={{ color: "var(--fg-5)" }}>
                          {new Date(a.created_at).toISOString().replace("T", " ").slice(0, 16)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn" | "err";
}) {
  const color =
    tone === "ok"
      ? "var(--ok)"
      : tone === "warn"
      ? "var(--warn)"
      : tone === "err"
      ? "var(--err)"
      : "var(--fg)";
  return (
    <div className="card p-4">
      <div className="text-[11.5px] uppercase tracking-wider font-semibold" style={{ color: "var(--fg-5)" }}>
        {label}
      </div>
      <div className="text-[28px] font-semibold num mt-1" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function OnboardingCard({ kbReady }: { kbReady: number }) {
  return (
    <div className="card p-7">
      <h2 className="text-base font-semibold mb-1" style={{ color: "var(--fg)" }}>
        Get started
      </h2>
      <p className="text-[13px] mb-5" style={{ color: "var(--fg-4)" }}>
        Two steps before your first deal works end-to-end.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <Step
          n={1}
          title="Build your knowledge base"
          desc="Upload past proposals, security docs and policies. The AI cites from these."
          cta="Open knowledge base"
          href="/knowledge"
          done={kbReady > 0}
        />
        <Step
          n={2}
          title="Create your first deal"
          desc="Each deal holds the RFP, extracted questions, drafts, and the final export."
          cta="Create deal"
          href="/deals/new"
        />
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  desc,
  cta,
  href,
  done,
}: {
  n: number;
  title: string;
  desc: string;
  cta: string;
  href: string;
  done?: boolean;
}) {
  return (
    <div
      className="p-4 rounded-md"
      style={{
        background: done ? "var(--ok-tint)" : "var(--bg-2)",
        border: done ? "1px solid var(--ok-line)" : "1px solid var(--border)",
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="w-6 h-6 rounded-full text-[12px] font-semibold flex items-center justify-center"
          style={{
            background: done ? "var(--ok)" : "var(--accent)",
            color: "white",
          }}
        >
          {done ? "✓" : n}
        </span>
        <h3 className="text-[13.5px] font-semibold" style={{ color: "var(--fg)" }}>{title}</h3>
      </div>
      <p className="text-[12.5px] mb-3" style={{ color: "var(--fg-4)" }}>{desc}</p>
      <Link href={href} className="btn">
        {cta}
      </Link>
    </div>
  );
}
