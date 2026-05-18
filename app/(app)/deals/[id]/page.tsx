import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMembership } from "@/utils/auth";
import StatusBadge from "@/components/StatusBadge";

export default async function DealOverview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, member } = await requireMembership();

  const { data: deal } = await supabase
    .from("deals")
    .select("*")
    .eq("id", id)
    .eq("org_id", member.org_id)
    .maybeSingle();
  if (!deal) notFound();

  const { data: docs } = await supabase
    .from("documents")
    .select("id, filename, processing_status, created_at")
    .eq("deal_id", id)
    .order("created_at", { ascending: false });

  const docIds = (docs ?? []).map((d) => d.id);

  const [reqs, qStatus, mandatory, recentActs] = await Promise.all([
    docIds.length
      ? supabase
          .from("extracted_requirements")
          .select("id, classification, topic, is_mandatory", { count: "exact" })
          .in("document_id", docIds)
      : Promise.resolve({ data: [] as any[], count: 0 } as any),
    docIds.length
      ? supabase
          .from("questions")
          .select("status")
          .in("document_id", docIds)
      : Promise.resolve({ data: [] as any[] } as any),
    docIds.length
      ? supabase
          .from("extracted_requirements")
          .select("id", { count: "exact", head: true })
          .eq("is_mandatory", true)
          .in("document_id", docIds)
      : Promise.resolve({ count: 0 } as any),
    supabase
      .from("activity_log")
      .select("action, entity_type, metadata, created_at")
      .eq("org_id", member.org_id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const qList: { status: string }[] = (qStatus as any).data ?? [];
  const total = qList.length;
  const byStatus = qList.reduce<Record<string, number>>((m, q) => {
    m[q.status] = (m[q.status] ?? 0) + 1;
    return m;
  }, {});
  const approved = byStatus["approved"] ?? 0;
  const drafting = (byStatus["ai_drafted"] ?? 0) + (byStatus["in_progress"] ?? 0) + (byStatus["assigned"] ?? 0);
  const inReview = (byStatus["in_review"] ?? 0) + (byStatus["submitted"] ?? 0);
  const unanswered = (byStatus["unanswered"] ?? 0) + (byStatus["pending"] ?? 0);
  const completionPct = total > 0 ? Math.round((approved / total) * 100) : 0;

  const mandatoryCount = (mandatory as any).count ?? 0;
  const reqList: any[] = (reqs as any).data ?? [];
  const topicCounts = reqList.reduce<Record<string, number>>((m, r) => {
    const k = r.topic ?? "uncategorized";
    m[k] = (m[k] ?? 0) + 1;
    return m;
  }, {});

  return (
    <div className="p-7 max-w-[1300px] space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <Tile label="Questions" value={total} sub={total === 0 ? "Upload an RFP" : undefined} />
        <Tile label="Approved" value={approved} tone="ok" sub={`${completionPct}% complete`} />
        <Tile label="In review" value={inReview} tone="warn" />
        <Tile label="Mandatory items" value={mandatoryCount} tone={mandatoryCount > 0 ? "accent" : undefined} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <section className="col-span-2 space-y-6">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Pipeline</h2>
              {total > 0 && (
                <Link
                  href={`/deals/${id}/questions`}
                  className="text-[12px]"
                  style={{ color: "var(--accent)" }}
                >
                  Manage questions →
                </Link>
              )}
            </div>
            {total === 0 ? (
              <EmptyPipeline dealId={id} hasDocuments={(docs ?? []).length > 0} />
            ) : (
              <PipelineBar
                stages={[
                  { key: "unanswered", label: "Unanswered", count: unanswered, color: "var(--fg-5)" },
                  { key: "drafting", label: "Drafting", count: drafting, color: "var(--accent)" },
                  { key: "in_review", label: "In review", count: inReview, color: "var(--warn)" },
                  { key: "approved", label: "Approved", count: approved, color: "var(--ok)" },
                ]}
              />
            )}
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--fg)" }}>Documents</h2>
            {(docs ?? []).length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[13px] mb-3" style={{ color: "var(--fg-4)" }}>
                  No RFP documents yet for this deal.
                </p>
                <Link href={`/deals/${id}/documents`} className="btn btn-primary">
                  Upload RFP
                </Link>
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ color: "var(--fg-4)" }}>
                    <th className="text-left font-medium py-2">File</th>
                    <th className="text-left font-medium py-2">Status</th>
                    <th className="text-left font-medium py-2">Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {(docs ?? []).slice(0, 5).map((d) => (
                    <tr key={d.id} className="border-t" style={{ borderColor: "var(--divider)" }}>
                      <td className="py-2 font-medium" style={{ color: "var(--fg)" }}>{d.filename}</td>
                      <td className="py-2"><StatusBadge status={d.processing_status} /></td>
                      <td className="py-2" style={{ color: "var(--fg-4)" }}>
                        {new Date(d.created_at).toISOString().slice(0, 10)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="card p-5">
            <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--fg)" }}>By topic</h2>
            {Object.keys(topicCounts).length === 0 ? (
              <div className="text-[12.5px]" style={{ color: "var(--fg-4)" }}>
                Topics will appear once requirements are extracted.
              </div>
            ) : (
              <ul className="space-y-2">
                {Object.entries(topicCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <li key={k} className="flex items-center gap-2 text-[12.5px]">
                      <span style={{ color: "var(--fg-3)", textTransform: "capitalize" }}>{k.replace(/_/g, " ")}</span>
                      <div
                        className="flex-1 ml-2 rounded-full"
                        style={{ height: 4, background: "var(--bg-2)" }}
                      >
                        <div
                          style={{
                            width: `${Math.round((v / reqList.length) * 100)}%`,
                            height: "100%",
                            background: "var(--accent)",
                            borderRadius: 999,
                          }}
                        />
                      </div>
                      <span className="num" style={{ color: "var(--fg-4)" }}>{v}</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--fg)" }}>Recent activity</h2>
            {((recentActs as any).data ?? []).length === 0 ? (
              <div className="text-[12.5px]" style={{ color: "var(--fg-4)" }}>
                No activity yet.
              </div>
            ) : (
              <ul className="space-y-2.5">
                {((recentActs as any).data ?? []).map((a: any, i: number) => (
                  <li key={i} className="text-[12.5px]">
                    <span style={{ color: "var(--fg-2)" }}>
                      {a.action} {a.entity_type}
                      {a.metadata?.filename ? `: ${a.metadata.filename}` : ""}
                      {a.metadata?.name ? `: ${a.metadata.name}` : ""}
                    </span>
                    <div style={{ color: "var(--fg-5)" }} className="text-[11px]">
                      {new Date(a.created_at).toISOString().replace("T", " ").slice(0, 16)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone?: "ok" | "warn" | "err" | "accent";
}) {
  const color =
    tone === "ok"
      ? "var(--ok)"
      : tone === "warn"
      ? "var(--warn)"
      : tone === "err"
      ? "var(--err)"
      : tone === "accent"
      ? "var(--accent)"
      : "var(--fg)";
  return (
    <div className="card p-4">
      <div className="text-[11.5px] uppercase tracking-wider font-semibold" style={{ color: "var(--fg-5)" }}>
        {label}
      </div>
      <div className="text-[24px] font-semibold num mt-1" style={{ color }}>
        {value}
      </div>
      {sub && (
        <div className="text-[11.5px] mt-0.5" style={{ color: "var(--fg-4)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function PipelineBar({
  stages,
}: {
  stages: { key: string; label: string; count: number; color: string }[];
}) {
  const total = stages.reduce((s, x) => s + x.count, 0);
  return (
    <div>
      <div
        className="flex w-full overflow-hidden rounded"
        style={{ height: 10, background: "var(--bg-2)" }}
      >
        {stages.map((s) => (
          <div
            key={s.key}
            title={`${s.label}: ${s.count}`}
            style={{
              width: total === 0 ? 0 : `${(s.count / total) * 100}%`,
              background: s.color,
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3">
        {stages.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-[12.5px]">
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: s.color,
                display: "inline-block",
              }}
            />
            <span style={{ color: "var(--fg-3)" }}>{s.label}</span>
            <span className="num" style={{ color: "var(--fg)" }}>{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyPipeline({ dealId, hasDocuments }: { dealId: string; hasDocuments: boolean }) {
  return (
    <div className="text-center py-6">
      <p className="text-[13px] mb-3" style={{ color: "var(--fg-4)" }}>
        {hasDocuments
          ? "Documents uploaded — questions will appear once the AI pipeline runs."
          : "Upload your customer's RFP to extract questions automatically."}
      </p>
      <Link
        href={`/deals/${dealId}/documents`}
        className="btn btn-primary"
      >
        {hasDocuments ? "View documents" : "Upload RFP"}
      </Link>
    </div>
  );
}
