/**
 * Job queue for the async, resumable document pipeline.
 *
 * Each stage is an idempotent row in `jobs` (migration 0010). The drain
 * endpoint claims a small batch, runs one stage per row, then enqueues the
 * successor stage(s). A failed unit retries with backoff on its own; it never
 * re-runs the whole document. See docs/superpowers/specs/2026-05-30-async-pipeline-design.md.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  runIngestionAgent,
  runChunkingAgent,
  runExtractionAgent,
  runStructuringAgent,
} from "./agents";
import { generateAndPersistAnswer } from "./rag";

export type JobStage = "ingest" | "extract" | "structure" | "generate";
export type JobStatus = "pending" | "claimed" | "done" | "failed" | "dead";

export type Job = {
  id: string;
  document_id: string;
  org_id: string;
  stage: JobStage;
  target_id: string | null;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
};

type DocRow = {
  id: string;
  deal_id: string;
  filename: string;
  file_path: string;
  mime_type: string | null;
  extracted_text: string | null;
};

// Reuse the agent functions' exact parameter shapes without exporting internals.
type ProducedChunk = Parameters<typeof runExtractionAgent>[2][number];
type ExtractedReq = Parameters<typeof runStructuringAgent>[2][number];

const PG_UNIQUE_VIOLATION = "23505";

// ---------- enqueue ----------

/** Insert a job, ignoring the unique-violation when a live row already exists. */
export async function enqueueJob(
  admin: SupabaseClient,
  args: { documentId: string; orgId: string; stage: JobStage; targetId?: string | null }
): Promise<void> {
  const { error } = await admin.from("jobs").insert({
    document_id: args.documentId,
    org_id: args.orgId,
    stage: args.stage,
    target_id: args.targetId ?? null,
  });
  if (error && error.code !== PG_UNIQUE_VIOLATION) throw new Error(`enqueue failed: ${error.message}`);
}

/** Kick off a document by queuing its first stage. */
export async function enqueueIngest(
  admin: SupabaseClient,
  args: { documentId: string; orgId: string }
): Promise<void> {
  await enqueueJob(admin, { ...args, stage: "ingest" });
}

// ---------- claim / drain primitives ----------

export async function recoverStuckJobs(admin: SupabaseClient): Promise<void> {
  const { error } = await admin.rpc("recover_stuck_jobs");
  if (error) throw new Error(`recover_stuck_jobs: ${error.message}`);
}

export async function claimJobs(admin: SupabaseClient, limit: number): Promise<Job[]> {
  const { data, error } = await admin.rpc("claim_jobs", { p_limit: limit });
  if (error) throw new Error(`claim_jobs: ${error.message}`);
  return (data ?? []) as Job[];
}

/** Retry backoff in ms, indexed by attempt count just made. */
function backoffMs(attempts: number): number {
  return [5_000, 30_000, 120_000][attempts - 1] ?? 120_000;
}

export async function markDone(admin: SupabaseClient, jobId: string): Promise<void> {
  await admin.from("jobs").update({ status: "done", updated_at: new Date().toISOString() }).eq("id", jobId);
}

