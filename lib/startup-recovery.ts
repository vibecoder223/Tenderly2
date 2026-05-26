/**
 * On boot, sweep documents and knowledge_documents that were left in an
 * in-progress state by a previous process. Next.js dev hot-reload (and any
 * server restart) kills in-flight background ingestion promises, leaving rows
 * stuck on "processing" or "extracting" forever. Mark them failed so the UI
 * can show the retry button.
 *
 * Runs once per process, lazily, on first import.
 */

import { tryCreateAdminClient } from "@/utils/supabase/admin";

let ran = false;

const STUCK_KB_STATUSES = ["processing"];
const STUCK_DOC_STATUSES = [
  "extracting",
  "chunked",
  "analyzing",
  "structured",
];

export async function runStartupRecovery(): Promise<void> {
  if (ran) return;
  ran = true;

  const admin = tryCreateAdminClient();
  if (!admin) return;

  // A row whose updated_at hasn't moved in N minutes while in a transient
  // state was almost certainly abandoned by a previous process.
  const STALE_MINUTES = 5;
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();

  try {
    const { data: stuckKb, error: kbErr } = await admin
      .from("knowledge_documents")
      .update({
        ingestion_status: "failed",
        error_message: "Ingestion interrupted by server restart. Click retry to resume.",
      })
      .in("ingestion_status", STUCK_KB_STATUSES)
      .lt("updated_at", cutoff)
      .select("id");

    if (kbErr) {
      console.warn("[startup-recovery] knowledge_documents sweep failed:", kbErr.message);
    } else if (stuckKb && stuckKb.length > 0) {
      console.log(`[startup-recovery] Reset ${stuckKb.length} stuck knowledge_document row(s).`);
    }

    const { data: stuckDocs, error: docErr } = await admin
      .from("documents")
      .update({
        processing_status: "failed",
        error_message: "Pipeline interrupted by server restart. Click retry to resume.",
      })
      .in("processing_status", STUCK_DOC_STATUSES)
      .lt("updated_at", cutoff)
      .select("id");

    if (docErr) {
      console.warn("[startup-recovery] documents sweep failed:", docErr.message);
    } else if (stuckDocs && stuckDocs.length > 0) {
      console.log(`[startup-recovery] Reset ${stuckDocs.length} stuck document row(s).`);
    }
  } catch (e: any) {
    console.warn("[startup-recovery] failed:", e.message);
  }
}
