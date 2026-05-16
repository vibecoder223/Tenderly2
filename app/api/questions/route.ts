import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { document_id, requirement_id, question_text, category, priority } = await req.json();
  if (!document_id || !question_text) {
    return NextResponse.json({ error: "document_id and question_text required" }, { status: 400 });
  }

  // RLS gates this — only org members can insert
  const { data: question, error } = await supabase
    .from("questions")
    .insert({
      document_id,
      requirement_id: requirement_id || null,
      question_text,
      category: category || null,
      priority: priority || "medium",
      status: "pending",
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also create a matching requirement + matrix row so the triage view stays consistent
  await supabase.from("extracted_requirements").insert({
    document_id,
    requirement_id: requirement_id || null,
    title: question_text.slice(0, 120),
    description: question_text,
    category: category || null,
    priority: priority || "medium",
    is_mandatory: false,
  });
  await supabase.from("compliance_matrix").insert({
    document_id,
    requirement_id: requirement_id || null,
    compliance_status: "pending",
  });

  return NextResponse.json({ question });
}
