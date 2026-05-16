import Link from "next/link";
import { requireMembership } from "@/utils/auth";
import Topbar, { Crumb } from "@/components/Topbar";
import StatusBadge, { dealStatusLabels } from "@/components/StatusBadge";

export default async function DashboardPage() {
  const { supabase, member } = await requireMembership();
  const orgId = member.org_id;

  const [{ data: deals }, { count: docCount }, { count: pendingQs }] = await Promise.all([
    supabase
      .from("deals")
      .select("id, name, client_name, status, value, due_date, updated_at")
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(8),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .in(
        "deal_id",
        (await supabase.from("deals").select("id").eq("org_id", orgId)).data?.map((d) => d.id) ??
          []
      ),
    supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .in(
        "document_id",
        (
          await supabase
            .from("documents")
            .select("id")
            .in(
              "deal_id",
              (await supabase.from("deals").select("id").eq("org_id", orgId)).data?.map(
                (d) => d.id
              ) ?? []
            )
        ).data?.map((d) => d.id) ?? []
      ),
  ]);

  const openDeals = deals?.filter((d) => d.status === "open" || d.status === "in_progress").length ?? 0;
  const won = deals?.filter((d) => d.status === "won").length ?? 0;

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
      <div className="p-7 max-w-[1200px]">
        <h1 className="text-[20px] font-semibold mb-1" style={{ color: "var(--fg)" }}>
          {member.organizations?.name}
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--fg-4)" }}>
          Your pipeline at a glance.
        </p>

        <div className="grid grid-cols-4 gap-4 mb-7">
          <Stat label="Active deals" value={openDeals} />
          <Stat label="Won" value={won} tone="ok" />
          <Stat label="Documents" value={docCount ?? 0} />
          <Stat label="Pending questions" value={pendingQs ?? 0} tone="warn" />
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: "var(--divider)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Recent deals</h2>
            <Link href="/deals" className="text-xs" style={{ color: "var(--accent)" }}>
              View all
            </Link>
          </div>
          {!deals || deals.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm" style={{ color: "var(--fg-4)" }}>
              No deals yet.{" "}
              <Link href="/deals/new" style={{ color: "var(--accent)" }}>
                Create your first deal
              </Link>
              .
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ color: "var(--fg-4)" }}>
                  <th className="text-left font-medium px-5 py-2.5">Deal</th>
                  <th className="text-left font-medium px-5 py-2.5">Client</th>
                  <th className="text-left font-medium px-5 py-2.5">Status</th>
                  <th className="text-right font-medium px-5 py-2.5">Value</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <tr key={d.id} className="border-t" style={{ borderColor: "var(--divider)" }}>
                    <td className="px-5 py-3">
                      <Link href={`/deals/${d.id}`} className="font-medium" style={{ color: "var(--fg)" }}>
                        {d.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3" style={{ color: "var(--fg-3)" }}>{d.client_name ?? "—"}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={d.status} label={dealStatusLabels[d.status]} />
                    </td>
                    <td className="px-5 py-3 text-right num" style={{ color: "var(--fg-2)" }}>
                      {d.value ? `$${Number(d.value).toLocaleString()}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn" | "err";
}) {
  const color =
    tone === "ok" ? "var(--ok)" : tone === "warn" ? "var(--warn)" : tone === "err" ? "var(--err)" : "var(--fg)";
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
