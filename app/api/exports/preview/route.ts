import { getClaimsUser } from "@/utils/auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const supabase = createClient(await cookies());
  const user = await getClaimsUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const dealId = searchParams.get("deal_id");
  const docIds = searchParams.getAll("doc_id");
  const merge = searchParams.get("merge") === "1";
  const citationStyle = searchParams.get("citation_style") === "footnote" ? "footnote" : "inline";

  if (!dealId || docIds.length === 0) {
    return NextResponse.json({ error: "deal_id and doc_id required" }, { status: 400 });
  }

  const { data: deal } = await supabase
    .from("deals")
    .select("id, name, client_name, organizations(name)")
    .eq("id", dealId)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: docRows } = await supabase
    .from("documents")
    .select("id, filename, created_at")
    .in("id", docIds)
    .order("created_at", { ascending: true });
  const docs = docRows ?? [];

  const { data: questionsRaw } = await supabase
    .from("questions")
    .select(
      "id, document_id, requirement_id, question_text, created_at, responses(id, final_text, draft_text, status, gap_flag, citations(document_filename, page))"
    )
    .in("document_id", docIds)
    .order("created_at", { ascending: true });
  const questions = (questionsRaw ?? []) as any[];

  type PreviewItem = {
    requirement_id: string | null;
    question_text: string;
    answer: string;
    gap_flag: string | null;
    has_approved: boolean;
    citations: { document_filename: string; page: number | null }[];
  };

  function toItem(q: any): PreviewItem {
    const approved = (q.responses ?? []).find((r: any) => r.status === "approved");
    const first = (q.responses ?? [])[0];
    const r = approved ?? first;
    return {
      requirement_id: q.requirement_id ?? null,
      question_text: q.question_text,
      answer: r?.final_text || r?.draft_text || "(no response yet)",
      gap_flag: r?.gap_flag ?? null,
      has_approved: !!approved,
      citations: (r?.citations ?? []).map((c: any) => ({
        document_filename: c.document_filename,
        page: c.page ?? null,
      })),
    };
  }

  const byDoc = new Map<string, any[]>();
  for (const d of docs) byDoc.set(d.id, []);
  for (const q of questions) {
    if (!byDoc.has(q.document_id)) byDoc.set(q.document_id, []);
    byDoc.get(q.document_id)!.push(q);
  }

  const sections = docs.map((d) => ({
    heading: d.filename,
    items: (byDoc.get(d.id) ?? []).map(toItem),
  }));

  const totalItems = sections.reduce((s, sec) => s + sec.items.length, 0);
  const approvedItems = sections.reduce(
    (s, sec) => s + sec.items.filter((i) => i.has_approved).length,
    0
  );
  const gapItems = sections.reduce(
    (s, sec) => s + sec.items.filter((i) => i.gap_flag === "no_source").length,
    0
  );

  return NextResponse.json({
    deal_name: deal.name,
    client_name: (deal as any).client_name ?? null,
    org_name: (deal as any).organizations?.name ?? null,
    citation_style: citationStyle,
    merge,
    stats: { total: totalItems, approved: approvedItems, gaps: gapItems },
    sections,
  });
}
