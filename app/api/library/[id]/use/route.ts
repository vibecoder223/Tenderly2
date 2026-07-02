import { getClaimsUser } from "@/utils/auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

// Record a reuse: bump usage_count + last_used_at. Called when a user accepts a
// suggested answer. Best-effort; never fails the caller's draft action.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient(await cookies());
  const user = await getClaimsUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: row } = await supabase
    .from("response_library")
    .select("usage_count")
    .eq("id", id)
    .maybeSingle();

  await supabase
    .from("response_library")
    .update({
      usage_count: (row?.usage_count ?? 0) + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
