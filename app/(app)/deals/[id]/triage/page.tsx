import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMembership } from "@/utils/auth";
import Topbar, { Crumb } from "@/components/Topbar";
import StatusBadge from "@/components/StatusBadge";
import TriageActions from "./TriageActions";
import AddQuestion from "./AddQuestion";

export default async function TriagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ doc?: string }>;
}) {
  const { id: dealId } = await params;
  const { doc: docIdParam } = await searchParams;
  const { supabase, member } = await requireMembership();

  const { data: deal } = await supabase
    .from("deals")
    .select("id, name")
    .eq("id", dealId)
    .eq("org_id", member.org_id)
    .maybeSingle();
  if (!deal) notFound();

  let docId = docIdParam;
  if (!docId) {
    const { data: latest } = await supabase
      .from("documents")
      .select("id")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    docId = latest?.id;
  }

  if (!docId) {
    return (
      <>
        <Topbar
          crumbs={
            <>
              <Crumb><Link href={`/deals/${dealId}`} style={{ color: "var(--fg-4)" }}>{deal.name}</Link></Crumb>
              <Crumb last>Triage</Crumb>
            </>
          }
        />
        <div className="p-7">
          <div className="card p-10 text-center text-sm" style={{ color: "var(--fg-4)" }}>
            No document uploaded yet.{" "}
            <Link href={`/deals/${dealId}`} style={{ color: "var(--accent)" }}>
              Upload an RFP →
            </Link>
          </div>
        </div>
      </>
    );
  }

  const [{ data: doc }, { data: requirements }, { data: matrix }, { data: agentRuns }] =
    await Promise.all([
      supabase.from("documents").select("*").eq("id", docId).single(),
      supabase
        .from("extracted_requirements")
        .select("*")
        .eq("document_id", docId)
        .order("created_at", { ascending: true }),
      supabase.from("compliance_matrix").select("*").eq("document_id", docId),
      supabase
        .from("agent_runs")
        .select("agent_type, status, input_tokens, output_tokens, cost, error_message, completed_at")
        .eq("document_id", docId)
        .order("completed_at", { ascending: true }),
    ]);

  if (!doc) notFound();
  const matrixByReq = new Map((matrix ?? []).map((m) => [m.requirement_id, m]));

  return (
    <>
      <Topbar
        crumbs={
          <>
            <Crumb><Link href={`/deals/${dealId}`} style={{ color: "var(--fg-4)" }}>{deal.name}</Link></Crumb>
            <Crumb last>Triage — {doc.filename}</Crumb>
          </>
        }
        actions={
          <>
            <StatusBadge status={doc.processing_status} />
            <TriageActions documentId={docId} dealId={dealId} status={doc.processing_status} />
          </>
        }
      />
      <div className="p-7 space-y-6 max-w-[1400px]">
        {doc.error_message && (
          <div className="card p-4" style={{ borderColor: "var(--err-tint)", background: "var(--err-tint)" }}>
            <div className="text-sm font-semibold mb-1" style={{ color: "var(--err)" }}>Pipeline error</div>
            <div className="text-xs" style={{ color: "var(--err)" }}>{doc.error_message}</div>
          </div>
        )}

        <section>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--fg)" }}>Agent pipeline</h2>
          <div className="card overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr style={{ color: "var(--fg-4)" }}>
                  <th className="text-left font-medium px-5 py-2.5">Agent</th>
                  <th className="text-left font-medium px-5 py-2.5">Status</th>
                  <th className="text-right font-medium px-5 py-2.5">Tokens</th>
                  <th className="text-right font-medium px-5 py-2.5">Cost</th>
                  <th className="text-left font-medium px-5 py-2.5">Completed</th>
                </tr>
              </thead>
              <tbody>
                {(agentRuns ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center" style={{ color: "var(--fg-4)" }}>
                      No agent runs yet.
                    </td>
                  </tr>
                ) : (
                  (agentRuns ?? []).map((r, i) => (
                    <tr key={i} className="border-t" style={{ borderColor: "var(--divider)" }}>
                      <td className="px-5 py-2.5 capitalize">{r.agent_type}</td>
                      <td className="px-5 py-2.5"><StatusBadge status={r.status} /></td>
                      <td className="px-5 py-2.5 text-right num">
                        {r.input_tokens != null
                          ? `${(r.input_tokens + (r.output_tokens ?? 0)).toLocaleString()}`
                          : "—"}
                      </td>
                      <td className="px-5 py-2.5 text-right num">
                        {r.cost != null ? `$${Number(r.cost).toFixed(4)}` : "—"}
                      </td>
                      <td className="px-5 py-2.5" style={{ color: "var(--fg-4)" }}>
                        {r.completed_at ? new Date(r.completed_at).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
              Extracted requirements ({requirements?.length ?? 0})
            </h2>
            <div className="flex items-center gap-2">
              <AddQuestion documentId={docId} />
              <Link href={`/deals/${dealId}/sme?doc=${docId}`} className="btn">
                SME workspace →
              </Link>
            </div>
          </div>
          {!requirements || requirements.length === 0 ? (
            <div className="card p-8 text-center text-sm" style={{ color: "var(--fg-4)" }}>
              {doc.processing_status === "uploaded" || doc.processing_status === "extracting"
                ? "Processing… come back in a minute."
                : "No requirements extracted yet."}
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ color: "var(--fg-4)" }}>
                    <th className="text-left font-medium px-5 py-2.5">ID</th>
                    <th className="text-left font-medium px-5 py-2.5">Requirement</th>
                    <th className="text-left font-medium px-5 py-2.5">Category</th>
                    <th className="text-left font-medium px-5 py-2.5">Priority</th>
                    <th className="text-left font-medium px-5 py-2.5">Mandatory</th>
                    <th className="text-left font-medium px-5 py-2.5">Compliance</th>
                  </tr>
                </thead>
                <tbody>
                  {requirements.map((r) => (
                    <tr key={r.id} className="border-t align-top" style={{ borderColor: "var(--divider)" }}>
                      <td className="px-5 py-3 mono text-[11.5px]" style={{ color: "var(--fg-4)" }}>
                        {r.requirement_id ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <div className="font-medium" style={{ color: "var(--fg)" }}>{r.title}</div>
                        {r.description && (
                          <div className="text-[12.5px] mt-0.5 line-clamp-2" style={{ color: "var(--fg-4)" }}>
                            {r.description}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3" style={{ color: "var(--fg-3)" }}>{r.category ?? "—"}</td>
                      <td className="px-5 py-3"><StatusBadge status={r.priority} /></td>
                      <td className="px-5 py-3">
                        {r.is_mandatory ? (
                          <span className="badge badge-warn">Mandatory</span>
                        ) : (
                          <span style={{ color: "var(--fg-4)" }}>—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={matrixByReq.get(r.requirement_id ?? "")?.compliance_status ?? "pending"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
