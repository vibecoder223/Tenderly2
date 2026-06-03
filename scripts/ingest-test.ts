/**
 * Manual end-to-end ingestion test. NOT part of the app.
 *   npx tsx scripts/ingest-test.ts
 * Uploads RFP Response.docx → knowledge base (grounding) and RFP-Test.docx →
 * deal document (question extraction), runs both pipelines, prints results.
 */
import { readFileSync } from "fs";
import { basename } from "path";

const envFile = readFileSync(".env.local", "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

import { createClient } from "@supabase/supabase-js";
import { ingestKnowledgeDocument } from "../lib/ingest";
import { enqueueIngest } from "../lib/jobs";

const ORG = "c1e2a467-5788-42c6-8b29-dd9b43266612";
const USER = "1ccc300b-0da6-4862-bc69-529cc17a018c";
const KB_FILE = "/Users/khalifa/Downloads/RFP Response.docx";
const RFP_FILE = "/Users/khalifa/Downloads/RFP-Test.docx";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DRAIN_URL = "http://localhost:3000/api/jobs/drain";
const CRON = process.env.CRON_SECRET!;

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function log(...a: any[]) {
  console.log(...a);
}

async function ingestKB() {
  log("\n=== KB INGEST: RFP Response.docx ===");
  const filename = basename(KB_FILE);

  // Fresh test: remove any prior copies of this KB doc (+ their chunks) so we
  // exercise parse→chunk→embed instead of the dedup short-circuit.
  const { data: prior } = await sb
    .from("knowledge_documents")
    .select("id")
    .eq("org_id", ORG)
    .eq("filename", filename);
  for (const p of prior ?? []) {
    await sb.from("document_chunks").delete().eq("knowledge_document_id", p.id);
    await sb.from("knowledge_documents").delete().eq("id", p.id);
  }
  log(`cleared ${prior?.length ?? 0} prior KB copies`);

  const bytes = readFileSync(KB_FILE);
  const objectPath = `${ORG}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const up = await sb.storage.from("knowledge").upload(objectPath, bytes, {
    contentType: DOCX_MIME,
    upsert: false,
  });
  if (up.error) throw new Error(`KB upload: ${up.error.message}`);

  const { data: row, error } = await sb
    .from("knowledge_documents")
    .insert({
      org_id: ORG,
      filename,
      file_path: objectPath,
      file_size: bytes.length,
      mime_type: DOCX_MIME,
      doc_type: "past_proposal",
      ingestion_status: "pending",
      uploaded_by: USER,
    })
    .select()
    .single();
  if (error) throw new Error(`KB row insert: ${error.message}`);

  const result = await ingestKnowledgeDocument(sb as any, {
    id: row.id,
    org_id: row.org_id,
    filename: row.filename,
    file_path: row.file_path,
    mime_type: row.mime_type,
  });
  log("KB result:", JSON.stringify(result));
  log("KB doc id:", row.id);
  return row.id as string;
}

async function uploadRFP() {
  log("\n=== DEAL DOC UPLOAD: RFP-Test.docx ===");
  const bytes = readFileSync(RFP_FILE);
  const filename = basename(RFP_FILE);
  const objectPath = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  // attach to a fresh deal so the test is isolated
  const { data: deal, error: dErr } = await sb
    .from("deals")
    .insert({ org_id: ORG, name: "Ingestion Test", client_name: "Test", status: "new", owner_id: USER })
    .select()
    .single();
  if (dErr) throw new Error(`deal insert: ${dErr.message}`);

  const path = `${deal.id}/${objectPath}`;
  const up = await sb.storage.from("documents").upload(path, bytes, {
    contentType: DOCX_MIME,
    upsert: false,
  });
  if (up.error) throw new Error(`RFP upload: ${up.error.message}`);

  const { data: doc, error } = await sb
    .from("documents")
    .insert({
      deal_id: deal.id,
      filename,
      file_path: path,
      file_size: bytes.length,
      mime_type: DOCX_MIME,
      processing_status: "queued",
    })
    .select()
    .single();
  if (error) throw new Error(`doc insert: ${error.message}`);

  await sb.from("jobs").delete().eq("document_id", doc.id);
  await enqueueIngest(sb as any, { documentId: doc.id, orgId: ORG });
  log("Deal:", deal.id, "Doc:", doc.id, "→ ingest queued");
  return doc.id as string;
}

async function drainUntilDone(docId: string) {
  log("\n=== DRAINING PIPELINE ===");
  for (let i = 0; i < 40; i++) {
    const res = await fetch(DRAIN_URL, { method: "POST", headers: { "x-cron-secret": CRON } });
    const j = await res.json();
    const { count } = await sb
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("document_id", docId)
      .in("status", ["pending", "running"]);
    log(`  tick ${i}: claimed=${j.claimed ?? 0} remaining=${count ?? 0}`);
    if ((count ?? 0) === 0 && (j.claimed ?? 0) === 0) break;
  }
}

async function report(docId: string, kbId: string) {
  log("\n=== RESULTS ===");
  const { data: jobs } = await sb
    .from("jobs")
    .select("stage,status")
    .eq("document_id", docId);
  log("jobs:", JSON.stringify(jobs));

  const { count: qCount } = await sb
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("document_id", docId);
  log("questions extracted:", qCount);

  const { data: qs } = await sb
    .from("questions")
    .select("id,question_text")
    .eq("document_id", docId)
    .limit(50);

  const qids = (qs ?? []).map((q) => q.id);
  const { data: resp } = await sb
    .from("responses")
    .select("id,question_id,status,confidence,gap_flag,draft_text")
    .in("question_id", qids.length ? qids : ["00000000-0000-0000-0000-000000000000"]);

  const byQ = new Map((resp ?? []).map((r) => [r.question_id, r]));
  let ok = 0, gap = 0;
  for (const q of qs ?? []) {
    const r: any = byQ.get(q.id);
    const cite = r
      ? (await sb.from("citations").select("id", { count: "exact", head: true }).eq("response_id", r.id)).count
      : 0;
    if (r && r.gap_flag === "ok") ok++; else gap++;
    log(
      `\n  Q: ${q.question_text.slice(0, 90)}\n     status=${r?.status} gap=${r?.gap_flag} conf=${r?.confidence} cites=${cite}\n     A: ${(r?.draft_text ?? "(none)").slice(0, 160).replace(/\n/g, " ")}`
    );
  }
  log(`\n  SUMMARY: ${qs?.length ?? 0} questions, ${ok} grounded(ok), ${gap} gap/other`);
}

async function main() {
  const kbId = await ingestKB();
  const docId = await uploadRFP();
  await drainUntilDone(docId);
  await report(docId, kbId);
  log("\n✓ done");
}
main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
