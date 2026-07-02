import Link from "next/link";
import { requireMembership } from "@/utils/auth";
import Topbar, { Crumb } from "@/components/Topbar";
import OnboardingChecklist from "@/components/OnboardingChecklist";

export default async function DashboardPage() {
  const { supabase, member } = await requireMembership();
  const orgId = member.org_id;

  // One parallel batch for every query that only needs orgId. Sequential
  // awaits here are pure waterfall: each one is a network round-trip to
  // Supabase, so they add up fast.
  const [
    { data: deals },
    { data: kdocs },
    { data: activity },
    { data: orgRow },
    { count: teamCount },
  ] = await Promise.all([
    supabase
      .from("deals")
      .select("id, name, client_name, status, value, due_date, updated_at, is_sample, created_at")
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("knowledge_documents")
      .select("id, ingestion_status, is_sample")
      .eq("org_id", orgId),
    supabase
      .from("activity_log")
      .select("action, entity_type, metadata, created_at, user_id")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("organizations")
      .select("onboarding_dismissed")
      .eq("id", orgId)
      .maybeSingle(),
    supabase
      .from("team_members")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId),
  ]);

  const allDeals = deals ?? [];
  const dealIds = allDeals.map((d) => d.id);
  const realDeals = allDeals.filter((d) => !d.is_sample);
  const realDealIdSet = new Set(realDeals.map((d) => d.id));

  let questionTotals = { total: 0, approved: 0, inReview: 0, unanswered: 0 };
  let dealCompletion = new Map<string, { total: number; approved: number }>();
  let mandatoryUnanswered = 0;
  let docsFailed = 0;
  let realRfpCount = 0;

  if (dealIds.length > 0) {
    const [{ data: docRows }, { count: failedDocCount }] = await Promise.all([
      supabase
        .from("documents")
        .select("id, deal_id, is_sample")
        .in("deal_id", dealIds),
      supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .in("deal_id", dealIds)
        .eq("processing_status", "failed"),
    ]);
    docsFailed = failedDocCount ?? 0;
    realRfpCount = (docRows ?? []).filter(
      (r) => realDealIdSet.has(r.deal_id) && !r.is_sample
    ).length;

    const docByDeal = new Map<string, string[]>();
    for (const r of docRows ?? []) {
      const arr = docByDeal.get(r.deal_id) ?? [];
      arr.push(r.id);
      docByDeal.set(r.deal_id, arr);
    }
    const allDocIds = (docRows ?? []).map((r) => r.id);

    if (allDocIds.length > 0) {
      const [{ data: qs }, { data: reqRows }] = await Promise.all([
        supabase
          .from("questions")
          .select("document_id, status, requirement_id")
          .in("document_id", allDocIds),
        supabase
          .from("extracted_requirements")
          .select("requirement_id, is_mandatory")
          .eq("is_mandatory", true)
          .in("document_id", allDocIds),
      ]);
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
      // Mandatory items with no approved answer
      const mustAnsweredIds = new Set(
        (qs ?? [])
          .filter((q: any) => q.status === "approved")
          .map((q: any) => q.requirement_id)
      );
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
  const kbFailed = (kdocs ?? []).filter((k) => k.ingestion_status === "failed").length;
  const failedCount = kbFailed + docsFailed;

  const inbox = [
    questionTotals.inReview > 0 && {
      icon: "review",
      label:
        questionTotals.inReview === 1
          ? "1 question awaiting approval"
          : `${questionTotals.inReview} questions awaiting approval`,
      href: "/deals",
      tone: "warn" as const,
    },
    dueSoon.length + overdue.length > 0 && {
      icon: "clock",
      label:
        overdue.length > 0
          ? `${overdue.length} overdue, ${dueSoon.length} due this week`
          : dueSoon.length === 1
          ? "1 deal due this week"
          : `${dueSoon.length} deals due this week`,
      href: "/deals",
      tone: (overdue.length > 0 ? "err" : "warn") as "err" | "warn",
    },
    failedCount > 0 && {
      icon: "alert",
      label:
        failedCount === 1
          ? "1 document failed processing"
          : `${failedCount} documents failed processing`,
      href: kbFailed > 0 ? "/knowledge" : "/deals",
      tone: "err" as const,
    },
  ].filter(Boolean) as Array<{ icon: "review" | "clock" | "alert"; label: string; href: string; tone: "warn" | "err" }>;

  const isEmpty = allDeals.length === 0;

  // ─── Onboarding checklist state ────────────────────────────────────────
  // Steps complete only when the user has REAL (non-sample) data. All of it
  // is derived from rows already fetched above — no extra queries.
  const onboardingDismissed = orgRow?.onboarding_dismissed ?? false;
  const realKbCount = (kdocs ?? []).filter((k) => !k.is_sample).length;
  const realDealCount = realDeals.length;

  // Pick a target deal for the "Upload RFP" step deep-link: the user's
  // first real deal if any, else the seeded sample, else the deals index.
  let rfpDealLink = "/deals";
  if (realDeals.length > 0) {
    const firstReal = [...realDeals].sort((a, b) =>
      (a.created_at ?? "").localeCompare(b.created_at ?? "")
    )[0];
    rfpDealLink = `/deals/${firstReal.id}/documents`;
  } else {
    const sample = allDeals.find((d) => d.is_sample);
    if (sample) rfpDealLink = `/deals/${sample.id}/documents`;
  }

  const onboardingSteps = [
    {
      key: "kb",
      label: "Upload knowledge documents",
      desc: "Past proposals, security docs, and policies. These power your AI drafts.",
      href: "/knowledge",
      done: (realKbCount ?? 0) > 0,
    },
    {
      key: "deal",
      label: "Create your first deal",
      desc: "Set up the workspace for a specific RFP, with client and due date.",
      href: "/deals/new",
      done: (realDealCount ?? 0) > 0,
    },
    {
      key: "rfp",
      label: "Upload an RFP to your deal",
      desc: "Propello extracts questions and drafts answers from your knowledge base.",
      href: rfpDealLink,
      done: realRfpCount > 0,
    },
    {
      key: "team",
      label: "Invite teammates",
      desc: "Bring in SMEs and reviewers. They get assigned questions and approval rights.",
      href: "/team",
      done: (teamCount ?? 0) > 1,
    },
  ];

  const onboardingComplete = onboardingSteps.every((s) => s.done);
  const showOnboarding = !onboardingDismissed && !onboardingComplete;

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
      {!isEmpty && !showOnboarding && (
        <div className="band" role="list" aria-label="Pipeline summary">
          <div className="band-cell" role="listitem">
            <span className="band-label">Active deals</span>
            <div className="band-reading">
              <span className="band-n">{activeDeals.length}</span>
              <span className="band-delta">{questionTotals.total} questions</span>
            </div>
          </div>
          <div className="band-cell" role="listitem">
            <span className="band-label">Awaiting approval</span>
            <div className="band-reading">
              <span className={`band-n${questionTotals.inReview > 0 ? " warn" : ""}`}>{questionTotals.inReview}</span>
              <span className="band-delta">in review</span>
            </div>
          </div>
          <div className="band-cell" role="listitem">
            <span className="band-label">Due this week</span>
            <div className="band-reading">
              <span className={`band-n${dueSoon.length > 0 ? " warn" : ""}`}>{dueSoon.length}</span>
              <span className="band-delta">next 7 days</span>
            </div>
          </div>
          <div className="band-cell" role="listitem">
            <span className="band-label">Overdue</span>
            <div className="band-reading">
              <span className={`band-n${overdue.length > 0 ? " err" : ""}`}>{overdue.length}</span>
              <span className="band-delta">past due date</span>
            </div>
          </div>
          <div className="band-cell" role="listitem">
            <span className="band-label">Mandatory unanswered</span>
            <div className="band-reading">
              <span className={`band-n${mandatoryUnanswered > 0 ? " err" : ""}`}>{mandatoryUnanswered}</span>
              <span className="band-delta">must-have items</span>
            </div>
          </div>
        </div>
      )}

      <div className="p-7 pt-0 max-w-[1300px] space-y-6">
        <div className="page-header">
          <div className="page-title-row">
            <h1 className="page-title">{member.organizations?.name}</h1>
            <span className="page-meta">{activeDeals.length} active · {questionTotals.total} questions</span>
          </div>
          <p className="page-sub">RFP operations at a glance.</p>
        </div>

        {showOnboarding && (
          <OnboardingChecklist steps={onboardingSteps} total={onboardingSteps.length} />
        )}

        {isEmpty ? (
          !showOnboarding && <OnboardingCard kbReady={kbReady} />
        ) : (
          <>
            {inbox.length > 0 && (
              <section className="section-card">
                <div className="section-card-head">
                  <div>
                    <span className="section-card-title">Requires action</span>
                    <span className="section-card-count">{inbox.length}</span>
                  </div>
                  <Link href="/my-queue" className="block-more">My queue →</Link>
                </div>
                <ul className="queue">
                  {inbox.map((item, i) => (
                    <Link key={i} href={item.href} className="queue-row">
                      <span className={`queue-sig ${item.tone}`} aria-hidden="true" />
                      <span className="queue-say">{item.label}</span>
                      <span className="queue-ref">{QUEUE_REF[item.icon]}</span>
                      <span className="queue-act">{QUEUE_ACT[item.icon]}</span>
                    </Link>
                  ))}
                </ul>
              </section>
            )}

            <div className="grid grid-cols-3 gap-6">
              <section className="section-card col-span-2">
                <div className="section-card-head">
                  <div>
                    <span className="section-card-title">Active deals</span>
                    <span className="section-card-count">{activeDeals.length}</span>
                  </div>
                  <Link href="/deals" className="block-more">View all →</Link>
                </div>
                {activeDeals.length === 0 ? (
                  <div className="p-8 text-center text-sm" style={{ color: "var(--fg-4)" }}>
                    No active deals right now.
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Deal</th>
                        <th>Stage</th>
                        <th>Completion</th>
                        <th style={{ textAlign: "right" }}>Due</th>
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
                        const stageClass =
                          d.status === "in_progress" ? "draft" : d.status === "new" ? "" : "review";
                        const stageLabel =
                          d.status === "in_progress" ? "Drafting" : d.status === "new" ? "Triage" : "Review";
                        return (
                          <tr key={d.id}>
                            <td>
                              <Link href={`/deals/${d.id}`} style={{ color: "var(--fg)", fontWeight: 550, textDecoration: "none" }}>
                                {d.name}
                              </Link>
                              {d.client_name && (
                                <div className="meta-mono" style={{ marginTop: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                  {d.client_name}
                                </div>
                              )}
                            </td>
                            <td><span className={`stage ${stageClass}`}>{stageLabel}</span></td>
                            <td style={{ minWidth: 140 }}>
                              {t.total > 0 ? (
                                <div className="meter">
                                  <span className="meter-track">
                                    <span className={`meter-fill${pct >= 100 ? " full" : ""}`} style={{ width: `${pct}%` }} />
                                  </span>
                                  <span className="meter-pct">{pct}%</span>
                                </div>
                              ) : (
                                <span className="meter-pct" style={{ color: "var(--fg-4)" }}>not started</span>
                              )}
                            </td>
                            <td
                              className="mono"
                              style={{
                                textAlign: "right",
                                fontSize: 10.5,
                                fontVariantNumeric: "tabular-nums",
                                color: overdueRow ? "var(--err)" : dueSoonRow ? "var(--warn)" : "var(--fg-4)",
                                fontWeight: overdueRow ? 600 : 400,
                              }}
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

              <section className="section-card">
                <div className="section-card-head">
                  <span className="section-card-title">Activity</span>
                  <Link href="/activity" className="block-more">View all →</Link>
                </div>
                {(activity ?? []).length === 0 ? (
                  <div className="p-6 text-center text-sm" style={{ color: "var(--fg-4)" }}>
                    No activity yet.
                  </div>
                ) : (
                  <ul className="feed">
                    {(activity ?? []).map((a, i) => (
                      <li key={i} className="feed-row">
                        <span className="feed-t">
                          {new Date(a.created_at).toISOString().replace("T", " ").slice(5, 16)}
                        </span>
                        <span className="feed-what">
                          <b>{a.action}</b> {a.entity_type}
                          {a.metadata?.filename ? `: ${a.metadata.filename}` : ""}
                          {a.metadata?.name ? `: ${a.metadata.name}` : ""}
                        </span>
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

const QUEUE_REF: Record<string, string> = {
  review: "IN REVIEW",
  clock: "DUE DATE",
  alert: "PIPELINE",
};
const QUEUE_ACT: Record<string, string> = {
  review: "Review",
  clock: "Open",
  alert: "Retry",
};

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

