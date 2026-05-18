import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("team_members")
    .select("org_id, role")
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

  const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "";
  const url = `${origin}/auth/accept?token=${token}`;
  return NextResponse.json({ invite: data, url });
}
