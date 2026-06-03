/**
 * One-shot script: re-run the pipeline for a document by driving the job queue
 * locally — enqueue ingest, then drain stage-by-stage until no work remains.
 * Mirrors the production drain loop (lib/jobs.ts).
 * Usage: npx tsx scripts/run-pipeline.ts <document_id>
 */
import { readFileSync } from "fs";
// Parse .env.local manually — no dotenv dep needed
const envFile = readFileSync(".env.local", "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

import { createClient } from "@supabase/supabase-js";
import {
  enqueueIngest,
  claimJobs,
  runJob,
  enqueueSuccessors,
  markDone,
  markFailed,
  deriveDocStatus,
} from "../lib/jobs";

const docId = process.argv[2];
if (!docId) { console.error("Usage: npx tsx scripts/run-pipeline.ts <document_id>"); process.exit(1); }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

console.log(`Running pipeline for document ${docId} …`);

async function main() {
  const { data: doc } = await supabase
    .from("documents")
    .select("id, deals(org_id)")
    .eq("id", docId)
    .maybeSingle();
  if (!doc) { console.error("Document not found"); process.exit(1); }

  const orgId = (doc as any).deals?.org_id ?? null;
  if (!orgId) { console.error("Org not resolved for document"); process.exit(1); }

  // Clean slate, then queue the first stage.
  await supabase.from("jobs").delete().eq("document_id", docId);
  await enqueueIngest(supabase as any, { documentId: docId, orgId });

  // Drain: claim → run → advance, until the doc has no pending/claimed jobs.
  for (let pass = 0; pass < 500; pass++) {
    const jobs = await claimJobs(supabase as any, 5);
    if (jobs.length === 0) {
      const { count } = await supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("document_id", docId)
        .in("status", ["pending", "claimed"]);
      if (!count) break; // nothing left to do
      await new Promise((r) => setTimeout(r, 1000)); // wait out a backoff window
      continue;
    }
    for (const job of jobs) {
      try {
        await runJob(supabase as any, job);
        await markDone(supabase as any, job.id);
        await enqueueSuccessors(supabase as any, job);
        console.log(`✓ ${job.stage}${job.target_id ? ` (${job.target_id})` : ""}`);
      } catch (e: any) {
        await markFailed(supabase as any, job, e.message);
        console.warn(`✗ ${job.stage}: ${e.message}`);
      }
    }
    await deriveDocStatus(supabase as any, docId);
  }

  await deriveDocStatus(supabase as any, docId);
  const { data: final } = await supabase
    .from("documents").select("processing_status").eq("id", docId).maybeSingle();
  console.log(`✓ Pipeline drained — status: ${(final as any)?.processing_status}`);
}

main();
