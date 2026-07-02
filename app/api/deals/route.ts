import { getClaimsUser } from "@/utils/auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { logActivity } from "@/utils/activity";
import { sanitizeCustomFields } from "@/lib/deal-fields-server";

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
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const custom_fields = await sanitizeCustomFields(supabase, member.org_id, body.custom_fields);

  const { data: deal, error } = await supabase
    .from("deals")
    .insert({
      org_id: member.org_id,
      name: body.name,
      client_name: body.client_name || null,
      value: body.value ?? null,
      due_date: body.due_date || null,
      owner_id: user.id,
      custom_fields,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity(supabase, {
    org_id: member.org_id,
    user_id: user.id,
    action: "created",
    entity_type: "deal",
    entity_id: deal.id,
    metadata: { name: deal.name },
  });

  return NextResponse.json({ deal });
}
