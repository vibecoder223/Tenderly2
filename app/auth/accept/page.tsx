import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { tryCreateAdminClient } from "@/utils/supabase/admin";
import AcceptForm from "./form";

export default async function AcceptPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <div className="card p-7">
        <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--fg)" }}>Invite missing</h1>
        <p className="text-sm" style={{ color: "var(--fg-4)" }}>This link is incomplete.</p>
      </div>
    );
  }

  // Look up the invite (admin bypass — invitee may not yet have org access)
  const admin = tryCreateAdminClient();
  const supabase = createClient(await cookies());
  const reader = admin ?? supabase;
  const { data: invite } = await reader
    .from("invites")
    .select("id, email, role, expires_at, accepted_at, organizations(name)")
    .eq("token", token)
    .maybeSingle();

  if (!invite) {
    return (
      <div className="card p-7">
        <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--fg)" }}>Invite not found</h1>
        <p className="text-sm" style={{ color: "var(--fg-4)" }}>
          The link is invalid or has been revoked.
        </p>
      </div>
    );
  }
  if (invite.accepted_at) {
    return (
      <div className="card p-7">
        <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--fg)" }}>Invite already used</h1>
        <p className="text-sm" style={{ color: "var(--fg-4)" }}>
          This invite has already been redeemed.{" "}
          <Link href="/auth/login" style={{ color: "var(--accent)" }}>Sign in</Link>.
        </p>
      </div>
    );
  }
  if (new Date(invite.expires_at) < new Date()) {
    return (
      <div className="card p-7">
        <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--fg)" }}>Invite expired</h1>
        <p className="text-sm" style={{ color: "var(--fg-4)" }}>
          Ask the inviter to send a new link.
        </p>
      </div>
    );
  }

  const orgName = (invite as any).organizations?.name ?? "this workspace";
  const { data: { user } } = await supabase.auth.getUser();

  // If user is signed in with a different email, ask them to switch.
  if (user && user.email?.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <div className="card p-7">
        <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--fg)" }}>Wrong account</h1>
        <p className="text-sm" style={{ color: "var(--fg-4)" }}>
          This invite is for <span className="mono">{invite.email}</span>, but you're signed in as{" "}
          <span className="mono">{user.email}</span>.
          <br />
          <form action="/api/auth/signout" method="post" style={{ display: "inline" }}>
            <button type="submit" className="btn mt-3">Sign out and switch</button>
          </form>
        </p>
      </div>
    );
  }

  if (user) {
    // Auto-accept immediately
    return <AcceptForm token={token} orgName={orgName} role={invite.role} mode="accept" />;
  }

  // Not signed in — send to signup with token preserved
  redirect(`/auth/signup?invite=${token}&email=${encodeURIComponent(invite.email)}`);
}
