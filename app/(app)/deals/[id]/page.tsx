import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMembership } from "@/utils/auth";

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
  const drafting = byStatus["drafting"] ?? 0;
  const inReview = byStatus["review"] ?? 0;
  const unanswered = byStatus["todo"] ?? 0;
  const blocked = byStatus["blocked"] ?? 0;
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

      <div className="grid grid-cols-3 gap-6 items-stretch">
          <div className="card p-5 col-span-2 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
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
              <div className="flex-1 flex flex-col justify-center">
                <PipelineBar
                  stages={[
                    { key: "todo", label: "To do", count: unanswered, color: "var(--fg)" },
                    { key: "drafting", label: "Drafting", count: drafting, color: "var(--accent)" },
                    { key: "review", label: "In review", count: inReview, color: "var(--warn)" },
                    { key: "approved", label: "Approved", count: approved, color: "var(--ok)" },
                  ]}
                />
              </div>
            )}
          </div>

          <div className="card p-5 h-full flex flex-col">
            <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--fg)" }}>By topic</h2>
            {Object.keys(topicCounts).length === 0 ? (
              <div className="text-[12.5px]" style={{ color: "var(--fg-4)" }}>
                Topics will appear once requirements are extracted.
              </div>
            ) : (
              <ul className="flex-1 flex flex-col justify-center" style={{ gap: 14 }}>
                {Object.entries(topicCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => {
                    const max = Math.max(1, ...Object.values(topicCounts));
                    return (
                      <li key={k}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[13px]" style={{ color: "var(--fg-2)", textTransform: "capitalize" }}>{k.replace(/_/g, " ")}</span>
                          <span className="num text-[13px] font-semibold" style={{ color: "var(--fg)" }}>{v}</span>
                        </div>
                        <div className="rounded-full" style={{ height: 8, background: "var(--bg-2)", overflow: "hidden" }}>
                          <div style={{ width: `${Math.max(3, (v / max) * 100)}%`, height: "100%", background: "var(--accent)", borderRadius: 999, transition: "width 200ms var(--ease)" }} />
                        </div>
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
          <div className="card overflow-hidden col-span-2">
            <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: "var(--divider)" }}>
              <h3 className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                Documents ({(docs ?? []).length})
              </h3>
              <Link href={`/deals/${id}/documents`} className="btn btn-ghost text-[12px]" style={{ color: "var(--accent)" }}>
                Add
              </Link>
            </div>
            {(docs ?? []).length === 0 ? (
              <div className="p-10 text-center text-sm" style={{ color: "var(--fg-4)" }}>
                No RFP documents yet.{" "}
                <Link href={`/deals/${id}/documents`} style={{ color: "var(--accent)", textDecoration: "underline" }}>
                  Upload one
                </Link>{" "}
                to get started.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="w-full text-[13px]" style={{ minWidth: 420 }}>
                  <thead>
                    <tr style={{ color: "var(--fg-4)" }}>
                      <th className="text-left font-medium px-5 py-2.5">File</th>
                      <th className="text-left font-medium px-5 py-2.5">Status</th>
                      <th className="text-left font-medium px-5 py-2.5">Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(docs ?? []).map((d) => (
                      <tr key={d.id} className="border-t align-top" style={{ borderColor: "var(--divider)" }}>
                        <td className="px-5 py-3">
                          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--fg)", minWidth: 0 }}>
                            <SourceIcon filename={d.filename} />
                            <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                              {d.filename}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className={docStatusClass(d.processing_status)}>{d.processing_status}</span>
                        </td>
                        <td className="px-5 py-3 mono" style={{ color: "var(--fg-4)", fontSize: 11.5 }}>
                          {new Date(d.created_at).toISOString().slice(0, 10)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                    <span style={{ color: "var(--fg-2)" }}>{humanizeAct(a)}</span>
                    <div style={{ color: "var(--fg-5)" }} className="text-[11px]">
                      {fmtActivityDate(a.created_at)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <div className="flex flex-col" style={{ gap: 18 }}>
      {stages.map((s) => {
        const pct = total === 0 ? 0 : Math.round((s.count / total) * 100);
        const w = s.count === 0 ? 0 : Math.max(3, (s.count / max) * 100);
        return (
          <div key={s.key} className="flex items-center" style={{ gap: 14 }} title={`${s.label}: ${s.count} (${pct}%)`}>
            <span style={{ width: 84, flexShrink: 0, fontSize: 13, color: "var(--fg-2)" }}>{s.label}</span>
            <div className="flex-1 flex items-center" style={{ gap: 10, height: 24 }}>
              <div
                style={{
                  width: `${w}%`,
                  minWidth: s.count > 0 ? 6 : 0,
                  height: "100%",
                  background: s.color,
                  borderRadius: 5,
                  transition: "width 200ms var(--ease)",
                }}
              />
              <span className="num" style={{ flexShrink: 0, fontSize: 15, fontWeight: 600, color: "var(--fg)", lineHeight: 1 }}>{s.count}</span>
            </div>
            <span className="num" style={{ width: 40, flexShrink: 0, textAlign: "right", fontSize: 11.5, color: "var(--fg-5)" }}>{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function humanizeAct(a: { action: string; entity_type: string; metadata: any }): string {
  const who = a.metadata?.user_name ?? a.metadata?.actor ?? "Someone";
  const file = a.metadata?.filename || a.metadata?.name;
  const entity = file ? `"${file}"` : a.entity_type?.replace(/_/g, " ");
  switch (a.action) {
    case "created":   return `${who} created ${entity}`;
    case "updated":   return `${who} updated ${entity}`;
    case "deleted":   return `${who} deleted ${entity}`;
    case "uploaded":  return `${who} uploaded ${entity}`;
    case "approved":  return `${who} approved ${entity}`;
    case "rejected":  return `${who} sent ${entity} back for revision`;
    case "submitted": return `${who} submitted ${entity} for review`;
    case "generated": return `AI generated draft for ${entity}`;
    case "ingested":  return `${entity} indexed into knowledge base`;
    case "exported":  return `${who} exported ${entity}`;
    default:          return `${who} ${a.action} ${entity}`;
  }
}

function fmtActivityDate(iso: string): string {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

// Map a document's processing_status to a Vellum status-dot pill class.
function docStatusClass(status: string): string {
  if (status === "completed") return "status ok";
  if (status === "failed") return "status err";
  if (
    status === "uploading" || status === "uploaded" || status === "extracting" ||
    status === "chunked" || status === "analyzing" || status === "structured"
  ) return "status pending";
  return "status";
}

function DriveLogo({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 0.89)} viewBox="0 0 87.3 78" aria-hidden style={{ flexShrink: 0 }}>
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
      <path d="M43.65 25 29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3L1.2 48.55c-.787 1.36-1.202 2.903-1.2 4.473h27.5z" fill="#00ac47"/>
      <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z" fill="#ea4335"/>
      <path d="M43.65 25 57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
      <path d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
      <path d="M73.4 26.5 60.75 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
    </svg>
  );
}

function SourceIcon({ filename }: { filename: string }) {
  if (/^g(doc|sheet|slides|drive)-/.test(filename) || filename.includes("-gdrive-")) {
    return <DriveLogo size={12} />;
  }
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "var(--fg-4)" }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
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
