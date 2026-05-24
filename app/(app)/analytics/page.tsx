import { requireMembership } from "@/utils/auth";
import Topbar, { Crumb } from "@/components/Topbar";
import { TimeRangeFilter, TrendChart, PipelineBar } from "./AnalyticsClient";

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

  // Filter closed deals by date range (use updated_at proxy = created_at)
  const closedDeals = deals.filter(
    (d) => d.status === "won" || d.status === "lost"
  );
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
  const winRate =
    won.length + lost.length > 0
      ? Math.round((won.length / (won.length + lost.length)) * 100)
      : null;

  const activeDeals = deals.filter(
    (d) => d.status !== "won" && d.status !== "lost"
  );
  const pipelineValue = activeDeals.reduce(
    (s, d) => s + (Number(d.value) || 0),
    0
  );

  /* ── Exports (for completion time) ─────────────────────────── */
  const dealIds = deals.map((d) => d.id);
  const { data: exportsRaw } = dealIds.length
    ? await supabase
        .from("exports")
        .select("deal_id, created_at")
        .in("deal_id", dealIds)
    : { data: [] as ExportRow[] };
  const exports_: ExportRow[] = exportsRaw ?? [];

  // First export per deal
  const firstExport = new Map<string, Date>();
  for (const e of exports_) {
    const t = parseDate(e.created_at);
    if (!t) continue;
    const existing = firstExport.get(e.deal_id);
    if (!existing || t < existing) firstExport.set(e.deal_id, t);
  }

  // Avg completion time for closed deals in range
  const completionDays = closedInRange.flatMap((d) => {
    const start = parseDate(d.created_at);
    const end = firstExport.get(d.id);
    if (!start || !end) return [];
    const diff = (end.getTime() - start.getTime()) / 86400_000;
    return diff > 0 ? [diff] : [];
  });
  const avgCompletionDays =
    completionDays.length > 0
      ? completionDays.reduce((s, v) => s + v, 0) / completionDays.length
      : null;

  /* ── Documents + Questions ──────────────────────────────────── */
  const { data: docsRaw } = dealIds.length
    ? await supabase
        .from("documents")
        .select("id, deal_id")
        .in("deal_id", dealIds)
    : { data: [] as { id: string; deal_id: string }[] };
  const docs = docsRaw ?? [];
  const docIds = docs.map((d) => d.id);
  const docToDeal = new Map(docs.map((d) => [d.id, d.deal_id]));

  const { data: questionsRaw } = docIds.length
    ? await supabase
        .from("questions")
        .select(
          "id, document_id, status, assigned_to, last_activity_at, question_text, created_at, due_date"
        )
        .in("document_id", docIds)
    : { data: [] as QuestionRow[] };
  const questions: QuestionRow[] = questionsRaw ?? [];

  // Questions approved % (range-filtered by deal created_at proxy)
  const dealsInRange = new Set(
    deals
      .filter((d) => {
        if (!fromDate && !toDate) return true;
        const t = parseDate(d.created_at);
        if (!t) return false;
        if (fromDate && t < fromDate) return false;
        if (toDate && t > toDate) return false;
        return true;
      })
      .map((d) => d.id)
  );
  const questionsInRange = questions.filter((q) => {
    const dealId = docToDeal.get(q.document_id);
    return dealId ? dealsInRange.has(dealId) : false;
  });
  const approvedInRange = questionsInRange.filter(
    (q) => q.status === "approved"
  );
  const approvedPct =
    questionsInRange.length > 0
      ? Math.round((approvedInRange.length / questionsInRange.length) * 100)
      : null;

  /* ── Pipeline status per active deal ───────────────────────── */
  const dealDocIds = new Map<string, string[]>();
  for (const doc of docs) {
    const arr = dealDocIds.get(doc.deal_id) ?? [];
    arr.push(doc.id);
    dealDocIds.set(doc.deal_id, arr);
  }

  const pipelineRows = activeDeals.map((deal) => {
    const dids = dealDocIds.get(deal.id) ?? [];
    const qs = questions.filter((q) => dids.includes(q.document_id));
    const counts = {
      unanswered: qs.filter((q) => q.status === "todo").length,
      drafting: qs.filter((q) => q.status === "drafting").length,
      review: qs.filter((q) => q.status === "review").length,
      approved: qs.filter((q) => q.status === "approved").length,
      total: qs.length,
    };
    return { deal, counts };
  });

  // Sort by completion % descending
  pipelineRows.sort((a, b) => {
    const pa =
      a.counts.total > 0 ? a.counts.approved / a.counts.total : 0;
    const pb =
      b.counts.total > 0 ? b.counts.approved / b.counts.total : 0;
    return pb - pa;
  });

  /* ── Bottlenecks (always live) ──────────────────────────────── */
  const now = new Date();
  const h48 = 48 * 3600_000;

  const stuckInReview = questions.filter((q) => {
    if (q.status !== "review") return false;
    const t = parseDate(q.last_activity_at);
    if (!t) return false;
    return now.getTime() - t.getTime() > h48;
  });

  const overdueDealIds = new Set(
    activeDeals
      .filter((d) => d.due_date && new Date(d.due_date) < now)
      .map((d) => d.id)
  );
  const overdueDeals = activeDeals
    .filter((d) => overdueDealIds.has(d.id))
    .map((d) => {
      const dids = dealDocIds.get(d.id) ?? [];
      const openCount = questions.filter(
        (q) =>
          dids.includes(q.document_id) && q.status !== "approved"
      ).length;
      return { deal: d, openCount };
    })
    .filter((r) => r.openCount > 0);

  /* ── Team table ─────────────────────────────────────────────── */
  const { data: membersRaw } = await supabase
    .from("team_members")
    .select("user_id, name, email")
    .eq("org_id", orgId);
  const members: MemberRow[] = membersRaw ?? [];

  const { data: responsesRaw } = docIds.length
    ? await supabase
        .from("responses")
        .select("id, question_id, submitted_at, confidence, gap_flag")
        .in(
          "question_id",
          questions.map((q) => q.id)
        )
    : { data: [] as ResponseRow[] };
  const responses: ResponseRow[] = responsesRaw ?? [];

  const respByQuestion = new Map<string, ResponseRow[]>();
  for (const r of responses) {
    const arr = respByQuestion.get(r.question_id) ?? [];
    arr.push(r);
    respByQuestion.set(r.question_id, arr);
  }

  const teamRows = members.map((m) => {
    const assigned = questionsInRange.filter(
      (q) => q.assigned_to === m.user_id
    );
    const completed = assigned.filter((q) => q.status === "approved");
    const responseTimes = assigned.flatMap((q) => {
      const rs = respByQuestion.get(q.id) ?? [];
      const submitted = rs
        .map((r) => parseDate(r.submitted_at))
        .filter(Boolean) as Date[];
      if (!submitted.length) return [];
      const earliest = submitted.reduce((a, b) => (a < b ? a : b));
      const created = parseDate(q.created_at);
      if (!created) return [];
      const diff = (earliest.getTime() - created.getTime()) / 3600_000;
      return diff > 0 ? [diff] : [];
    });
    const avgResponseHrs =
      responseTimes.length > 0
        ? responseTimes.reduce((s, v) => s + v, 0) / responseTimes.length
        : null;
    return { member: m, assigned: assigned.length, completed: completed.length, avgResponseHrs };
  }).filter((r) => r.assigned > 0);

  teamRows.sort((a, b) => b.assigned - a.assigned);

  /* ── AI Quality ──────────────────────────────────────────────── */
  const responsesInRange = responses.filter((r) => {
    const q = questions.find((q) => q.id === r.question_id);
    if (!q) return false;
    const dealId = docToDeal.get(q.document_id);
    return dealId ? dealsInRange.has(dealId) : false;
  });

  const confidenceVals = responsesInRange
    .map((r) => r.confidence)
    .filter((v): v is number => v !== null);
  const avgConfidence =
    confidenceVals.length > 0
      ? confidenceVals.reduce((s, v) => s + v, 0) / confidenceVals.length
      : null;

  const noSourceRate =
    responsesInRange.length > 0
      ? responsesInRange.filter((r) => r.gap_flag === "no_source").length /
        responsesInRange.length
      : null;

  const { data: agentRunsRaw } = docIds.length
    ? await supabase
        .from("agent_runs")
        .select("agent_type")
        .in("document_id", docIds)
    : { data: [] as AgentRunRow[] };
  const agentRuns: AgentRunRow[] = agentRunsRaw ?? [];
  const regenCount = agentRuns.filter(
    (a) => a.agent_type === "regeneration"
  ).length;
  const regenRate =
    responsesInRange.length > 0 ? regenCount / responsesInRange.length : null;

  /* ── Trends (win rate + completion time by month) ───────────── */
  type MonthBucket = {
    won: number;
    lost: number;
    completionDays: number[];
  };
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
  const winRateTrend = sortedMonths.map((month) => {
    const b = monthBuckets.get(month)!;
    const total = b.won + b.lost;
    return {
      month,
      value: total > 0 ? Math.round((b.won / total) * 100) : null,
    };
  });
  const completionTrend = sortedMonths.map((month) => {
    const b = monthBuckets.get(month)!;
    return {
      month,
      value:
        b.completionDays.length > 0
          ? parseFloat(
              (
                b.completionDays.reduce((s, v) => s + v, 0) /
                b.completionDays.length
              ).toFixed(1)
            )
          : null,
    };
  });

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

      <div style={{ padding: "28px 32px", maxWidth: 1200 }}>

        {/* 1. KPI Strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 28 }}>
          <KPI label="Win rate" value={winRate != null ? `${winRate}%` : "—"} />
          <KPI label="Avg completion" value={avgCompletionDays != null ? fmtDays(avgCompletionDays) : "—"} />
          <KPI label="Questions approved" value={approvedPct != null ? `${approvedPct}%` : "—"} />
          <KPI label="Active deals" value={activeDeals.length} />
          <KPI label="Pipeline value" value={fmt$(pipelineValue)} tone="ok" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>

          {/* 2. Pipeline Status */}
          <Section title="Pipeline status" subtitle="Active deals by question completion">
            {pipelineRows.length === 0 ? (
              <Empty>No active deals</Empty>
            ) : (
              pipelineRows.map(({ deal, counts }) => (
                <PipelineBar
                  key={deal.id}
                  name={deal.name}
                  dueDate={deal.due_date}
                  counts={counts}
                />
              ))
            )}
            <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
              {[
                { label: "Unanswered", color: "var(--fg-5)" },
                { label: "Drafting", color: "var(--accent)" },
                { label: "In review", color: "var(--warn)" },
                { label: "Approved", color: "var(--ok)" },
              ].map((s) => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--fg-4)" }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                  {s.label}
                </div>
              ))}
            </div>
          </Section>

          {/* 3. Bottlenecks */}
          <Section title="Bottlenecks" subtitle="Always live — ignores time filter">
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                Stuck in review &gt;48h
              </div>
              {stuckInReview.length === 0 ? (
                <Empty>None</Empty>
              ) : (
                stuckInReview.slice(0, 5).map((q) => {
                  const dealId = docToDeal.get(q.document_id);
                  const deal = deals.find((d) => d.id === dealId);
                  const member = members.find((m) => m.user_id === q.assigned_to);
                  const hrs = q.last_activity_at
                    ? Math.round(
                        (now.getTime() - new Date(q.last_activity_at).getTime()) / 3600_000
                      )
                    : null;
                  return (
                    <div key={q.id} style={{ padding: "7px 0", borderBottom: "1px solid var(--divider)" }}>
                      <div style={{ fontSize: 13, color: "var(--fg)", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {q.question_text}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--fg-4)", display: "flex", gap: 8 }}>
                        <span>{deal?.name ?? "—"}</span>
                        {member && <span>· {member.name ?? member.email}</span>}
                        {hrs != null && <span style={{ color: "var(--err)", marginLeft: "auto" }}>{hrs}h in review</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                Overdue deals
              </div>
              {overdueDeals.length === 0 ? (
                <Empty>None</Empty>
              ) : (
                overdueDeals.slice(0, 5).map(({ deal, openCount }) => (
                  <div key={deal.id} style={{ padding: "7px 0", borderBottom: "1px solid var(--divider)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, color: "var(--fg)" }}>{deal.name}</span>
                    <span style={{ fontSize: 12, color: "var(--err)" }}>{openCount} open</span>
                  </div>
                ))
              )}
            </div>
          </Section>
        </div>

        {/* 4. Team Table */}
        <Section title="Team" subtitle="Filtered by time range" style={{ marginBottom: 28 }}>
          {teamRows.length === 0 ? (
            <Empty>No activity in range</Empty>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--divider)" }}>
                  {["Member", "Assigned", "Completed", "Completion %", "Avg response"].map((h) => (
                    <th key={h} style={{ textAlign: h === "Member" ? "left" : "right", padding: "6px 12px 8px", fontSize: 11.5, fontWeight: 600, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamRows.map((row) => (
                  <tr key={row.member.user_id} style={{ borderBottom: "1px solid var(--divider)" }}>
                    <td style={{ padding: "9px 12px", color: "var(--fg)" }}>
                      {row.member.name ?? row.member.email}
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: "var(--fg-2)", fontVariantNumeric: "tabular-nums" }}>{row.assigned}</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: "var(--fg-2)", fontVariantNumeric: "tabular-nums" }}>{row.completed}</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: row.assigned > 0 && row.completed / row.assigned >= 0.8 ? "var(--ok)" : "var(--fg-2)", fontVariantNumeric: "tabular-nums" }}>
                      {row.assigned > 0 ? `${Math.round((row.completed / row.assigned) * 100)}%` : "—"}
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "right", color: "var(--fg-3)", fontVariantNumeric: "tabular-nums" }}>
                      {row.avgResponseHrs != null
                        ? row.avgResponseHrs < 24
                          ? `${row.avgResponseHrs.toFixed(1)}h`
                          : `${(row.avgResponseHrs / 24).toFixed(1)}d`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* 5. AI Quality */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>AI quality</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <KPI label="Avg confidence" value={avgConfidence != null ? `${Math.round(avgConfidence * 100)}%` : "—"} />
            <KPI label="No-source rate" value={noSourceRate != null ? `${Math.round(noSourceRate * 100)}%` : "—"} tone={noSourceRate != null && noSourceRate > 0.2 ? "err" : undefined} />
            <KPI label="Regeneration rate" value={regenRate != null ? `${Math.round(regenRate * 100)}%` : "—"} />
          </div>
        </div>

        {/* 6. Trends */}
        {(winRateTrend.length > 0 || completionTrend.length > 0) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <TrendChart
              data={winRateTrend}
              label="Win rate by month"
              color="var(--ok)"
              format={(v) => `${v}%`}
            />
            <TrendChart
              data={completionTrend}
              label="Avg completion time (days) by month"
              color="var(--accent)"
              format={(v) => `${v}d`}
            />
          </div>
        )}

      </div>
    </>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function KPI({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "ok" | "err";
}) {
  const color =
    tone === "ok"
      ? "var(--ok)"
      : tone === "err"
      ? "var(--err)"
      : "var(--fg)";
  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-4)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
        {label}
      </div>
      <div className="num" style={{ fontSize: 26, fontWeight: 600, color, lineHeight: 1.1 }}>
        {value}
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
  style,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className="card" style={{ padding: "18px 20px", ...style }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: 11.5, color: "var(--fg-4)", marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, color: "var(--fg-5)", padding: "8px 0" }}>{children}</div>
  );
}
