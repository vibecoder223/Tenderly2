import { requireMembership } from "@/utils/auth";
import Topbar, { Crumb } from "@/components/Topbar";
import { Page, PageHeader, Readings, SectionCard } from "@/components/ui";
import {
  TimeRangeFilter,
  TrendChart,
  WinLossChart,
  FunnelChart,
  DwellChart,
  type FunnelStep,
  type DwellBar,
  type WinLossPoint,
} from "./AnalyticsClient";

// A win rate off one or two deals isn't a rate, it's a coin flip. Below this
// many closed deals, the readings tile shows a plain count instead of a %
// that implies more confidence than the sample supports.
const MIN_CLOSED_FOR_RATE = 3;

/* ─── Types ─────────────────────────────────────────────────────────────── */

type DealRow = {
  id: string;
  name: string;
  status: string;
  value: number | null;
  created_at: string;
  due_date: string | null;
};

type ExportRow = { deal_id: string; created_at: string };
type QuestionRow = {
  id: string;
  document_id: string;
  status: string;
  assigned_to: string | null;
  last_activity_at: string | null;
  question_text: string;
  created_at: string;
  due_date: string | null;
};
type ResponseRow = {
  id: string;
  question_id: string;
  submitted_at: string | null;
  confidence: number | null;
  gap_flag: string | null;
};
type MemberRow = { user_id: string; name: string | null; email: string };
type AgentRunRow = { agent_type: string };

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function fmt$(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function fmtDays(d: number) {
  return d === 1 ? "1 day" : `${d.toFixed(1)}d`;
}

function parseDate(s: string | null | undefined) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/* ─── Server page ────────────────────────────────────────────────────────── */

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { supabase, member } = await requireMembership();
  const orgId = member.org_id;
  const sp = await searchParams;
  const fromDate = parseDate(sp.from);
  const toDate = parseDate(sp.to);

  /* ── Deals ─────────────────────────────────────────────────── */
  const { data: allDeals } = await supabase
    .from("deals")
    .select("id, name, status, value, created_at, due_date")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  const deals: DealRow[] = allDeals ?? [];

  const closedDeals = deals.filter((d) => d.status === "won" || d.status === "lost");
  const closedInRange = closedDeals.filter((d) => {
    if (!fromDate && !toDate) return true;
    const t = parseDate(d.created_at);
    if (!t) return false;
    if (fromDate && t < fromDate) return false;
    if (toDate && t > toDate) return false;
    return true;
  });

  const won = closedInRange.filter((d) => d.status === "won");
  const lost = closedInRange.filter((d) => d.status === "lost");
  const closedCount = won.length + lost.length;
  const winRateReady = closedCount >= MIN_CLOSED_FOR_RATE;
  const winRate = closedCount > 0 ? Math.round((won.length / closedCount) * 100) : null;
  const valueWon = won.reduce((s, d) => s + (Number(d.value) || 0), 0);

  const activeDeals = deals.filter((d) => d.status !== "won" && d.status !== "lost");
  const pipelineValue = activeDeals.reduce((s, d) => s + (Number(d.value) || 0), 0);

  /* ── Exports ────────────────────────────────────────────────── */
  const dealIds = deals.map((d) => d.id);
  const { data: exportsRaw } = dealIds.length
    ? await supabase.from("exports").select("deal_id, created_at").in("deal_id", dealIds)
    : { data: [] as ExportRow[] };
  const exports_: ExportRow[] = exportsRaw ?? [];

  const firstExport = new Map<string, Date>();
  for (const e of exports_) {
    const t = parseDate(e.created_at);
    if (!t) continue;
    const existing = firstExport.get(e.deal_id);
    if (!existing || t < existing) firstExport.set(e.deal_id, t);
  }

  const completionDays = closedInRange.flatMap((d) => {
    const start = parseDate(d.created_at);
    const end = firstExport.get(d.id);
    if (!start || !end) return [];
    const diff = (end.getTime() - start.getTime()) / 86400_000;
    return diff > 0 ? [diff] : [];
  });
  const avgCompletionDays = completionDays.length > 0
    ? completionDays.reduce((s, v) => s + v, 0) / completionDays.length
    : null;

  /* ── Documents + Questions ──────────────────────────────────── */
  const { data: docsRaw } = dealIds.length
    ? await supabase.from("documents").select("id, deal_id").in("deal_id", dealIds)
    : { data: [] as { id: string; deal_id: string }[] };
  const docs = docsRaw ?? [];
  const docIds = docs.map((d) => d.id);
  const docToDeal = new Map(docs.map((d) => [d.id, d.deal_id]));

  const { data: questionsRaw } = docIds.length
    ? await supabase
        .from("questions")
        .select("id, document_id, status, assigned_to, last_activity_at, question_text, created_at, due_date")
        .in("document_id", docIds)
    : { data: [] as QuestionRow[] };
  const questions: QuestionRow[] = questionsRaw ?? [];

  const dealsInRange = new Set(
    deals.filter((d) => {
      if (!fromDate && !toDate) return true;
      const t = parseDate(d.created_at);
      if (!t) return false;
      if (fromDate && t < fromDate) return false;
      if (toDate && t > toDate) return false;
      return true;
    }).map((d) => d.id)
  );
  const questionsInRange = questions.filter((q) => {
    const dealId = docToDeal.get(q.document_id);
    return dealId ? dealsInRange.has(dealId) : false;
  });

  /* ── Responses ──────────────────────────────────────────────── */
  const { data: responsesRaw } = docIds.length
    ? await supabase
        .from("responses")
        .select("id, question_id, submitted_at, confidence, gap_flag")
        .in("question_id", questions.map((q) => q.id))
    : { data: [] as ResponseRow[] };
  const responses: ResponseRow[] = responsesRaw ?? [];

  const respByQuestion = new Map<string, ResponseRow[]>();
  for (const r of responses) {
    const arr = respByQuestion.get(r.question_id) ?? [];
    arr.push(r);
    respByQuestion.set(r.question_id, arr);
  }

  /* ── AI Quality ─────────────────────────────────────────────── */
  const responsesInRange = responses.filter((r) => {
    const q = questions.find((q) => q.id === r.question_id);
    if (!q) return false;
    const dealId = docToDeal.get(q.document_id);
    return dealId ? dealsInRange.has(dealId) : false;
  });

  const confidenceVals = responsesInRange
    .map((r) => r.confidence)
    .filter((v): v is number => v !== null);
  const avgConfidence = confidenceVals.length > 0
    ? confidenceVals.reduce((s, v) => s + v, 0) / confidenceVals.length
    : null;

  const noSourceRate = responsesInRange.length > 0
    ? responsesInRange.filter((r) => r.gap_flag === "no_source").length / responsesInRange.length
    : null;

  const { data: agentRunsRaw } = docIds.length
    ? await supabase.from("agent_runs").select("agent_type").in("document_id", docIds)
    : { data: [] as AgentRunRow[] };
  const agentRuns: AgentRunRow[] = agentRunsRaw ?? [];
  const regenCount = agentRuns.filter((a) => a.agent_type === "regeneration").length;
  const regenRate = responsesInRange.length > 0 ? regenCount / responsesInRange.length : null;

  /* ── KPI sparklines (monthly win rate + cycle time) ─────────── */
  type MonthBucket = { won: number; lost: number; completionDays: number[] };
  const monthBuckets = new Map<string, MonthBucket>();

  for (const d of closedDeals) {
    const t = parseDate(d.created_at);
    if (!t) continue;
    const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
    const bucket = monthBuckets.get(key) ?? { won: 0, lost: 0, completionDays: [] };
    if (d.status === "won") bucket.won++;
    else bucket.lost++;
    const end = firstExport.get(d.id);
    if (end) {
      const diff = (end.getTime() - t.getTime()) / 86400_000;
      if (diff > 0) bucket.completionDays.push(diff);
    }
    monthBuckets.set(key, bucket);
  }

  const sortedMonths = Array.from(monthBuckets.keys()).sort();
  const winLossTrend: WinLossPoint[] = sortedMonths.map((month) => {
    const b = monthBuckets.get(month)!;
    return { month, won: b.won, lost: b.lost };
  });
  const completionTrend = sortedMonths.map((month) => {
    const b = monthBuckets.get(month)!;
    return {
      month,
      value: b.completionDays.length > 0
        ? parseFloat((b.completionDays.reduce((s, v) => s + v, 0) / b.completionDays.length).toFixed(1))
        : null,
    };
  });

  /* ── Funnel ─────────────────────────────────────────────────── */
  const fqTotal = questionsInRange.length;
  const fqDrafted = questionsInRange.filter((q) => ["drafting", "review", "approved"].includes(q.status)).length;
  const fqReviewed = questionsInRange.filter((q) => ["review", "approved"].includes(q.status)).length;
  const fqApproved = questionsInRange.filter((q) => q.status === "approved").length;

  const pct = (n: number, d: number) => d > 0 ? Math.round((n / d) * 100) : null;

  const funnelSteps: FunnelStep[] = [
    { label: "Extracted", count: fqTotal, pctOfPrev: null },
    { label: "Drafted", count: fqDrafted, pctOfPrev: pct(fqDrafted, fqTotal) },
    { label: "In review", count: fqReviewed, pctOfPrev: pct(fqReviewed, fqDrafted) },
    { label: "Approved", count: fqApproved, pctOfPrev: pct(fqApproved, fqReviewed) },
  ];

  // Dwell times: avg days from created_at to first response.submitted_at (draft stage)
  // avg days from first response to last_activity_at for approved questions (review stage)
  const draftDwellDays: number[] = [];
  const reviewDwellDays: number[] = [];

  for (const q of questionsInRange) {
    const created = parseDate(q.created_at);
    if (!created) continue;
    const rs = respByQuestion.get(q.id) ?? [];
    const submitted = rs.map((r) => parseDate(r.submitted_at)).filter(Boolean) as Date[];
    if (submitted.length > 0) {
      const earliest = submitted.reduce((a, b) => (a < b ? a : b));
      const dd = (earliest.getTime() - created.getTime()) / 86400_000;
      if (dd > 0 && dd < 365) draftDwellDays.push(dd);

      if (q.status === "approved" && q.last_activity_at) {
        const lastActivity = parseDate(q.last_activity_at);
        if (lastActivity) {
          const rd = (lastActivity.getTime() - earliest.getTime()) / 86400_000;
          if (rd > 0 && rd < 365) reviewDwellDays.push(rd);
        }
      }
    }
  }

  const avgDraft = draftDwellDays.length > 0
    ? parseFloat((draftDwellDays.reduce((s, v) => s + v, 0) / draftDwellDays.length).toFixed(1))
    : null;
  const avgReview = reviewDwellDays.length > 0
    ? parseFloat((reviewDwellDays.reduce((s, v) => s + v, 0) / reviewDwellDays.length).toFixed(1))
    : null;

  const dwellData: DwellBar[] = [
    ...(avgDraft != null ? [{ label: "Draft", days: avgDraft }] : []),
    ...(avgReview != null ? [{ label: "Review", days: avgReview }] : []),
  ];

  /* ── Team table ─────────────────────────────────────────────── */
  const { data: membersRaw } = await supabase
    .from("team_members")
    .select("user_id, name, email")
    .eq("org_id", orgId);
  const members: MemberRow[] = membersRaw ?? [];

  const teamRows = members.map((m) => {
    const assigned = questionsInRange.filter((q) => q.assigned_to === m.user_id);
    const completed = assigned.filter((q) => q.status === "approved");
    const responseTimes = assigned.flatMap((q) => {
      const rs = respByQuestion.get(q.id) ?? [];
      const submitted = rs.map((r) => parseDate(r.submitted_at)).filter(Boolean) as Date[];
      if (!submitted.length) return [];
      const earliest = submitted.reduce((a, b) => (a < b ? a : b));
      const created = parseDate(q.created_at);
      if (!created) return [];
      const diff = (earliest.getTime() - created.getTime()) / 3600_000;
      return diff > 0 ? [diff] : [];
    });
    const avgResponseHrs = responseTimes.length > 0
      ? responseTimes.reduce((s, v) => s + v, 0) / responseTimes.length
      : null;
    return { member: m, assigned: assigned.length, completed: completed.length, avgResponseHrs };
  }).filter((r) => r.assigned > 0);

  teamRows.sort((a, b) => b.assigned - a.assigned);

  /* ─── Render ────────────────────────────────────────────────── */

  return (
    <>
      <Topbar
        crumbs={
          <>
            <Crumb>Workspace</Crumb>
            <Crumb last>Analytics</Crumb>
          </>
        }
        actions={<TimeRangeFilter from={sp.from ?? null} to={sp.to ?? null} />}
      />

      <Page>
        <PageHeader title="Analytics" sub="Win rate, cycle time, and where bids stall." />

        <Readings
          items={[
            {
              label: "Win rate",
              value: closedCount === 0 ? "—" : winRateReady ? `${winRate}%` : `${closedCount} closed`,
              tone: winRateReady && winRate != null && winRate >= 60 ? "ok" : undefined,
            },
            { label: "Value won", value: fmt$(valueWon) },
            { label: "Pipeline value", value: fmt$(pipelineValue) },
            { label: "Avg cycle time", value: avgCompletionDays != null ? fmtDays(avgCompletionDays) : "—", tone: avgCompletionDays != null && avgCompletionDays > 14 ? "warn" : undefined },
          ]}
        />

        <Section title="Win and loss" subtitle="Deals closed over time">
          <WinLossChart data={winLossTrend} activeCount={activeDeals.length} />
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Section title="Response funnel" subtitle="Questions by stage, selected range">
            <FunnelChart steps={funnelSteps} />
          </Section>
          <Section title="Time per stage" subtitle="Avg days in draft vs review">
            <DwellChart dwellData={dwellData} />
          </Section>
        </div>

        {/* Team */}
        <Section title="Team" subtitle="Filtered by time range">
          {teamRows.length === 0 ? (
            <Empty>No activity in range</Empty>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ minWidth: 480 }}>
                <thead>
                  <tr>
                    {["Member", "Assigned", "Approved", "Rate", "Avg response"].map((h) => (
                      <th key={h} style={{ textAlign: h === "Member" ? "left" : "right" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teamRows.map((row) => {
                    const rate = row.assigned > 0 ? row.completed / row.assigned : 0;
                    return (
                      <tr key={row.member.user_id}>
                        <td style={{ color: "var(--fg)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {row.member.name ?? row.member.email}
                        </td>
                        <td style={{ textAlign: "right", color: "var(--fg-2)", fontVariantNumeric: "tabular-nums" }}>{row.assigned}</td>
                        <td style={{ textAlign: "right", color: "var(--fg-2)", fontVariantNumeric: "tabular-nums" }}>{row.completed}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: rate >= 0.8 ? "var(--ok)" : rate >= 0.5 ? "var(--warn)" : "var(--fg-2)" }}>
                          {row.assigned > 0 ? `${Math.round(rate * 100)}%` : "—"}
                        </td>
                        <td style={{ textAlign: "right", color: "var(--fg-3)", fontVariantNumeric: "tabular-nums" }}>
                          {row.avgResponseHrs != null
                            ? row.avgResponseHrs < 24
                              ? `${row.avgResponseHrs.toFixed(1)}h`
                              : `${(row.avgResponseHrs / 24).toFixed(1)}d`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {completionTrend.length > 0 && (
          <TrendChart
            data={completionTrend}
            label="Avg cycle time (days) by month"
            color="var(--accent)"
            unit="d"
          />
        )}

        {/* AI & knowledge health — secondary, collapsed by default. Klovered's
            trust signal, but this page leads with win/loss per the chosen
            emphasis, so it sits at the bottom rather than up top. */}
        <AiQualitySection
          avgConfidence={avgConfidence}
          noSourceRate={noSourceRate}
          regenRate={regenRate}
          responsesCount={responsesInRange.length}
        />

      </Page>
    </>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

// Thin wrapper over the canonical SectionCard so every analytics panel shares
// the exact card + head as the rest of the app; adds a padded body for charts.
function Section({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <SectionCard title={title} subtitle={subtitle} className={className}>
      <div style={{ padding: "16px 20px" }}>{children}</div>
    </SectionCard>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, color: "var(--fg-5)", padding: "8px 0" }}>{children}</div>;
}

function AiQualitySection({
  avgConfidence,
  noSourceRate,
  regenRate,
  responsesCount,
}: {
  avgConfidence: number | null;
  noSourceRate: number | null;
  regenRate: number | null;
  responsesCount: number;
}) {
  return (
    <details className="card" style={{ padding: "18px 20px", minWidth: 0 }}>
      <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", justifyContent: "space-between", userSelect: "none" }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>AI &amp; knowledge health</span>
          {avgConfidence != null && (
            <span style={{ fontSize: 12, color: "var(--fg-4)", marginLeft: 8 }}>
              avg {Math.round(avgConfidence * 100)}% confidence
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: "var(--fg-4)" }}>expand</span>
      </summary>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" style={{ marginTop: 16 }}>
        <StatBox
          label="Avg confidence"
          value={avgConfidence != null ? `${Math.round(avgConfidence * 100)}%` : "—"}
          tone={avgConfidence != null ? (avgConfidence >= 0.75 ? "ok" : avgConfidence < 0.5 ? "err" : undefined) : undefined}
        />
        <StatBox
          label="No-source rate"
          value={noSourceRate != null ? `${Math.round(noSourceRate * 100)}%` : "—"}
          tone={noSourceRate != null && noSourceRate > 0.2 ? "err" : undefined}
          sub={noSourceRate != null && noSourceRate > 0.2 ? "KB may need more content" : undefined}
        />
        <StatBox
          label="Regeneration rate"
          value={regenRate != null ? `${Math.round(regenRate * 100)}%` : "—"}
          sub={`across ${responsesCount} responses`}
        />
      </div>
    </details>
  );
}

function StatBox({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "ok" | "err";
}) {
  const color = tone === "ok" ? "var(--ok)" : tone === "err" ? "var(--err)" : "var(--fg)";
  return (
    <div style={{ padding: "12px 14px", background: "var(--bg-2, var(--elevated))", borderRadius: 8, border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--fg-4)", marginBottom: 5 }}>
        {label}
      </div>
      <div className="num" style={{ fontSize: 20, fontWeight: 600, color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--fg-4)", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}
