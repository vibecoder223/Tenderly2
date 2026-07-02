import { getClaimsUser } from "@/utils/auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

const ROLES = ["owner", "admin", "user", "viewer"] as const;
type Role = (typeof ROLES)[number];

// Resolve the caller's membership (org + role) for authorization checks.
async function getActor() {
  const supabase = createClient(await cookies());
  const user = await getClaimsUser(supabase);
  if (!user) return { error: "Unauthorized", status: 401 as const };

  const { data: actor } = await supabase
    .from("team_members")
    .select("id, org_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!actor) return { error: "No org", status: 400 as const };

  return { supabase, user, actor };
}

// Count remaining owners in an org — used to block removing/demoting the last one.
async function ownerCount(supabase: any, orgId: string) {
  const { count } = await supabase
    .from("team_members")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("role", "owner");
  return count ?? 0;
}

// PATCH — change a member's role.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getActor();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase, actor } = ctx;

  if (!["owner", "admin"].includes(actor.role)) {
    return NextResponse.json({ error: "Only owners and admins can change roles." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const role = body.role as Role;
  if (!ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  // Target must be in the actor's org.
  const { data: target } = await supabase
    .from("team_members")
    .select("id, org_id, role, user_id")
    .eq("id", id)
    .maybeSingle();
  if (!target || target.org_id !== actor.org_id) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  // Only an owner may grant or revoke the owner role.
  if ((role === "owner" || target.role === "owner") && actor.role !== "owner") {
    return NextResponse.json({ error: "Only an owner can change owner status." }, { status: 403 });
  }

  // Never demote the last owner — it would orphan the workspace.
  if (target.role === "owner" && role !== "owner" && (await ownerCount(supabase, actor.org_id)) <= 1) {
    return NextResponse.json(
      { error: "This is the only owner. Promote another member to owner first." },
      { status: 409 }
    );
  }

  if (role === target.role) return NextResponse.json({ ok: true, role });

  const { error } = await supabase.from("team_members").update({ role }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, role });
}

// DELETE — remove a member from the org.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getActor();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { supabase, actor } = ctx;

  if (!["owner", "admin"].includes(actor.role)) {
    return NextResponse.json({ error: "Only owners and admins can remove members." }, { status: 403 });
  }

  const { data: target } = await supabase
    .from("team_members")
    .select("id, org_id, role")
    .eq("id", id)
    .maybeSingle();
  if (!target || target.org_id !== actor.org_id) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  // Admins can't remove owners; only owners can.
  if (target.role === "owner" && actor.role !== "owner") {
    return NextResponse.json({ error: "Only an owner can remove an owner." }, { status: 403 });
  }

  // Never remove the last owner.
  if (target.role === "owner" && (await ownerCount(supabase, actor.org_id)) <= 1) {
    return NextResponse.json(
      { error: "This is the only owner. Transfer ownership before removing." },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("team_members").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
