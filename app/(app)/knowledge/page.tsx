import { Suspense } from "react";
import { requireMembership } from "@/utils/auth";
import Topbar, { Crumb } from "@/components/Topbar";
import KnowledgeTabs from "./KnowledgeTabs";

export default async function KnowledgePage() {
  const { supabase, member } = await requireMembership();

  const [{ data: docs }, { data: answers }] = await Promise.all([
    supabase
      .from("knowledge_documents")
      .select("id, filename, doc_type, ingestion_status, page_count, file_size, created_at, error_message, is_sample")
      .order("created_at", { ascending: false }),
    supabase
      .from("response_library")
      .select("id, category, keyword, question_text, response_text, usage_count, last_used_at, source, created_at")
      .eq("org_id", member.org_id)
      .order("usage_count", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  return (
    <>
      <Topbar
        crumbs={
          <>
            <Crumb>Workspace</Crumb>
            <Crumb last>Knowledge base</Crumb>
          </>
        }
      />
      <div className="p-7 max-w-[1100px]">
        <div className="page-header" style={{ marginBottom: 18 }}>
          <div className="page-title-row">
            <h1 className="page-title">Knowledge base</h1>
          </div>
          <p className="page-sub">
            Everything your AI draws on to answer — source documents and reusable approved answers.
          </p>
        </div>
        <Suspense fallback={<div className="text-sm" style={{ color: "var(--fg-4)" }}>Loading…</div>}>
          <KnowledgeTabs documents={(docs ?? []) as any[]} answers={(answers ?? []) as any[]} />
        </Suspense>
      </div>
    </>
  );
}
