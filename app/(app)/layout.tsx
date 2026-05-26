import React from "react";
import { requireMembership } from "@/utils/auth";
import AppShell from "@/components/AppShell";
import { runStartupRecovery } from "@/lib/startup-recovery";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Sweep stuck rows once per process. Fire-and-forget; never blocks render.
  void runStartupRecovery();

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
