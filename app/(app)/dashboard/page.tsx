import Link from "next/link";
import { requireMembership } from "@/utils/auth";
import Topbar, { Crumb } from "@/components/Topbar";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import { Page, PageHeader, Readings } from "@/components/ui";

export default async function DashboardPage() {
  const { supabase, member, user } = await requireMembership();
  const orgId = member.org_id;

  // One parallel batch for every query that only needs orgId. Sequential
  // awaits here are pure waterfall: each one is a network round-trip to
  // Supabase, so they add up fast.
  const [
    { data: deals },
    { data: kdocs },
    { data: activity },
    { data: orgRow },
    { data: teamRows },
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
      .select("user_id, name, email")
      .eq("org_id", orgId),
  ]);

  const teamCount = (teamRows ?? []).length;
  const memberByUserId = new Map((teamRows ?? []).map((m) => [m.user_id, m]));

  const allDeals = deals ?? [];
  const dealIds = allDeals.map((d) => d.id);
  const realDeals = allDeals.filter((d) => !d.is_sample);
  const realDealIdSet = new Set(realDeals.map((d) => d.id));

  let questionTotals = { total: 0, approved: 0, inReview: 0, unanswered: 0 };
  let dealCompletion = new Map<string, { total: number; approved: number }>();
  let mandatoryUnanswered = 0;
  let docsFailed = 0;
  let realRfpCount = 0;
  let avgConfidence: number | null = null;
  let citationsCount = 0;

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
          .select("id, document_id, status, requirement_id")
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

      // Trust panel: average response confidence + citations attached, for
      // every question in this org. Depends on question ids from `qs` above,
      // so it can't join the parallel batch — one extra round trip.
      const questionIds = (qs ?? []).map((q: any) => q.id);
      if (questionIds.length > 0) {
        const { data: responseRows } = await supabase
          .from("responses")
          .select("id, confidence")
          .in("question_id", questionIds);
        const confidences = (responseRows ?? [])
          .map((r) => r.confidence)
          .filter((c): c is number => c != null);
        if (confidences.length > 0) {
          avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
        }
        const responseIds = (responseRows ?? []).map((r) => r.id);
        if (responseIds.length > 0) {
          const { count } = await supabase
            .from("citations")
            .select("id", { count: "exact", head: true })
            .in("response_id", responseIds);
          citationsCount = count ?? 0;
        }
      }
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
  const readyToSubmit = activeDeals.filter((d) => {
    const t = dealCompletion.get(d.id);
    return !!t && t.total > 0 && t.approved >= t.total;
  }).length;
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

  // Most urgent first, so the hero row (and its solid CTA) is the thing that
  // actually needs attention soonest, not just whatever pushed first.
  const SEVERITY: Record<string, number> = { err: 2, warn: 1 };
  const sortedInbox = [...inbox].sort((a, b) => SEVERITY[b.tone] - SEVERITY[a.tone]);

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
      done: teamCount > 1,
    },
  ];

  const onboardingComplete = onboardingSteps.every((s) => s.done);
  const showOnboarding = !onboardingDismissed && !onboardingComplete;

  // ─── Greeting ───────────────────────────────────────────────────────────
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const displayName = member.name ?? (user.user_metadata as { name?: string } | null)?.name ?? user.email ?? "";
  const firstName = displayName.split(" ")[0] || "there";

  const soonestDeal = [...activeDeals]
    .filter((d) => d.due_date)
    .sort((a, b) => new Date(a.due_date as string).getTime() - new Date(b.due_date as string).getTime())[0];
  let urgentFact: string | null = null;
  if (soonestDeal) {
    const daysLeft = Math.ceil((new Date(soonestDeal.due_date as string).getTime() - Date.now()) / 86_400_000);
    urgentFact =
      daysLeft < 0
        ? `${soonestDeal.name} is overdue.`
        : daysLeft === 0
        ? `${soonestDeal.name} is due today.`
        : daysLeft <= 7
        ? `${soonestDeal.name} is due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`
        : null;
  }

  // Sorted by deadline (soonest/overdue first, no due date last) — this list
  // doubles as the deals view, so it isn't just completion order.
  const dealsByDeadline = [...activeDeals]
    .sort((a, b) => {
      const at = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const bt = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      return at - bt;
    })
    .slice(0, 7);

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

      <Page>
        <PageHeader
          title={`${timeGreeting}, ${firstName}`}
          sub={
            <>
              {inbox.length > 0 && (
                <>
                  <b style={{ color: "var(--fg-2)", fontWeight: 600 }}>
                    {inbox.length} thing{inbox.length === 1 ? "" : "s"} need{inbox.length === 1 ? "s" : ""} you today.
                  </b>{" "}
                </>
              )}
              {urgentFact ?? (inbox.length === 0 ? "Nothing urgent right now." : "")}
            </>
          }
        />

        {showOnboarding && (
          <OnboardingChecklist steps={onboardingSteps} total={onboardingSteps.length} />
        )}

        {isEmpty ? (
          !showOnboarding && <OnboardingCard kbReady={kbReady} />
        ) : (
          !showOnboarding && (
            <>
              <Readings
                items={[
                  { label: "Active deals", value: activeDeals.length },
                  { label: "Awaiting your approval", value: questionTotals.inReview, tone: questionTotals.inReview > 0 ? "warn" : undefined },
                  { label: "Overdue", value: overdue.length, tone: overdue.length > 0 ? "err" : undefined },
                  { label: "Ready to submit", value: readyToSubmit, tone: readyToSubmit > 0 ? "ok" : undefined },
                ]}
              />

              {sortedInbox.length > 0 && (
                <section className="section-card">
                  <div className="section-card-head">
                    <div>
                      <span className="section-card-title">Needs you now</span>
                      <span className="section-card-count">{sortedInbox.length}</span>
                    </div>
                    <Link href="/my-queue" className="block-more">My queue →</Link>
                  </div>
                  <ul className="queue">
                    {sortedInbox.map((item, i) => (
                      <Link key={i} href={item.href} className="queue-row no-sig">
                        <span className="queue-say">{item.label}</span>
                        <span className={`stage ${item.tone}`}>{QUEUE_REF[item.icon]}</span>
                        <span className={i === 0 ? "queue-act-primary" : "queue-act"}>{QUEUE_ACT[item.icon]}</span>
                      </Link>
                    ))}
                  </ul>
                </section>
              )}

              <div className="grid grid-cols-3 gap-6">
                <section className="section-card col-span-2">
                  <div className="section-card-head">
                    <span className="section-card-title">Deals by deadline</span>
                    <Link href="/deals" className="block-more">View all deals →</Link>
                  </div>
                  {dealsByDeadline.length === 0 ? (
                    <div className="p-8 text-center text-sm" style={{ color: "var(--fg-4)" }}>
                      No active deals right now.
                    </div>
                  ) : (
                    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                      {dealsByDeadline.map((d) => {
                        const t = dealCompletion.get(d.id) ?? { total: 0, approved: 0 };
                        const pct = t.total > 0 ? Math.round((t.approved / t.total) * 100) : 0;
                        const dueTs = d.due_date ? new Date(d.due_date).getTime() : null;
                        const daysLeft = dueTs != null ? Math.ceil((dueTs - Date.now()) / 86_400_000) : null;
                        const isOverdue = daysLeft != null && daysLeft < 0;
                        const tone = daysLeft == null ? "" : isOverdue || daysLeft <= 3 ? "err" : daysLeft <= 7 ? "warn" : "";
                        const barPct =
                          daysLeft == null ? 100 : isOverdue ? 4 : Math.min(100, Math.max(4, Math.round((daysLeft / 30) * 100)));
                        const daysLabel =
                          daysLeft == null ? "No due date" : isOverdue ? `${Math.abs(daysLeft)}d over` : `${daysLeft}d left`;
                        const stageLabel = d.status === "in_progress" ? "drafting" : d.status === "new" ? "triage" : "review";
                        return (
                          <li key={d.id} className="rw-row">
                            <div className="rw-name">
                              <Link href={`/deals/${d.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                                {d.name}
                              </Link>
                              <div className="rw-client">
                                {d.client_name ? `${d.client_name} · ` : ""}
                                {stageLabel}{t.total > 0 ? ` · ${pct}%` : ""}
                              </div>
                            </div>
                            <div className="rw-bar">
                              <span className={`fill${tone ? " " + tone : ""}`} style={{ width: `${barPct}%` }} />
                            </div>
                            <div className="rw-when">
                              <div className={`rw-days${tone ? " " + tone : ""}`}>{daysLabel}</div>
                              {d.due_date && <div className="rw-date">{d.due_date.slice(0, 10)}</div>}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                <section className="section-card">
                  <div className="section-card-head">
                    <span className="section-card-title">This week's output</span>
                  </div>
                  <div className="trust-row">
                    <span className="trust-k">Answers drafted</span>
                    <span className="trust-v">{questionTotals.approved + questionTotals.inReview}</span>
                  </div>
                  <div className="trust-row">
                    <span className="trust-k">Average confidence</span>
                    <span className="trust-v">{avgConfidence != null ? avgConfidence.toFixed(2) : "—"}</span>
                  </div>
                  <div className="trust-row">
                    <span className="trust-k">Citations attached</span>
                    <span className="trust-v">{citationsCount}</span>
                  </div>
                  <div className="trust-row">
                    <span className="trust-k">Mandatory unanswered</span>
                    <span className="trust-v" style={{ color: mandatoryUnanswered > 0 ? "var(--err)" : "var(--fg)" }}>
                      {mandatoryUnanswered}
                    </span>
                  </div>

                  <div className="section-card-head section-card-head-divide">
                    <span className="section-card-title">Recent activity</span>
                    <Link href="/activity" className="block-more">View all →</Link>
                  </div>
                  {(activity ?? []).length === 0 ? (
                    <div className="p-6 text-center text-sm" style={{ color: "var(--fg-4)" }}>
                      No activity yet.
                    </div>
                  ) : (
                    <ul className="feed">
                      {(activity ?? []).map((a, i) => {
                        const actor = memberByUserId.get(a.user_id);
                        const actorName = actor?.name || actor?.email || "Someone";
                        return (
                          <li key={i} className="feed-row">
                            <span className="feed-avatar">{initials(actorName)}</span>
                            <span className="feed-body">
                              <span className="feed-what">
                                <b>{actorName}</b> {a.action} {a.entity_type}
                                {a.metadata?.filename ? `: ${a.metadata.filename}` : ""}
                                {a.metadata?.name ? `: ${a.metadata.name}` : ""}
                              </span>
                              <span className="feed-time">{formatRelativeTime(a.created_at)}</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </div>
            </>
          )
        )}
      </Page>
    </>
  );
}

const QUEUE_REF: Record<string, string> = {
  review: "In review",
  clock: "Due date",
  alert: "Pipeline",
};
const QUEUE_ACT: Record<string, string> = {
  review: "Review",
  clock: "Open",
  alert: "Retry",
};

function initials(nameOrEmail: string): string {
  const parts = nameOrEmail.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return nameOrEmail.slice(0, 2).toUpperCase();
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toISOString().slice(0, 10);
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
