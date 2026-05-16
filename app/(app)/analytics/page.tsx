import { requireMembership } from "@/utils/auth";
import Topbar, { Crumb } from "@/components/Topbar";

export default async function AnalyticsPage() {
  const { supabase, member } = await requireMembership();
  const orgId = member.org_id;

  const dealIdsRes = await supabase.from("deals").select("id, status, value").eq("org_id", orgId);
  const deals = dealIdsRes.data ?? [];
  const won = deals.filter((d) => d.status === "won");
  const lost = deals.filter((d) => d.status === "lost");
  const totalValue = deals.reduce((s, d) => s + (Number(d.value) || 0), 0);
  const wonValue = won.reduce((s, d) => s + (Number(d.value) || 0), 0);

  const dealIds = deals.map((d) => d.id);
  const docsRes = dealIds.length
    ? await supabase.from("documents").select("id").in("deal_id", dealIds)
    : { data: [] as { id: string }[] };
  const docIds = docsRes.data?.map((d) => d.id) ?? [];

  const [qTotalRes, qApprovedRes, agentRes] = await Promise.all([
    docIds.length
      ? supabase.from("questions").select("id", { count: "exact", head: true }).in("document_id", docIds)
      : Promise.resolve({ count: 0 } as { count: number }),
    docIds.length
      ? supabase
          .from("questions")
          .select("id", { count: "exact", head: true })
          .eq("status", "approved")
          .in("document_id", docIds)
      : Promise.resolve({ count: 0 } as { count: number }),
    docIds.length
      ? supabase
          .from("agent_runs")
          .select("input_tokens, output_tokens, cost")
          .in("document_id", docIds)
      : Promise.resolve({ data: [] as { input_tokens: number | null; output_tokens: number | null; cost: number | null }[] }),
  ]);

  const qTotal = (qTotalRes as { count: number | null }).count ?? 0;
  const qApproved = (qApprovedRes as { count: number | null }).count ?? 0;
  const agentRows = (agentRes as { data: { input_tokens: number | null; output_tokens: number | null; cost: number | null }[] }).data ?? [];

  const tokens = agentRows.reduce(
    (acc, r) => ({
      in: acc.in + (r.input_tokens ?? 0),
      out: acc.out + (r.output_tokens ?? 0),
      cost: acc.cost + (Number(r.cost) || 0),
    }),
    { in: 0, out: 0, cost: 0 }
  );

  const winRate = won.length + lost.length > 0 ? Math.round((won.length / (won.length + lost.length)) * 100) : null;

  return (
    <>
      <Topbar
        crumbs={
          <>
            <Crumb>Workspace</Crumb>
            <Crumb last>Analytics</Crumb>
          </>
        }
      />
      <div className="p-7 max-w-[1200px]">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Stat label="Pipeline value" value={`$${totalValue.toLocaleString()}`} />
          <Stat label="Won value" value={`$${wonValue.toLocaleString()}`} tone="ok" />
          <Stat label="Win rate" value={winRate == null ? "—" : `${winRate}%`} />
          <Stat label="Questions approved" value={`${qApproved} / ${qTotal}`} />
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--fg)" }}>AI usage</h2>
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Input tokens" value={tokens.in.toLocaleString()} />
            <Stat label="Output tokens" value={tokens.out.toLocaleString()} />
            <Stat label="Estimated cost" value={`$${tokens.cost.toFixed(4)}`} tone="accent" />
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "ok" | "accent" }) {
  const color = tone === "ok" ? "var(--ok)" : tone === "accent" ? "var(--accent)" : "var(--fg)";
  return (
    <div className="card p-4">
      <div className="text-[11.5px] uppercase tracking-wider font-semibold" style={{ color: "var(--fg-5)" }}>
        {label}
      </div>
      <div className="text-[24px] font-semibold num mt-1" style={{ color }}>{value}</div>
    </div>
  );
}