/** Failed unit: re-queue with backoff, or bury as 'dead' once attempts exhausted. */
export async function markFailed(admin: SupabaseClient, job: Job, message: string): Promise<void> {
  const dead = job.attempts >= job.max_attempts;
  await admin
    .from("jobs")
    .update({
      status: dead ? "dead" : "pending",
      error: message.slice(0, 1000),
      run_after: dead ? new Date().toISOString() : new Date(Date.now() + backoffMs(job.attempts)).toISOString(),
      lease_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);
}

// ---------- stage dispatch ----------

async function loadDoc(admin: SupabaseClient, documentId: string): Promise<DocRow> {
  const { data, error } = await admin
    .from("documents")
    .select("id, deal_id, filename, file_path, mime_type, extracted_text")
    .eq("id", documentId)
    .single();
  if (error || !data) throw new Error(error?.message || "Document not found");
  return data as DocRow;
}

/** Run one job's stage. Throws on failure (drain decides retry vs dead). */
export async function runJob(admin: SupabaseClient, job: Job): Promise<void> {
  const doc = await loadDoc(admin, job.document_id);

  switch (job.stage) {
    case "ingest": {
      // Deterministic from the file: parse → chunk → embed, all persisted.
      const parsed = await runIngestionAgent(admin, doc);
      await runChunkingAgent(admin, doc, parsed);
      return;
    }
    case "extract": {
      const chunks = await readChunks(admin, job.document_id);
      await runExtractionAgent(admin, doc, chunks);
      return;
    }
    case "structure": {
      const reqs = await readRequirements(admin, job.document_id);
      await runStructuringAgent(admin, doc, reqs);
      return;
    }
    case "generate": {
      if (!job.target_id) throw new Error("generate job missing target_id (question_id)");
      await runGenerate(admin, job);
      return;
    }
  }
}

/**
 * Enqueue the next stage(s) after a job completes. Idempotent — duplicate
 * inserts are swallowed by the unique-live index.
 */
export async function enqueueSuccessors(admin: SupabaseClient, job: Job): Promise<void> {
  const base = { documentId: job.document_id, orgId: job.org_id };
  switch (job.stage) {
    case "ingest":
      await enqueueJob(admin, { ...base, stage: "extract" });
      return;
    case "extract":
      await enqueueJob(admin, { ...base, stage: "structure" });
      return;
    case "structure": {
      // Fan out: one generate job per question on this document.
      const { data: questions } = await admin
        .from("questions")
        .select("id")
        .eq("document_id", job.document_id);
      for (const q of questions ?? []) {
        await enqueueJob(admin, { ...base, stage: "generate", targetId: (q as { id: string }).id });
      }
      return;
    }
    case "generate":
      return;
  }
}

// ---------- derived document status ----------

const STAGE_RUNNING_STATUS: Record<JobStage, string> = {
  ingest: "extracting",
  extract: "analyzing",
  structure: "analyzing",
  generate: "structured",
};

const STAGE_DEAD_STATUS: Record<JobStage, string> = {
  ingest: "failed",
  extract: "extraction_failed",
  structure: "failed",
  generate: "generation_failed",
};

const STAGE_ORDER: JobStage[] = ["ingest", "extract", "structure", "generate"];

/** Recompute documents.processing_status from the document's job rows. */
export async function deriveDocStatus(admin: SupabaseClient, documentId: string): Promise<void> {
  const { data: rows } = await admin
    .from("jobs")
    .select("stage, status")
    .eq("document_id", documentId);
  const jobs = (rows ?? []) as { stage: JobStage; status: JobStatus }[];
  if (jobs.length === 0) return;

  let status: string;
  const dead = jobs.filter((j) => j.status === "dead");
  const active = jobs.filter((j) => j.status === "pending" || j.status === "claimed");

  // A dead PRE-generate stage (ingest/extract/structure) blocks everything
  // downstream — that's a genuine hard fail. A dead *generate* job only kills
  // one question's answer; the document is still usable if other questions
  // succeeded. Never let one dead answer condemn the whole document.
  const blockingDead = dead.find((j) => j.stage !== "generate");
  const genJobs = jobs.filter((j) => j.stage === "generate");
  const genDone = genJobs.filter((j) => j.status === "done");

  if (blockingDead) {
    status = STAGE_DEAD_STATUS[blockingDead.stage];
  } else if (active.length > 0) {
    // Coarse phase = the earliest stage with active work.
    const stage = STAGE_ORDER.find((s) => active.some((j) => j.stage === s)) ?? "generate";
    status = STAGE_RUNNING_STATUS[stage];
  } else if (genJobs.length > 0 && genDone.length === 0) {
    // Every answer failed — nothing usable produced.
    status = STAGE_DEAD_STATUS.generate;
  } else {
    // No active work, no blocking failure, at least one answer produced.
    // Completed — possibly partial (some generate jobs may be dead).
    status = "completed";
  }

  await admin
    .from("documents")
    .update({ processing_status: status, updated_at: new Date().toISOString() })
    .eq("id", documentId);
}

// ---------- helpers ----------

async function readChunks(admin: SupabaseClient, documentId: string): Promise<ProducedChunk[]> {
  const { data, error } = await admin
    .from("document_chunks")
    .select("raw_text, cleaned_text, section_path, page_start, page_end, sparse_terms")
    .eq("document_id", documentId)
    .order("chunk_index", { ascending: true });
  if (error) throw new Error(`readChunks: ${error.message}`);
  return (data ?? []).map((r: any) => ({
    text: r.cleaned_text ?? r.raw_text ?? "",
    text_for_embedding: r.cleaned_text ?? r.raw_text ?? "",
    section_path: r.section_path ?? "",
    page_start: r.page_start ?? 0,
    page_end: r.page_end ?? r.page_start ?? 0,
    sparse_terms: (r.sparse_terms as string[] | null) ?? [],
  }));
}

async function readRequirements(admin: SupabaseClient, documentId: string): Promise<ExtractedReq[]> {
  const { data, error } = await admin
    .from("extracted_requirements")
    .select("requirement_id, description, section, source_page, classification, topic")
    .eq("document_id", documentId);
  if (error) throw new Error(`readRequirements: ${error.message}`);
  return (data ?? []).map((r: any) => ({
    requirement_id: String(r.requirement_id ?? ""),
    section: r.section ?? null,
    text: r.description ?? "",
    classification: r.classification ?? "must",
    topic: r.topic ?? "technical",
    source_page: r.source_page ?? null,
  })) as ExtractedReq[];
}

async function runGenerate(admin: SupabaseClient, job: Job): Promise<void> {
  const { data: q, error } = await admin
    .from("questions")
    .select("id, question_text, documents(deals(organizations(name)))")
    .eq("id", job.target_id!)
    .single();
  if (error || !q) throw new Error(error?.message || "Question not found");
  const orgName =
    (q as any).documents?.deals?.organizations?.name ??
    (q as any).documents?.deals?.[0]?.organizations?.[0]?.name ??
    "Workspace";
  await generateAndPersistAnswer(admin, {
    question_id: (q as any).id,
    question_text: (q as any).question_text,
    org_id: job.org_id,
    org_name: orgName,
    tone: "technical",
  });
}
