import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { createClient } from "@/utils/supabase/server";
import { sendEmail, inviteEmail, emailConfigured } from "@/lib/email";

export async function POST(req: Request) {
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("team_members")
    .select("org_id, role, name")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "No org" }, { status: 400 });
  if (!["owner", "admin"].includes(member.role)) {
    return NextResponse.json({ error: "Only owners/admins can invite" }, { status: 403 });
  }

  const body = await req.json();
  const email = String(body.email || "").trim().toLowerCase();
  const role = ["admin", "user", "viewer"].includes(body.role) ? body.role : "user";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "";

  // Don't invite someone who's already on the team.
  const { data: existingMember } = await supabase
    .from("team_members")
    .select("id")
    .eq("org_id", member.org_id)
    .eq("email", email)
    .maybeSingle();
  if (existingMember) {
    return NextResponse.json({ error: "That email is already a member of this workspace." }, { status: 409 });
  }

  // If there's a live pending invite for this email, reuse it instead of
  // stacking duplicates — return its link so the inviter can re-share.
  const { data: pending } = await supabase
    .from("invites")
    .select("id, token, role, expires_at")
    .eq("org_id", member.org_id)
    .eq("email", email)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (pending) {
    return NextResponse.json({
      invite: pending,
      url: `${origin}/auth/accept?token=${pending.token}`,
      reused: true,
    });
  }

  const token = crypto.randomBytes(24).toString("base64url");
  const { data, error } = await supabase
    .from("invites")
    .insert({
      org_id: member.org_id,
      email,
      role,
      token,
      invited_by: user.id,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const url = `${origin}/auth/accept?token=${token}`;

  // Best-effort send. Never block invite creation on email — the inviter always
  // gets a copyable link back regardless of delivery.
  let emailed = false;
  let emailError: string | undefined;
  if (emailConfigured()) {
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", member.org_id)
      .maybeSingle();
    const tpl = inviteEmail({
      orgName: org?.name || "your workspace",
      role,
      inviterName: member.name,
      acceptUrl: url,
    });
    const sent = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    emailed = sent.ok;
    if (!sent.ok) emailError = sent.error;
  }

  return NextResponse.json({ invite: data, url, emailed, emailError });
}
