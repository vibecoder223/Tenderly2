import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { tryCreateAdminClient } from "@/utils/supabase/admin";
import PDFDocument from "pdfkit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { deal_id, document_id } = await req.json();
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
    .select("requirement_id, question_text, responses(final_text, draft_text, status)")
    .eq("document_id", document_id)
    .order("created_at", { ascending: true });

  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: "Nothing to export" }, { status: 400 });
  }

  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 56, size: "LETTER" });
    const chunks: Buffer[] = [];
    doc.on("data", (b) => chunks.push(b as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const orgName = (deal as any).organizations?.name ?? "";

    doc.fontSize(20).fillColor("#0F1626").text(`RFP Response`, { align: "left" });
    doc.moveDown(0.2);
    doc.fontSize(13).fillColor("#5B6478").text(deal.name);
    if (deal.client_name) {
      doc.moveDown(0.1);
      doc.fontSize(11).fillColor("#8A93A6").text(`Prepared for ${deal.client_name}`);
    }
    if (orgName) {
      doc.moveDown(0.1);
      doc.fontSize(11).fillColor("#8A93A6").text(`Submitted by ${orgName}`);
    }
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor("#8A93A6").text(new Date().toLocaleDateString());
    doc.moveDown(1.5);

    for (const q of questions as any[]) {
      const text =
        q.responses?.find((r: any) => r.status === "approved")?.final_text ??
        q.responses?.[0]?.draft_text ??
        "(no response)";

      doc.fontSize(11).fillColor("#3B47D6").text(q.requirement_id ?? "", { continued: false });
      doc.moveDown(0.15);
      doc.fontSize(12.5).fillColor("#0F1626").text(q.question_text);
      doc.moveDown(0.35);
      doc.fontSize(11).fillColor("#2A3245").text(text, { align: "justify" });
      doc.moveDown(1);
    }

    doc.end();
  });

  const storage = (tryCreateAdminClient() ?? supabase).storage.from("documents");
  const path = `${deal_id}/export-${Date.now()}.pdf`;
  const { error: upErr } = await storage.upload(path, pdfBuffer, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: row, error: insertErr } = await supabase
    .from("exports")
    .insert({
      deal_id,
      document_id,
      file_path: path,
      format: "pdf",
      created_by: user.id,
    })
    .select()
    .single();
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  await supabase.from("deals").update({ status: "responded" }).eq("id", deal_id);

  return NextResponse.json({ exportId: row.id });
}
