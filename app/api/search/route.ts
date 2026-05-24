import { NextRequest, NextResponse } from "next/server";
import { requireMembership } from "@/utils/auth";

export async function GET(req: NextRequest) {
  const { supabase, member } = await requireMembership();
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  const pattern = `%${q}%`;

  const [{ data: deals }, { data: questions }, { data: kbDocs }] = await Promise.all([
    supabase
      .from("deals")
      .select("id, name, client_name, status")
      .eq("org_id", member.org_id)
      .or(`name.ilike.${pattern},client_name.ilike.${pattern}`)
      .limit(5),
    supabase
      .from("questions")
      .select("id, question_text, status, document_id, documents!inner(deal_id, deals!inner(id, name, org_id))")
      .ilike("question_text", pattern)
      .eq("documents.deals.org_id", member.org_id)
      .limit(10),
    supabase
      .from("knowledge_documents")
      .select("id, filename, doc_type, ingestion_status")
      .eq("org_id", member.org_id)
      .ilike("filename", pattern)
      .limit(5),
  ]);

  return NextResponse.json({
    results: {
      deals: deals ?? [],
      questions: questions ?? [],
      kbDocs: kbDocs ?? [],
    },
  });
}
