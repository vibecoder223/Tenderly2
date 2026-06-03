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

type JobRow = { document_id: string; stage: string; status: string };

const PHASE_LABEL: Record<string, string> = {
  ingest: "Reading & chunking…",
  extract: "Extracting requirements…",
  structure: "Building question set…",
};

// Collapse a document's job rows into one progress line.
function summarizeJobs(rows: JobRow[]): { label: string | null } {
  const active = rows.filter((r) => r.status === "pending" || r.status === "claimed");
  if (active.length === 0) return { label: null };

  // Generation phase: show drafted count.
  const gen = rows.filter((r) => r.stage === "generate");
  if (gen.length > 0 && gen.some((r) => r.status === "pending" || r.status === "claimed")) {
    const done = gen.filter((r) => r.status === "done").length;
    return { label: `Drafting answers… ${done}/${gen.length}` };
  }

  for (const stage of ["ingest", "extract", "structure"]) {
    if (active.some((r) => r.stage === stage)) return { label: PHASE_LABEL[stage] };
  }
  return { label: "Processing…" };
}

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

  // Live pipeline progress, derived from the jobs queue (migration 0010).
  const docIds = (documents ?? []).map((d) => d.id);
  const progress = new Map<string, ReturnType<typeof summarizeJobs>>();
  if (docIds.length > 0) {
    const { data: jobs } = await supabase
      .from("jobs")
      .select("document_id, stage, status")
      .in("document_id", docIds);
    const byDoc = new Map<string, JobRow[]>();
    for (const j of (jobs ?? []) as JobRow[]) {
      (byDoc.get(j.document_id) ?? byDoc.set(j.document_id, []).get(j.document_id)!).push(j);
    }
    for (const [doc, rows] of byDoc) progress.set(doc, summarizeJobs(rows));
  }

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
          <div className="card">
            <ul className="divide-y" style={{ borderColor: "var(--divider)" }}>
              {documents.map((d) => {
                const isFailed = FAILED_STATUSES.has(d.processing_status);
                return (
                  <li
                    key={d.id}
                    className="p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5"
                    style={{ borderColor: "var(--divider)" }}
                  >
                    {/* Left — file info */}
                    <div className="min-w-0 sm:basis-[260px] sm:flex-none">
                      <div className="font-medium text-[14px] truncate" style={{ color: "var(--fg)" }} title={d.filename}>
                        {d.filename}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11.5px]" style={{ color: "var(--fg-4)" }}>
                        <StatusBadge status={d.processing_status} />
                        <span className="num">
                          {d.file_size ? `${Math.round(d.file_size / 1024)} KB` : "—"}
                        </span>
                        <span>{new Date(d.created_at).toISOString().replace("T", " ").slice(0, 16)}</span>
                        <span className="mono truncate" title={d.mime_type ?? ""}>{d.mime_type ?? ""}</span>
                      </div>
                      {progress.get(d.id)?.label && !isFailed && (
                        <div className="text-[11.5px] mt-1.5" style={{ color: "var(--accent)" }}>
                          {progress.get(d.id)!.label}
                        </div>
                      )}
                      {d.error_message && (
                        <div
                          className="text-[11.5px] mt-1.5 line-clamp-2"
                          style={{ color: isFailed ? "var(--err)" : "var(--fg-4)" }}
                          title={d.error_message}
                        >
                          {d.error_message}
                        </div>
                      )}
                    </div>

                    {/* Right — actions */}
                    <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:flex-1 sm:justify-end">
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
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
