import { requireMembership } from "@/utils/auth";
import Topbar, { Crumb } from "@/components/Topbar";

export default async function TeamPage() {
  const { supabase, member } = await requireMembership();
  const { data: members } = await supabase
    .from("team_members")
    .select("id, name, email, role, avatar_url, created_at")
    .eq("org_id", member.org_id)
    .order("created_at");

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
      <div className="p-7 max-w-[800px]">
        <div className="card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ color: "var(--fg-4)" }}>
                <th className="text-left font-medium px-5 py-2.5">Name</th>
                <th className="text-left font-medium px-5 py-2.5">Email</th>
                <th className="text-left font-medium px-5 py-2.5">Role</th>
                <th className="text-left font-medium px-5 py-2.5">Joined</th>
              </tr>
            </thead>
            <tbody>
              {(members ?? []).map((m) => (
                <tr key={m.id} className="border-t" style={{ borderColor: "var(--divider)" }}>
                  <td className="px-5 py-3 font-medium" style={{ color: "var(--fg)" }}>{m.name || "—"}</td>
                  <td className="px-5 py-3 mono text-[12.5px]" style={{ color: "var(--fg-3)" }}>{m.email}</td>
                  <td className="px-5 py-3"><span className="badge">{m.role}</span></td>
                  <td className="px-5 py-3" style={{ color: "var(--fg-4)" }}>
                    {new Date(m.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs mt-4" style={{ color: "var(--fg-4)" }}>
          Invite flow is not yet wired — for now, have new users sign up and they'll join the workspace
          they create. Multi-user invites can be added next.
        </p>
      </div>
    </>
  );
}
