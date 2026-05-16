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
        <div className="card p-5">
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--fg)" }}>Add a reusable response</h2>
          <LibraryForm />
        </div>

        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--divider)" }}>
            <h3 className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
              Library ({items?.length ?? 0})
            </h3>
          </div>
          {!items || items.length === 0 ? (
            <div className="p-8 text-center text-sm" style={{ color: "var(--fg-4)" }}>
              No saved responses yet.
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--divider)" }}>
              {items.map((it) => (
                <div key={it.id} className="px-5 py-4 border-t" style={{ borderColor: "var(--divider)" }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="badge badge-accent">{it.category ?? "general"}</span>
                    {it.keyword && <span className="mono text-[11.5px]" style={{ color: "var(--fg-4)" }}>{it.keyword}</span>}
                    <span className="ml-auto text-[11.5px]" style={{ color: "var(--fg-4)" }}>
                      Used {it.usage_count} times
                    </span>
                  </div>
                  <div className="text-[13px] whitespace-pre-wrap" style={{ color: "var(--fg-2)" }}>
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
