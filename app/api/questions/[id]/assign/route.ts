import { getClaimsUser } from "@/utils/auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { tryCreateAdminClient } from "@/utils/supabase/admin";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient(await cookies());
  const user = await getClaimsUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("team_members").select("org_id").eq("user_id", user.id).maybeSingle();
  if (!member) return NextResponse.json({ error: "No org" }, { status: 400 });

  // Confirm the question belongs to a deal in the caller's org under RLS.
  const { data: q } = await supabase
    .from("questions")
    .select("id, document_id, documents!inner(deal_id, deals!inner(org_id))")
    .eq("id", id)
    .maybeSingle();
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { user_id } = await req.json().catch(() => ({}));

  // If a user_id is given, validate they're in the same org.
  if (user_id) {
    const { data: target } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("org_id", member.org_id)
      .eq("user_id", user_id)
      .maybeSingle();
    if (!target) return NextResponse.json({ error: "User not in org" }, { status: 400 });
  }

  // Use admin to ensure the write lands (the RLS policy via documents→deals
  // join can silently drop updates if any intermediate row is filtered out).
  const writer = tryCreateAdminClient() ?? supabase;
  const { data, error } = await writer
    .from("questions")
    .update({ assigned_to: user_id || null })
    .eq("id", id)
    .select("id, assigned_to")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, question: data });
}
