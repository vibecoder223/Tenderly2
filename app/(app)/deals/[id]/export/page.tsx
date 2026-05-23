import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMembership } from "@/utils/auth";
import ExportControls from "./ExportControls";

export default async function ExportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ doc?: string }>;
}) {
  const { id: dealId } = await params;
  const { doc: docParam } = await searchParams;
  const { supabase, member } = await requireMembership();

  const { data: deal } = await supabase
    .from("deals")
    .select("id, name, client_name")
    .eq("id", dealId)
    .eq("org_id", member.org_id)
    .maybeSingle();
  if (!deal) notFound();

  const { data: allDocs } = await supabase
    .from("documents")
    .select("id, filename, created_at")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: true });
  const documents = allDocs ?? [];

  let docId = docParam;
  if (!docId && documents.length > 0) {
    docId = documents[documents.length - 1].id; // most recent
  }

  if (documents.length === 0) {
    return (
      <div className="p-7 max-w-[860px]">
        <div className="card p-10 text-center">
          <h3 className="text-base font-semibold mb-1" style={{ color: "var(--fg)" }}>
            Nothing to export yet
          </h3>
          <p className="text-sm mb-4" style={{ color: "var(--fg-4)" }}>
            Upload an RFP, draft responses, and approve them before exporting.
          </p>
          <Link href={`/deals/${dealId}/documents`} className="btn btn-primary">
            Go to documents
          </Link>
        </div>
      </div>
    );
  }

  // Counts per document for the picker
  const docIds = documents.map((d) => d.id);
  const { data: questionsAll } = docIds.length
    ? await supabase
        .from("questions")
        .select("id, document_id, responses(status)")
        .in("document_id", docIds)
    : { data: [] as any[] };
  const countsByDoc: Record<string, { total: number; approved: number }> = {};
  for (const d of documents) countsByDoc[d.id] = { total: 0, approved: 0 };
  for (const q of (questionsAll ?? []) as any[]) {
    const c = countsByDoc[q.document_id];
    if (!c) continue;
    c.total += 1;
    if ((q.responses ?? []).some((r: any) => r.status === "approved")) c.approved += 1;
  }
  const totalQuestions = Object.values(countsByDoc).reduce((s, c) => s + c.total, 0);
  const totalApproved = Object.values(countsByDoc).reduce((s, c) => s + c.approved, 0);

  const { data: exports } = await supabase
    .from("exports")
    .select("id, file_path, format, created_at")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false });

  // Templates list (may be empty or table missing — fail soft)
  let templates: { id: string; name: string; kind: string | null; is_default: boolean }[] = [];
  try {
    const { data: tplRows } = await supabase
      .from("proposal_templates")
      .select("id, name, kind, is_default")
      .eq("org_id", member.org_id)
      .order("is_default", { ascending: false })
      .order("name");
    templates = tplRows ?? [];
  } catch {}

  return (
    <div className="p-7 max-w-[920px] space-y-6">
      <div className="card p-5">
        <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--fg)" }}>
          Final proposal
        </h2>
        <p className="text-[13px] mb-4" style={{ color: "var(--fg-4)" }}>
          {totalApproved} of {totalQuestions} questions approved across {documents.length} document{documents.length === 1 ? "" : "s"}.
          Choose whether to merge everything into one proposal or export a single document.
        </p>
        <ExportControls
          dealId={dealId}
          documents={documents.map((d) => ({
            id: d.id,
            filename: d.filename,
            total: countsByDoc[d.id]?.total ?? 0,
            approved: countsByDoc[d.id]?.approved ?? 0,
          }))}
          initialDocId={docId ?? null}
          templates={templates}
        />
      </div>


      {exports && exports.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--divider)" }}>
            <h3 className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
              Previous exports
            </h3>
          </div>
          <table className="w-full text-[13px]">
            <tbody>
              {exports.map((e) => (
                <tr key={e.id} className="border-t" style={{ borderColor: "var(--divider)" }}>
                  <td className="px-5 py-3" style={{ color: "var(--fg-2)" }}>
                    {new Date(e.created_at).toISOString().replace("T", " ").slice(0, 16)}
                  </td>
                  <td className="px-5 py-3 mono text-[12px]" style={{ color: "var(--fg-4)" }}>
                    {e.format.toUpperCase()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <a
                      className="btn"
                      href={`/api/exports/${e.id}/download`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
