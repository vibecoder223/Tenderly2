import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

// Marks the user's org as having dismissed the onboarding checklist.
// The checklist disappears from the dashboard until they hit Settings →
// "Restart setup checklist" (future).
export async function POST() {
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("team_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "No org" }, { status: 400 });

  const { error } = await supabase
    .from("organizations")
    .update({ onboarding_dismissed: true })
    .eq("id", member.org_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
