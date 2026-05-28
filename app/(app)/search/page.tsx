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
        <div className="page-header">
          <div className="page-title-row">
            <h1 className="page-title">Search</h1>
            {q.length >= 2 && (
              <span className="page-meta">
                {total === 0 ? `0 results` : `${total} result${total !== 1 ? "s" : ""}`} · "{q}"
              </span>
            )}
          </div>
          <p className="page-sub">Find deals, questions, or knowledge base documents.</p>
        </div>

        <form method="get" action="/search" className="search-pill" style={{ maxWidth: "none", width: "100%", height: 38 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search deals, questions, documents…"
            autoFocus
            style={{ fontSize: 14 }}
          />
          <button type="submit" className="btn btn-primary" style={{ height: 28 }}>Search</button>
        </form>

        {deals.length > 0 && (
          <section className="section-card">
            <div className="section-card-head">
              <div>
                <span className="section-card-title">Deals</span>
                <span className="section-card-count">{deals.length}</span>
              </div>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {deals.map((d, i) => (
                <li key={d.id} style={{ padding: "10px 16px", borderTop: i === 0 ? "none" : "1px solid var(--divider)", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/deals/${d.id}`} style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", textDecoration: "none" }}>
                      {d.name}
                    </Link>
                    {d.client_name && (
                      <span className="meta-mono" style={{ marginLeft: 8 }}>{d.client_name}</span>
                    )}
                  </div>
                  <StatusBadge status={d.status} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {questions.length > 0 && (
          <section className="section-card">
            <div className="section-card-head">
              <div>
                <span className="section-card-title">Questions</span>
                <span className="section-card-count">{questions.length}</span>
              </div>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {questions.map((q, i) => (
                <li key={q.id} style={{ padding: "10px 16px", borderTop: i === 0 ? "none" : "1px solid var(--divider)", display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link
                      href={`/deals/${(q.documents as any)?.deal_id}/questions/${q.id}`}
                      className="line-clamp-2"
                      style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", textDecoration: "none" }}
                    >
                      {q.question_text}
                    </Link>
                    <div className="meta-mono" style={{ marginTop: 3 }}>
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
          <section className="section-card">
            <div className="section-card-head">
              <div>
                <span className="section-card-title">Knowledge base</span>
                <span className="section-card-count">{kbDocs.length}</span>
              </div>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {kbDocs.map((d, i) => (
                <li key={d.id} style={{ padding: "10px 16px", borderTop: i === 0 ? "none" : "1px solid var(--divider)", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href="/knowledge" style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", textDecoration: "none" }}>
                      {d.filename}
                    </Link>
                    <span className="meta-mono" style={{ marginLeft: 8 }}>{d.doc_type.replace(/_/g, " ")}</span>
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
