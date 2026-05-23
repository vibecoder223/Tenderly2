import React from "react";
import { requireMembership } from "@/utils/auth";
import AppShell from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, member } = await requireMembership();
  const displayName = member.name ?? (user.user_metadata as { name?: string } | null)?.name ?? user.email ?? "";

  return (
    <AppShell
      user={{ name: displayName, email: user.email ?? "" }}
      orgName={member.organizations?.name ?? "Workspace"}
    >
      {children}
    </AppShell>
  );
}
