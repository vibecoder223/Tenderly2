import { requireMembership } from "@/utils/auth";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, member } = await requireMembership();
  const displayName = member.name ?? (user.user_metadata as { name?: string } | null)?.name ?? user.email ?? "";

  return (
    <div className="flex min-h-screen">
      <Sidebar
        user={{ name: displayName, email: user.email ?? "" }}
        orgName={member.organizations?.name ?? "Workspace"}
      />
      <main className="flex-1 flex flex-col" style={{ marginLeft: "var(--sidebar)" }}>
        {children}
      </main>
    </div>
  );
}
