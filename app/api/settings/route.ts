import { getClaimsUser } from "@/utils/auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  const supabase = createClient(await cookies());
  const user = await getClaimsUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("team_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "No org" }, { status: 400 });

  const body = await req.json();
  const { data: existing } = await supabase
    .from("org_settings")
    .select("id")
    .eq("org_id", member.org_id)
    .maybeSingle();

  const patch = {
    default_ai_tone: body.default_ai_tone,
    ai_model: body.ai_model,
    max_monthly_tokens: body.max_monthly_tokens,
  };

  if (existing) {
    await supabase.from("org_settings").update(patch).eq("id", existing.id);
  } else {
    await supabase.from("org_settings").insert({ org_id: member.org_id, ...patch });
  }
  return NextResponse.json({ ok: true });
}
