import { requireMembership } from "@/utils/auth";
import Topbar, { Crumb } from "@/components/Topbar";
import TemplatesView from "./TemplatesView";

export default async function TemplatesPage() {
  const { supabase, member } = await requireMembership();

  let templates: any[] = [];
  let migrationMissing = false;
  let docxMigrationMissing = false;
  let res = await supabase
    .from("proposal_templates")
    .select("*")
    .eq("org_id", member.org_id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (res.error) {
    if (/relation .* does not exist/i.test(res.error.message)) {
      migrationMissing = true;
    } else if (/column .* does not exist/i.test(res.error.message)) {
      // 0007 applied but not 0008 — retry without kind/file columns
      docxMigrationMissing = true;
      res = await supabase
        .from("proposal_templates")
        .select("id, org_id, name, description, intro, footer, accent_color, font_family, is_default, created_at")
        .eq("org_id", member.org_id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      templates = res.data ?? [];
    }
  } else {
    templates = res.data ?? [];
  }

  return (
    <>
      <Topbar
        crumbs={
          <>
            <Crumb>Workspace</Crumb>
            <Crumb last>Templates</Crumb>
          </>
        }
      />
      <div className="p-7 max-w-[1400px]">
        <div className="page-header">
          <div className="page-title-row">
            <h1 className="page-title">Templates</h1>
            <span className="page-meta">{templates.length} saved</span>
          </div>
          <p className="page-sub">Branded proposal templates for export. Set one as default, customize intro and footer.</p>
        </div>
        {migrationMissing ? (
          <div className="card p-8">
            <h2 className="text-base font-semibold mb-1" style={{ color: "var(--fg)" }}>Run migration first</h2>
            <p className="text-[13px]" style={{ color: "var(--fg-4)" }}>
              Open Supabase Studio → SQL editor → paste and run <code className="mono">migrations/0007_proposal_templates.sql</code> then <code className="mono">migrations/0008_template_files.sql</code>, then refresh.
            </p>
          </div>
        ) : (
          <>
            {docxMigrationMissing && (
              <div className="card p-4 mb-4" style={{ borderColor: "var(--warn)" }}>
                <p className="text-[12.5px]" style={{ color: "var(--fg-3)" }}>
                  ⚠ .docx upload disabled — run <code className="mono">migrations/0008_template_files.sql</code> in Supabase Studio to enable it.
                </p>
              </div>
            )}
            <TemplatesView initial={templates} />
          </>
        )}
      </div>
    </>
  );
}
