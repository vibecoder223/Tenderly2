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

  let docId = docParam;
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

  const { data: questions } = await supabase
    .from("questions")
    .select("id, status, responses(status)")
    .eq("document_id", docId);

  const approved = (questions ?? []).filter((q: any) =>
    q.responses?.some((r: any) => r.status === "approved")
  ).length;

  const { data: exports } = await supabase
    .from("exports")
    .select("id, file_path, format, created_at")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false });

  return (
    <div className="p-7 max-w-[920px] space-y-6">
      <div className="card p-5">
        <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--fg)" }}>
          Final proposal
        </h2>
        <p className="text-[13px] mb-4" style={{ color: "var(--fg-4)" }}>
          {approved} of {questions?.length ?? 0} questions approved. Approved answers are
          rendered with citations; un-approved questions fall back to drafts.
        </p>
        <ExportControls dealId={dealId} documentId={docId} />
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
