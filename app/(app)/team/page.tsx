import { requireMembership } from "@/utils/auth";
import Topbar, { Crumb } from "@/components/Topbar";
import TeamView from "./TeamView";

export default async function TeamPage() {
  const { supabase, member, user } = await requireMembership();

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase
      .from("team_members")
      .select("id, name, email, role, avatar_url, created_at, user_id")
      .eq("org_id", member.org_id)
      .order("created_at"),
    supabase
      .from("invites")
      .select("id, email, role, expires_at, accepted_at, created_at, token")
      .eq("org_id", member.org_id)
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const canInvite = ["owner", "admin"].includes(member.role);
  return (
    <>
      <Topbar
        crumbs={
          <>
            <Crumb>Workspace</Crumb>
            <Crumb last>Team</Crumb>
          </>
        }
      />
      <div className="p-7 max-w-[920px]">
        <div className="page-header">
          <div className="page-title-row">
            <h1 className="page-title">Team</h1>
            <span className="page-meta">{(members ?? []).length} members{(invites ?? []).length > 0 ? ` · ${(invites ?? []).length} pending` : ""}</span>
          </div>
          <p className="page-sub">Invite teammates as reviewers, contributors, or admins. Roles control approval rights and visibility.</p>
        </div>
        <TeamView
          members={(members ?? []) as any[]}
          invites={(invites ?? []) as any[]}
          currentUserId={user.id}
          currentUserRole={member.role}
          canInvite={canInvite}
        />
      </div>
    </>
  );
}
