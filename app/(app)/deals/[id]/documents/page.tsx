import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMembership } from "@/utils/auth";
import StatusBadge from "@/components/StatusBadge";
import UploadCard from "../UploadCard";
import DeleteDocumentButton from "./DeleteDocumentButton";
import RetryDocumentButton from "./RetryDocumentButton";

const FAILED_STATUSES = new Set([
  "failed",
  "embedding_failed",
  "extraction_failed",
  "generation_failed",
]);

export default async function DealDocumentsPage({
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

  const { data: documents } = await supabase
    .from("documents")
    .select("id, filename, processing_status, file_size, mime_type, created_at, error_message")
    .eq("deal_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="p-7 space-y-6">
      <section>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--fg)" }}>
          Upload customer RFP
        </h2>
        <UploadCard dealId={id} />
      </section>

      {documents && documents.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--fg)" }}>
            Documents ({documents.length})
          </h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-[13px]" style={{ minWidth: 880 }}>
              <thead>
                <tr style={{ color: "var(--fg-4)" }}>
                  <th className="text-left font-medium px-5 py-2.5">File</th>
                  <th className="text-left font-medium px-3 py-2.5">Status</th>
                  <th className="text-right font-medium px-3 py-2.5">Size</th>
                  <th className="text-left font-medium px-3 py-2.5">Uploaded</th>
                  <th className="text-right font-medium px-5 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => {
                  const isFailed = FAILED_STATUSES.has(d.processing_status);
                  return (
                    <tr key={d.id} className="border-t align-top" style={{ borderColor: "var(--divider)" }}>
                      <td className="px-5 py-3 font-medium" style={{ color: "var(--fg)", maxWidth: 360 }}>
                        <div className="truncate" title={d.filename}>{d.filename}</div>
                        <div className="text-[11.5px] mt-0.5 mono truncate" style={{ color: "var(--fg-4)" }} title={d.mime_type ?? ""}>
                          {d.mime_type ?? ""}
                        </div>
                        {d.error_message && (
                          <div
                            className="text-[11.5px] mt-1 line-clamp-2"
                            style={{ color: isFailed ? "var(--err)" : "var(--fg-4)" }}
                            title={d.error_message}
                          >
                            {d.error_message}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <StatusBadge status={d.processing_status} />
                      </td>
                      <td className="px-3 py-3 text-right num whitespace-nowrap" style={{ color: "var(--fg-3)" }}>
                        {d.file_size ? `${Math.round(d.file_size / 1024)} KB` : "—"}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap" style={{ color: "var(--fg-4)" }}>
                        {new Date(d.created_at).toISOString().replace("T", " ").slice(0, 16)}
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {isFailed && <RetryDocumentButton documentId={d.id} />}
                          <Link
                            href={`/deals/${id}/questions?doc=${d.id}`}
                            className="btn"
                            title="Open extracted questions for this document"
                            style={{ padding: "4px 10px" }}
                          >
                            Questions →
                          </Link>
                          <DeleteDocumentButton documentId={d.id} filename={d.filename} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
