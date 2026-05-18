import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMembership } from "@/utils/auth";

export default async function CompliancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ doc?: string }>;
}) {
  const { id } = await params;
  const { doc: docParam } = await searchParams;
  const { supabase, member } = await requireMembership();

  const { data: deal } = await supabase
    .from("deals")
    .select("id")
    .eq("id", id)
    .eq("org_id", member.org_id)
    .maybeSingle();
  if (!deal) notFound();

  let docId = docParam;
  if (!docId) {
    const { data: latest } = await supabase
      .from("documents")
      .select("id")
      .eq("deal_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    docId = latest?.id;
  }

  const { data: reqs } = docId
    ? await supabase
        .from("extracted_requirements")
        .select("id, requirement_id, title, classification, topic, source_page, section, is_mandatory")
        .eq("document_id", docId)
    : { data: [] as any[] };

  const { data: questions } = docId
    ? await supabase
        .from("questions")
        .select("id, requirement_id, status")
        .eq("document_id", docId)
    : { data: [] as any[] };

  const reqList = reqs ?? [];
  const qByReq = new Map((questions ?? []).map((q: any) => [q.requirement_id, q]));

  const byClass = group(reqList, (r: any) => r.classification ?? "uncategorized");
  const mustItems = reqList.filter((r: any) => r.classification === "must");
  const unansweredMust = mustItems.filter((r: any) => {
    const q = qByReq.get(r.requirement_id);
    return !q || ["unanswered", "pending"].includes(q.status);
  });

  if (reqList.length === 0) {
    return (
      <div className="p-7 max-w-[1200px]">
        <div className="card p-10 text-center">
          <h3 className="text-base font-semibold mb-1" style={{ color: "var(--fg)" }}>No requirements yet</h3>
          <p className="text-sm mb-4" style={{ color: "var(--fg-4)" }}>
            Upload an RFP and run the pipeline to populate this matrix.
          </p>
          <Link href={`/deals/${id}/documents`} className="btn btn-primary">Go to documents</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-7 max-w-[1300px] space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <Tile label="Total requirements" value={reqList.length} />
        <Tile label="Must" value={mustItems.length} tone="err" />
        <Tile label="Should" value={(byClass.get("should") ?? []).length} tone="warn" />
        <Tile
          label="Unanswered must"
          value={unansweredMust.length}
          tone={unansweredMust.length > 0 ? "err" : "ok"}
        />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ color: "var(--fg-4)" }}>
              <th className="text-left font-medium px-5 py-2.5" style={{ width: 100 }}>ID</th>
              <th className="text-left font-medium px-5 py-2.5" style={{ width: 90 }}>Section</th>
              <th className="text-left font-medium px-5 py-2.5">Requirement</th>
              <th className="text-left font-medium px-5 py-2.5" style={{ width: 90 }}>Class</th>
              <th className="text-left font-medium px-5 py-2.5" style={{ width: 110 }}>Topic</th>
              <th className="text-right font-medium px-5 py-2.5" style={{ width: 80 }}>Page</th>
              <th className="text-left font-medium px-5 py-2.5" style={{ width: 130 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {reqList.map((r: any) => {
              const q = qByReq.get(r.requirement_id);
              const status = q?.status ?? "unanswered";
              return (
                <tr key={r.id} className="border-t align-top" style={{ borderColor: "var(--divider)" }}>
                  <td className="px-5 py-3 mono text-[11.5px]" style={{ color: "var(--fg-4)" }}>
                    {q ? (
                      <Link
                        href={`/deals/${id}/questions/${q.id}`}
                        style={{ color: "var(--fg-3)" }}
                      >
                        {r.requirement_id ?? "—"}
                      </Link>
                    ) : (
                      r.requirement_id ?? "—"
                    )}
                  </td>
                  <td className="px-5 py-3 mono text-[11.5px]" style={{ color: "var(--fg-3)" }}>
                    {r.section ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="font-medium" style={{ color: "var(--fg)" }}>{r.title}</div>
                  </td>
                  <td className="px-5 py-3">
                    {r.classification === "must" ? (
                      <span className="badge badge-err">Must</span>
                    ) : r.classification === "should" ? (
                      <span className="badge badge-warn">Should</span>
                    ) : r.classification === "info" ? (
                      <span className="badge">Info</span>
                    ) : (
                      <span style={{ color: "var(--fg-5)" }}>—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 capitalize" style={{ color: "var(--fg-3)" }}>
                    {r.topic ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-right num" style={{ color: "var(--fg-3)" }}>
                    {r.source_page ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    <ComplianceCell status={status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ComplianceCell({ status }: { status: string }) {
  if (status === "approved" || status === "finalized")
    return <span className="badge badge-ok">Covered</span>;
  if (status === "submitted" || status === "in_review")
    return <span className="badge badge-warn">In review</span>;
  if (status === "ai_drafted" || status === "in_progress" || status === "assigned")
    return <span className="badge badge-accent">Drafting</span>;
  return <span className="badge badge-err">Unanswered</span>;
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn" | "err";
}) {
  const color =
    tone === "ok"
      ? "var(--ok)"
      : tone === "warn"
      ? "var(--warn)"
      : tone === "err"
      ? "var(--err)"
      : "var(--fg)";
  return (
    <div className="card p-4">
      <div
        className="text-[11.5px] uppercase tracking-wider font-semibold"
        style={{ color: "var(--fg-5)" }}
      >
        {label}
      </div>
      <div className="text-[24px] font-semibold num mt-1" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function group<T, K>(arr: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const x of arr) {
    const k = key(x);
    const list = m.get(k) ?? [];
    list.push(x);
    m.set(k, list);
  }
  return m;
}
