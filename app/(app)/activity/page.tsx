import { requireMembership } from "@/utils/auth";
import Topbar, { Crumb } from "@/components/Topbar";
import ActivityFeed from "@/components/ActivityFeed";

export default async function ActivityPage() {
  const { supabase, member } = await requireMembership();

  const { data: activity } = await supabase
    .from("activity_log")
    .select("action, entity_type, metadata, created_at, user_id")
    .eq("org_id", member.org_id)
    .order("created_at", { ascending: false })
    .limit(200);

  const items = activity ?? [];

  return (
    <>
      <Topbar
        crumbs={
          <>
            <Crumb>Workspace</Crumb>
            <Crumb last>Activity</Crumb>
          </>
        }
      />
      <div className="p-7 max-w-[900px] space-y-6">
        <div className="page-header">
          <div className="page-title-row">
            <h1 className="page-title">Activity</h1>
            <span className="page-meta">{items.length} events</span>
          </div>
          <p className="page-sub">Full audit trail for {member.organizations?.name}.</p>
        </div>

        <section className="section-card">
          <div className="section-card-head">
            <span className="section-card-title">All activity</span>
          </div>
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm" style={{ color: "var(--fg-4)" }}>
              No activity yet.
            </div>
          ) : (
            <ActivityFeed items={items as any[]} pageSize={15} />
          )}
        </section>
      </div>
    </>
  );
}
