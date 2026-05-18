import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { tryCreateAdminClient } from "@/utils/supabase/admin";
import PDFDocument from "pdfkit";
import { renderDocx, type ExportQuestion } from "@/lib/docx-export";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    deal_id?: string;
    document_id?: string;
    format?: "pdf" | "docx";
    citation_style?: "inline" | "footnote";
  };
  const { deal_id, document_id } = body;
  const format: "pdf" | "docx" = body.format === "docx" ? "docx" : "pdf";
  const citationStyle: "inline" | "footnote" =
    body.citation_style === "footnote" ? "footnote" : "inline";

  if (!deal_id || !document_id) {
    return NextResponse.json({ error: "deal_id and document_id required" }, { status: 400 });
  }

  const { data: deal } = await supabase
    .from("deals")
    .select("id, name, client_name, organizations(name)")
    .eq("id", deal_id)
    .maybeSingle();
  if (!deal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: questions } = await supabase
    .from("questions")
    .select(
      "requirement_id, question_text, responses(id, final_text, draft_text, status, gap_flag, citations(document_filename, page, section_path))"
    )
    .eq("document_id", document_id)
    .order("created_at", { ascending: true });

  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: "Nothing to export" }, { status: 400 });
  }

  const exportable: ExportQuestion[] = (questions as any[]).map((q) => {
    const approved = (q.responses ?? []).find((r: any) => r.status === "approved");
    const r = approved ?? (q.responses ?? [])[0];
    const answer = r?.final_text || r?.draft_text || "(no response)";
    const citations = (r?.citations ?? []).map((c: any) => ({
      document_filename: c.document_filename,
      page: c.page,
    }));
    return {
      requirement_id: q.requirement_id,
      question_text: q.question_text,
      answer,
      citations,
      gap_flag: (r?.gap_flag ?? null) as ExportQuestion["gap_flag"],
    };
  });

  const orgName = (deal as any).organizations?.name ?? null;
  let buf: Buffer;
  let contentType: string;
  let ext: string;

  if (format === "docx") {
    buf = await renderDocx(exportable, {
      deal_name: deal.name,
      client_name: deal.client_name,
      org_name: orgName,
      citation_style: citationStyle,
    });
    contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    ext = "docx";
  } else {
    buf = await renderPdf(exportable, {
      deal_name: deal.name,
      client_name: deal.client_name,
      org_name: orgName,
      citation_style: citationStyle,
    });
    contentType = "application/pdf";
    ext = "pdf";
  }

  const storage = (tryCreateAdminClient() ?? supabase).storage.from("documents");
  const path = `${deal_id}/export-${Date.now()}.${ext}`;
  const { error: upErr } = await storage.upload(path, buf, {
    contentType,
    upsert: false,
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: row, error: insertErr } = await supabase
    .from("exports")
    .insert({
      deal_id,
      document_id,
      file_path: path,
      format: ext,
      created_by: user.id,
    })
    .select()
    .single();
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  await supabase.from("deals").update({ status: "responded" }).eq("id", deal_id);

  return NextResponse.json({ exportId: row.id, format: ext });
}

async function renderPdf(
  questions: ExportQuestion[],
  opts: {
    deal_name: string;
    client_name: string | null;
    org_name: string | null;
    citation_style: "inline" | "footnote";
  }
): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 56, size: "LETTER" });
    const chunks: Buffer[] = [];
    doc.on("data", (b) => chunks.push(b as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).fillColor("#0F1626").text(`RFP Response`, { align: "left" });
    doc.moveDown(0.2);
    doc.fontSize(13).fillColor("#5B6478").text(opts.deal_name);
    if (opts.client_name) {
      doc.moveDown(0.1);
      doc.fontSize(11).fillColor("#8A93A6").text(`Prepared for ${opts.client_name}`);
    }
    if (opts.org_name) {
      doc.moveDown(0.1);
      doc.fontSize(11).fillColor("#8A93A6").text(`Submitted by ${opts.org_name}`);
    }
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor("#8A93A6").text(new Date().toLocaleDateString());
    doc.moveDown(1.5);

    for (const q of questions) {
      doc.fontSize(11).fillColor("#3B47D6").text(q.requirement_id ?? "", { continued: false });
      doc.moveDown(0.15);
      doc.fontSize(12.5).fillColor("#0F1626").text(q.question_text);
      doc.moveDown(0.35);
      if (q.gap_flag === "no_source") {
        doc
          .fontSize(11)
          .fillColor("#C0392B")
          .text(
            "No source found in the knowledge base. Human review required before submission.",
            { align: "left" }
          );
      } else {
        doc.fontSize(11).fillColor("#2A3245").text(q.answer, { align: "justify" });
        if (opts.citation_style === "inline" && q.citations.length > 0) {
          const inline = q.citations
            .map((c) => `[Source: ${c.document_filename}${c.page != null ? `, p.${c.page}` : ""}]`)
            .join(" ");
          doc.moveDown(0.2);
          doc.fontSize(9.5).fillColor("#5B6478").text(inline);
        }
      }
      doc.moveDown(1);
    }
    doc.end();
  });
}
