import { requireMembership } from "@/utils/auth";
import Topbar, { Crumb } from "@/components/Topbar";
import KnowledgeView from "./KnowledgeView";
import KnowledgeTestPanel from "@/components/KnowledgeTestPanel";

export default async function KnowledgePage() {
  const { supabase } = await requireMembership();
  const { data: items } = await supabase
    .from("knowledge_documents")
    .select("id, filename, doc_type, ingestion_status, page_count, file_size, created_at, error_message, is_sample")
    .order("created_at", { ascending: false });

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
      <div className="p-7 max-w-[1100px] space-y-6">
        <KnowledgeView initial={(items ?? []) as any[]} />
        <KnowledgeTestPanel />
      </div>
    </>
  );
}
