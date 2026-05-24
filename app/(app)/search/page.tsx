import Link from "next/link";
import { requireMembership } from "@/utils/auth";
import Topbar, { Crumb } from "@/components/Topbar";
import StatusBadge from "@/components/StatusBadge";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: rawQ } = await searchParams;
  const q = rawQ?.trim() ?? "";
  const { supabase, member } = await requireMembership();

  type Deal = { id: string; name: string; client_name: string | null; status: string };
  type QRow = {
    id: string;
    question_text: string;
    status: string;
    document_id: string;
    documents: { deal_id: string; deals: { id: string; name: string } };
  };
  type KbDoc = { id: string; filename: string; doc_type: string; ingestion_status: string };

  let deals: Deal[] = [];
  let questions: QRow[] = [];
  let kbDocs: KbDoc[] = [];

  if (q.length >= 2) {
    const pattern = `%${q}%`;
    const [d, qs, kb] = await Promise.all([
      supabase
        .from("deals")
        .select("id, name, client_name, status")
        .eq("org_id", member.org_id)
        .or(`name.ilike.${pattern},client_name.ilike.${pattern}`)
        .limit(8),
      supabase
        .from("questions")
        .select("id, question_text, status, document_id, documents!inner(deal_id, deals!inner(id, name, org_id))")
        .ilike("question_text", pattern)
        .limit(15),
      supabase
        .from("knowledge_documents")
        .select("id, filename, doc_type, ingestion_status")
        .eq("org_id", member.org_id)
        .ilike("filename", pattern)
        .limit(8),
    ]);
    deals = (d.data ?? []) as Deal[];
    questions = ((qs.data ?? []) as unknown as QRow[]).filter(
      (r) => (r.documents as any)?.deals?.org_id === member.org_id
    );
    kbDocs = (kb.data ?? []) as KbDoc[];
  }

  const total = deals.length + questions.length + kbDocs.length;

  return (
    <>
      <Topbar
        crumbs={
          <>
            <Crumb>Workspace</Crumb>
            <Crumb last>Search</Crumb>
          </>
        }
      />
      <div className="p-7 max-w-[860px] space-y-6">
        <form method="get" action="/search" className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search deals, questions, documents…"
            autoFocus
            className="input flex-1"
            style={{ fontSize: 14, padding: "8px 12px" }}
          />
          <button type="submit" className="btn btn-primary">Search</button>
        </form>

        {q.length >= 2 && (
          <div className="text-[12.5px]" style={{ color: "var(--fg-4)" }}>
            {total === 0 ? `No results for "${q}"` : `${total} result${total !== 1 ? "s" : ""} for "${q}"`}
          </div>
        )}

        {deals.length > 0 && (
          <section className="card overflow-hidden">
            <div className="px-5 py-3 border-b" style={{ borderColor: "var(--divider)" }}>
              <h2 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--fg-4)" }}>
                Deals
              </h2>
            </div>
            <ul>
              {deals.map((d) => (
                <li key={d.id} className="border-t px-5 py-3 flex items-center gap-3" style={{ borderColor: "var(--divider)" }}>
                  <div className="flex-1 min-w-0">
                    <Link href={`/deals/${d.id}`} className="text-[13px] font-medium" style={{ color: "var(--fg)" }}>
                      {d.name}
                    </Link>
                    {d.client_name && (
                      <span className="text-[12px] ml-2" style={{ color: "var(--fg-4)" }}>{d.client_name}</span>
                    )}
                  </div>
                  <StatusBadge status={d.status} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {questions.length > 0 && (
          <section className="card overflow-hidden">
            <div className="px-5 py-3 border-b" style={{ borderColor: "var(--divider)" }}>
              <h2 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--fg-4)" }}>
                Questions
              </h2>
            </div>
            <ul>
              {questions.map((q) => (
                <li key={q.id} className="border-t px-5 py-3 flex items-start gap-3" style={{ borderColor: "var(--divider)" }}>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/deals/${(q.documents as any)?.deal_id}/questions/${q.id}`}
                      className="text-[13px] font-medium line-clamp-2"
                      style={{ color: "var(--fg)" }}
                    >
                      {q.question_text}
                    </Link>
                    <div className="text-[11.5px] mt-0.5" style={{ color: "var(--fg-4)" }}>
                      {(q.documents as any)?.deals?.name ?? "Unknown deal"}
                    </div>
                  </div>
                  <StatusBadge status={q.status} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {kbDocs.length > 0 && (
          <section className="card overflow-hidden">
            <div className="px-5 py-3 border-b" style={{ borderColor: "var(--divider)" }}>
              <h2 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--fg-4)" }}>
                Knowledge base
              </h2>
            </div>
            <ul>
              {kbDocs.map((d) => (
                <li key={d.id} className="border-t px-5 py-3 flex items-center gap-3" style={{ borderColor: "var(--divider)" }}>
                  <div className="flex-1 min-w-0">
                    <Link href="/knowledge" className="text-[13px] font-medium" style={{ color: "var(--fg)" }}>
                      {d.filename}
                    </Link>
                    <span className="badge ml-2">{d.doc_type.replace(/_/g, " ")}</span>
                  </div>
                  <StatusBadge status={d.ingestion_status} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
