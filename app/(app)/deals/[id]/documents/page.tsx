import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMembership } from "@/utils/auth";
import StatusBadge from "@/components/StatusBadge";
import UploadCard from "../UploadCard";
import DeleteDocumentButton from "./DeleteDocumentButton";

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
    <div className="p-7 max-w-[1100px] space-y-6">
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
          <div className="card overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ color: "var(--fg-4)" }}>
                  <th className="text-left font-medium px-5 py-2.5">File</th>
                  <th className="text-left font-medium px-5 py-2.5">Status</th>
                  <th className="text-right font-medium px-5 py-2.5">Size</th>
                  <th className="text-left font-medium px-5 py-2.5">Uploaded</th>
                  <th className="text-right font-medium px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => (
                  <tr key={d.id} className="border-t align-top" style={{ borderColor: "var(--divider)" }}>
                    <td className="px-5 py-3 font-medium" style={{ color: "var(--fg)" }}>
                      {d.filename}
                      <div className="text-[11.5px] mt-0.5 mono" style={{ color: "var(--fg-4)" }}>
                        {d.mime_type ?? ""}
                      </div>
                      {d.error_message && (
                        <div
                          className="text-[11.5px] mt-1"
                          style={{ color: d.processing_status === "failed" ? "var(--err)" : "var(--fg-4)" }}
                        >
                          {d.error_message}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={d.processing_status} />
                    </td>
                    <td className="px-5 py-3 text-right num" style={{ color: "var(--fg-3)" }}>
                      {d.file_size ? `${Math.round(d.file_size / 1024)} KB` : "—"}
                    </td>
                    <td className="px-5 py-3" style={{ color: "var(--fg-4)" }}>
                      {new Date(d.created_at).toISOString().replace("T", " ").slice(0, 16)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="inline-flex items-center gap-2">
                        <Link href={`/deals/${id}/questions?doc=${d.id}`} className="btn">
                          Open questions →
                        </Link>
                        <DeleteDocumentButton documentId={d.id} filename={d.filename} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
