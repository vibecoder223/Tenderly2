import { getClaimsUser } from "@/utils/auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = createClient(await cookies());
  const user = await getClaimsUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("team_members").select("org_id").eq("user_id", user.id).maybeSingle();
  if (!member) return NextResponse.json({ templates: [] });

  const { data, error } = await supabase
    .from("proposal_templates")
    .select("*")
    .eq("org_id", member.org_id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = createClient(await cookies());
  const user = await getClaimsUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("team_members").select("org_id").eq("user_id", user.id).maybeSingle();
  if (!member) return NextResponse.json({ error: "No org" }, { status: 400 });

  const body = await req.json();
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  // Enforce single default
  if (body.is_default) {
    await supabase.from("proposal_templates").update({ is_default: false }).eq("org_id", member.org_id);
  }

  const { data, error } = await supabase.from("proposal_templates").insert({
    org_id: member.org_id,
    name: body.name,
    description: body.description ?? null,
    intro: body.intro ?? null,
    footer: body.footer ?? null,
    accent_color: body.accent_color || "#00872F",
    font_family: body.font_family || "default",
    is_default: !!body.is_default,
    created_by: user.id,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data });
}
