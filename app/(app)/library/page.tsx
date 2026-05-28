import { requireMembership } from "@/utils/auth";
import Topbar, { Crumb } from "@/components/Topbar";
import LibraryForm from "./LibraryForm";

export default async function LibraryPage() {
  const { supabase, member } = await requireMembership();
  const { data: items } = await supabase
    .from("response_library")
    .select("id, category, keyword, response_text, usage_count, created_at")
    .eq("org_id", member.org_id)
    .order("created_at", { ascending: false });

  return (
    <>
      <Topbar
        crumbs={
          <>
            <Crumb>Workspace</Crumb>
            <Crumb last>Response library</Crumb>
          </>
        }
      />
      <div className="p-7 max-w-[920px] space-y-6">
        <div className="page-header">
          <div className="page-title-row">
            <h1 className="page-title">Reusable answers</h1>
            <span className="page-meta">{items?.length ?? 0} saved</span>
          </div>
          <p className="page-sub">Approved answers, ready to drop into new RFPs.</p>
        </div>

        <div className="section-card" style={{ padding: 18 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", marginBottom: 12, fontFamily: "'Cabinet Grotesk', sans-serif", letterSpacing: "-0.012em" }}>
            Add manually
          </h2>
          <LibraryForm />
        </div>

        <div className="section-card">
          <div className="section-card-head">
            <div>
              <span className="section-card-title">Library</span>
              <span className="section-card-count">{items?.length ?? 0}</span>
            </div>
          </div>
          {!items || items.length === 0 ? (
            <div className="p-8 text-center text-sm" style={{ color: "var(--fg-4)" }}>
              No saved responses yet.
            </div>
          ) : (
            <div>
              {items.map((it, i) => (
                <div
                  key={it.id}
                  style={{
                    padding: "12px 16px",
                    borderTop: i === 0 ? "none" : "1px solid var(--divider)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span className="type-tag mono" style={{ fontSize: 11, color: "var(--accent-3)", background: "var(--accent-tint)", padding: "2px 7px", borderRadius: 4 }}>
                      {it.category ?? "general"}
                    </span>
                    {it.keyword && <span className="meta-mono">{it.keyword}</span>}
                    <span className="meta-mono" style={{ marginLeft: "auto" }}>
                      used {it.usage_count}×
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--fg-2)", whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
                    {it.response_text}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
