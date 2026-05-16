import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMembership } from "@/utils/auth";
import Topbar, { Crumb } from "@/components/Topbar";
import StatusBadge from "@/components/StatusBadge";
import UploadCard from "./UploadCard";

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, member } = await requireMembership();

  const { data: deal } = await supabase
    .from("deals")
    .select("*")
    .eq("id", id)
    .eq("org_id", member.org_id)
    .maybeSingle();
  if (!deal) notFound();

  const { data: documents } = await supabase
    .from("documents")
    .select("id, filename, processing_status, file_size, created_at")
    .eq("deal_id", id)
    .order("created_at", { ascending: false });

  return (
    <>
      <Topbar
        crumbs={
          <>
            <Crumb>
              <Link href="/deals" style={{ color: "var(--fg-4)" }}>Deals</Link>
            </Crumb>
            <Crumb last>{deal.name}</Crumb>
          </>
        }
        actions={<StatusBadge status={deal.status} />}
      />
      <div className="p-7 max-w-[1200px] space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <Meta label="Client" value={deal.client_name ?? "—"} />
          <Meta label="Value" value={deal.value ? `$${Number(deal.value).toLocaleString()}` : "—"} />
          <Meta label="Due" value={deal.due_date ? new Date(deal.due_date).toLocaleDateString() : "—"} />
        </div>

        <section>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--fg)" }}>RFP Documents</h2>
          <UploadCard dealId={deal.id} />
        </section>

        {documents && documents.length > 0 && (
          <section>
            <div className="card overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ color: "var(--fg-4)" }}>
                    <th className="text-left font-medium px-5 py-2.5">File</th>
                    <th className="text-left font-medium px-5 py-2.5">Status</th>
                    <th className="text-left font-medium px-5 py-2.5">Uploaded</th>
                    <th className="text-right font-medium px-5 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((d) => (
                    <tr key={d.id} className="border-t" style={{ borderColor: "var(--divider)" }}>
                      <td className="px-5 py-3 font-medium" style={{ color: "var(--fg)" }}>
                        {d.filename}
                        <span className="ml-2 text-[11.5px]" style={{ color: "var(--fg-4)" }}>
                          {d.file_size ? `${Math.round(d.file_size / 1024)} KB` : ""}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={d.processing_status} />
                      </td>
                      <td className="px-5 py-3" style={{ color: "var(--fg-3)" }}>
                        {new Date(d.created_at).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link href={`/deals/${deal.id}/triage?doc=${d.id}`} className="btn">
                          Open triage →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-[11.5px] uppercase tracking-wider font-semibold" style={{ color: "var(--fg-5)" }}>
        {label}
      </div>
      <div className="text-[15px] font-medium mt-1" style={{ color: "var(--fg)" }}>
        {value}
      </div>
    </div>
  );
}
