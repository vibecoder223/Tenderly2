import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { tryCreateAdminClient } from "@/utils/supabase/admin";

export const runtime = "nodejs";

// Streams the logo image bytes so the templates UI can preview it.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("team_members").select("org_id").eq("user_id", user.id).maybeSingle();
  if (!member) return NextResponse.json({ error: "No org" }, { status: 400 });

  const { data: tpl } = await supabase
    .from("proposal_templates")
    .select("logo_path")
    .eq("id", id)
    .eq("org_id", member.org_id)
    .maybeSingle();
  if (!tpl?.logo_path) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const reader = (tryCreateAdminClient() ?? supabase).storage.from("templates");
  const { data: blob, error } = await reader.download(tpl.logo_path);
  if (error || !blob) return NextResponse.json({ error: "Logo missing" }, { status: 404 });

  const ext = tpl.logo_path.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const arr = new Uint8Array(await blob.arrayBuffer());
  return new NextResponse(arr, {
    headers: {
      "Content-Type": ext,
      "Cache-Control": "private, max-age=60",
    },
  });
}
