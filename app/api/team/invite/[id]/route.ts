import { getClaimsUser } from "@/utils/auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient(await cookies());
  const user = await getClaimsUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Authorize: only owners/admins may revoke, and only within their own org.
  // RLS is org-scoped but role-blind, so without this check any member —
  // including a viewer — could revoke invites by calling this endpoint directly.
  const { data: actor } = await supabase
    .from("team_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!actor) return NextResponse.json({ error: "No org" }, { status: 400 });
  if (!["owner", "admin"].includes(actor.role)) {
    return NextResponse.json({ error: "Only owners and admins can revoke invites." }, { status: 403 });
  }

  const { data: invite } = await supabase
    .from("invites")
    .select("id, org_id")
    .eq("id", id)
    .maybeSingle();
  if (!invite || invite.org_id !== actor.org_id) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }

  const { error } = await supabase.from("invites").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
