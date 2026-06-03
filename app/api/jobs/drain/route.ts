import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  claimJobs,
  recoverStuckJobs,
  runJob,
  markDone,
  markFailed,
  enqueueSuccessors,
  deriveDocStatus,
} from "@/lib/jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

const BATCH = 8;

// Heartbeat endpoint. A driver (pg_cron, Vercel cron, or `npm run drain`)
// calls this on an interval. Each call recovers stuck claims, claims a small
// batch, runs the claimed jobs concurrently, and enqueues successors.
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  await recoverStuckJobs(admin);

  const claimed = await claimJobs(admin, BATCH);
  const touchedDocs = new Set<string>();

  // Run the claimed jobs concurrently — each is an independent unit of work
  // (different document or question), so there's no ordering dependency within
  // a batch. Successors are enqueued for the *next* drain pass to pick up.
  const results = await Promise.all(
    claimed.map(async (job) => {
      touchedDocs.add(job.document_id);
      try {
        await runJob(admin, job);
        // Enqueue successors BEFORE marking done. If this crashes mid-fan-out
        // (e.g. structure → N generate jobs), the stage stays claimed, gets
        // recovered, and re-runs — re-enqueue is idempotent (unique-live index).
        // Marking done first would leave a permanent gap: a "done" structure
        // with missing generate jobs that nothing ever revisits.
        await enqueueSuccessors(admin, job);
        await markDone(admin, job.id);
        return { id: job.id, stage: job.stage, ok: true };
      } catch (e: any) {
        await markFailed(admin, job, e?.message ?? "stage failed");
        return { id: job.id, stage: job.stage, ok: false, error: e?.message };
      }
    })
  );

  for (const documentId of touchedDocs) {
    await deriveDocStatus(admin, documentId);
  }

  return NextResponse.json({ claimed: claimed.length, results });
}
