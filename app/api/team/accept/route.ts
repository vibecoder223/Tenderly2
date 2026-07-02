import { getClaimsUser } from "@/utils/auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { tryCreateAdminClient } from "@/utils/supabase/admin";

export async function POST(req: Request) {
  const supabase = createClient(await cookies());
  const user = await getClaimsUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  // Look up via admin (the invitee is not yet in the org, so RLS would block).
  const admin = tryCreateAdminClient();
  const reader = admin ?? supabase;
  const { data: invite } = await reader
    .from("invites")
    .select("id, org_id, email, role, expires_at, accepted_at")
    .eq("token", token)
    .maybeSingle();
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  if (invite.accepted_at) return NextResponse.json({ error: "Invite already used" }, { status: 410 });
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "Invite expired" }, { status: 410 });
  }
  if (invite.email && invite.email !== user.email?.toLowerCase()) {
    return NextResponse.json(
      { error: `This invite was issued for ${invite.email}, not your account.` },
      { status: 403 }
    );
  }

  const writer = admin ?? supabase;
  // If user already in this org, just consume the invite.
  const { data: existingMember } = await writer
    .from("team_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("org_id", invite.org_id)
    .maybeSingle();

  if (!existingMember) {
    const { error: memberErr } = await writer.from("team_members").insert({
      org_id: invite.org_id,
      user_id: user.id,
      role: invite.role,
      email: user.email ?? "",
      name: (user.user_metadata as any)?.name ?? "",
    });
    if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 });
  }

  await writer
    .from("invites")
    .update({ accepted_at: new Date().toISOString(), accepted_by: user.id })
    .eq("id", invite.id);

  return NextResponse.json({ ok: true, org_id: invite.org_id });
}
