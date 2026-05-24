import { NextRequest, NextResponse } from "next/server";
import { requireMembership } from "@/utils/auth";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { supabase, member, user } = await requireMembership();

  const { data: deal, error } = await supabase
    .from("deals")
    .select("name, client_name, status, value, due_date, owner_id")
    .eq("id", id)
    .eq("org_id", member.org_id)
    .maybeSingle();

  if (error || !deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  const { data: newDeal, error: insertErr } = await supabase
    .from("deals")
    .insert({
      org_id: member.org_id,
      name: `${deal.name} (copy)`,
      client_name: deal.client_name,
      status: "new",
      value: deal.value,
      due_date: deal.due_date,
      owner_id: user.id,
    })
    .select("id")
    .single();

  if (insertErr || !newDeal) {
    return NextResponse.json({ error: "Failed to clone deal" }, { status: 500 });
  }

  return NextResponse.json({ deal: newDeal });
}
