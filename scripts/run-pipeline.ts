/**
 * One-shot script: re-run the extraction pipeline for a document.
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
import { runFullPipeline } from "../lib/agents";

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
    .select("id, deals(org_id, organizations(name))")
    .eq("id", docId)
    .maybeSingle();

  if (!doc) { console.error("Document not found"); process.exit(1); }

  const orgName = (doc as any).deals?.organizations?.name ?? "Workspace";
  console.log("Org:", orgName);

  try {
    await runFullPipeline(supabase as any, docId, { orgName });
    console.log("✓ Pipeline complete");
  } catch (e: any) {
    console.error("Pipeline error:", e.message);
    process.exit(1);
  }
}

main();
