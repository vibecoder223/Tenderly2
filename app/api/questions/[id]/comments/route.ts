import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { body } = await req.json();
  if (!body || typeof body !== "string") {
    return NextResponse.json({ error: "body required" }, { status: 400 });
  }

  // Look up author name from team_members for display
  const { data: member } = await supabase
    .from("team_members")
    .select("name, email")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const { data: comment, error } = await supabase
    .from("question_comments")
    .insert({
      question_id: id,
      author_id: user.id,
      author_name: member?.name ?? member?.email ?? user.email ?? null,
      body: body.trim(),
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comment });
}
