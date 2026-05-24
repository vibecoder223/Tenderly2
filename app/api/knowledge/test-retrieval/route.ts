import { NextRequest, NextResponse } from "next/server";
import { requireMembership } from "@/utils/auth";
import { retrieveForQuery } from "@/lib/retrieval";

export async function POST(req: NextRequest) {
  const { supabase, member } = await requireMembership();
  const { query } = await req.json().catch(() => ({}));
  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "query required" }, { status: 400 });
  }

  const result = await retrieveForQuery(supabase, {
    org_id: member.org_id,
    query: query.trim(),
    topK: 5,
  });

  return NextResponse.json(result);
}
