import Link from "next/link";
import { requireMembership } from "@/utils/auth";
import Topbar, { Crumb } from "@/components/Topbar";
import StatusBadge, { dealStatusLabels } from "@/components/StatusBadge";

export default async function DealsPage() {
  const { supabase, member } = await requireMembership();
  const { data: deals } = await supabase
    .from("deals")
    .select("id, name, client_name, status, value, due_date, created_at")
    .eq("org_id", member.org_id)
    .order("created_at", { ascending: false });

  return (
    <>
      <Topbar
        crumbs={
          <>
            <Crumb>Workspace</Crumb>
            <Crumb last>Deals</Crumb>
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
      <div className="p-7">
        <div className="card overflow-hidden">
          {!deals || deals.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <h3 className="text-base font-semibold mb-1" style={{ color: "var(--fg)" }}>No deals yet</h3>
              <p className="text-sm mb-5" style={{ color: "var(--fg-4)" }}>
                Create a deal to start processing an RFP.
              </p>
              <Link href="/deals/new" className="btn btn-primary inline-flex">
                Create your first deal
              </Link>
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ color: "var(--fg-4)" }}>
                  <th className="text-left font-medium px-5 py-2.5">Deal</th>
                  <th className="text-left font-medium px-5 py-2.5">Client</th>
                  <th className="text-left font-medium px-5 py-2.5">Status</th>
                  <th className="text-left font-medium px-5 py-2.5">Due</th>
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
                    <td className="px-5 py-3" style={{ color: "var(--fg-3)" }}>
                      {d.due_date ? new Date(d.due_date).toLocaleDateString() : "—"}
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
