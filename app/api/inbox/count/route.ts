import { NextResponse } from "next/server";
import { requireMembership } from "@/utils/auth";

export async function GET() {
  const { supabase, user } = await requireMembership();

  const { count } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("assigned_to", user.id)
    .not("status", "eq", "approved");

  return NextResponse.json({ count: count ?? 0 });
}
