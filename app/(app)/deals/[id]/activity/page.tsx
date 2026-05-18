import { notFound } from "next/navigation";
import { requireMembership } from "@/utils/auth";

export default async function DealActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, member } = await requireMembership();

  const { data: deal } = await supabase
    .from("deals")
    .select("id")
    .eq("id", id)
    .eq("org_id", member.org_id)
    .maybeSingle();
  if (!deal) notFound();

  const { data: docs } = await supabase
    .from("documents")
    .select("id")
    .eq("deal_id", id);
  const docIds = (docs ?? []).map((d) => d.id);

  const [{ data: acts }, { data: agentRuns }] = await Promise.all([
    supabase
      .from("activity_log")
      .select("action, entity_type, entity_id, metadata, created_at, user_id")
      .eq("org_id", member.org_id)
      .order("created_at", { ascending: false })
      .limit(40),
    docIds.length
      ? supabase
          .from("agent_runs")
          .select(
            "agent_type, status, input_tokens, output_tokens, cost, error_message, completed_at"
          )
          .in("document_id", docIds)
          .order("completed_at", { ascending: false })
          .limit(40)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  return (
    <div className="p-7 max-w-[1200px] grid grid-cols-2 gap-6">
      <section className="card overflow-hidden">
        <div
          className="px-5 py-3.5 border-b"
          style={{ borderColor: "var(--divider)" }}
        >
          <h2 className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
            Workspace activity
          </h2>
        </div>
        {(acts ?? []).length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: "var(--fg-4)" }}>
            No activity yet.
          </div>
        ) : (
          <ul>
            {(acts ?? []).map((a, i) => (
              <li
                key={i}
                className="px-5 py-3 border-t text-[13px]"
                style={{ borderColor: "var(--divider)" }}
              >
                <div style={{ color: "var(--fg-2)" }}>
                  {a.action}{" "}
                  <span className="mono" style={{ color: "var(--fg-4)" }}>
                    {a.entity_type}
                  </span>
                  {a.metadata?.filename ? `: ${a.metadata.filename}` : ""}
                  {a.metadata?.name ? `: ${a.metadata.name}` : ""}
                </div>
                <div className="text-[11.5px]" style={{ color: "var(--fg-5)" }}>
                  {new Date(a.created_at).toISOString().replace("T", " ").slice(0, 16)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card overflow-hidden">
        <div
          className="px-5 py-3.5 border-b"
          style={{ borderColor: "var(--divider)" }}
        >
          <h2 className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
            AI pipeline runs
          </h2>
        </div>
        {(agentRuns ?? []).length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: "var(--fg-4)" }}>
            No pipeline runs yet.
          </div>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr style={{ color: "var(--fg-4)" }}>
                <th className="text-left font-medium px-5 py-2.5">Agent</th>
                <th className="text-left font-medium px-5 py-2.5">Status</th>
                <th className="text-right font-medium px-5 py-2.5">Tokens</th>
                <th className="text-right font-medium px-5 py-2.5">Cost</th>
              </tr>
            </thead>
            <tbody>
              {(agentRuns ?? []).map((r, i) => (
                <tr
                  key={i}
                  className="border-t"
                  style={{ borderColor: "var(--divider)" }}
                >
                  <td className="px-5 py-2.5 capitalize">{r.agent_type}</td>
                  <td className="px-5 py-2.5">
                    <span
                      className={`badge ${
                        r.status === "completed"
                          ? "badge-ok"
                          : r.status === "failed"
                          ? "badge-err"
                          : ""
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-right num">
                    {r.input_tokens != null
                      ? (
                          r.input_tokens + (r.output_tokens ?? 0)
                        ).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-5 py-2.5 text-right num">
                    {r.cost != null ? `$${Number(r.cost).toFixed(4)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
