# Async, Resumable Document Pipeline — Design

**Date:** 2026-05-30
**Status:** Approved for planning
**Author:** Khalifa (with Claude)

## Problem

The full document pipeline (ingest → chunk → embed → extract → structure → generate)
runs **synchronously inside one HTTP POST**. `lib/agents.ts:runFullPipeline` executes
every stage inline; `app/api/documents/process/route.ts` caps the request at
`maxDuration = 300`.

Consequences:

- **Timeouts.** A real RFP (50–200 requirements) exceeds the 300s budget. Generation
  fans out one LLM call per question — easily minutes of wall-clock.
- **All-or-nothing.** A throw on question 47 marks the whole document
  `generation_failed`. Questions 1–46 are discarded. No resume.
- **No progress.** The user watches a spinner with no signal, or the request dies.
- **Coupled UX.** Upload responsiveness is hostage to the entire pipeline finishing.

## Goal

Make the pipeline **asynchronous and resumable**: enqueue work, return immediately,
drain it in small idempotent units, retry failures per-unit, surface live progress.
A failure in one question must not fail the document.

## Non-goals

- Retrieval / grounding quality (the fake citation-count confidence, faked citation
  quotes) — separate thread.
- Cross-tenant voice-example leak — separate thread, already spawned.
- Single-question **regenerate** stays inline (user-initiated, waits on one answer).
- Migrating off serverless. The design stays host-agnostic.

## Core idea

**Resumability lives in a Postgres `jobs` table, not in the runtime.** Once each stage
is an idempotent row, *whatever* drains the table (pg_cron, Vercel cron, a Node worker)
is a thin, swappable driver. The host decision is deferred and reversible.

```
Upload ─▶ enqueue ingest job ─▶ return 200 (instant)

   [every 30s] pg_cron ─▶ POST /api/jobs/drain
                              │ claim N pending rows (FOR UPDATE SKIP LOCKED)
                              │ run one stage handler each
                              └ on success: mark done + enqueue successor(s)
                                on failure: retry w/ backoff → dead after max

Stage chain (each handler enqueues the next on success):

   ingest → chunk → extract → structure ─┬─▶ generate(Q1)
                                         ├─▶ generate(Q2)   fan-out,
                                         └─▶ generate(Qn)     one row per question
```

Resume is free: `generate(Q47)` dies → only that row retries; Q1–Q46 stay `done`.

## Data model

```sql
create type job_stage  as enum ('ingest','chunk','extract','structure','generate');
create type job_status as enum ('pending','claimed','done','failed','dead');

create table jobs (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  org_id       uuid not null,
  stage        job_stage  not null,
  target_id    uuid,                        -- question_id for 'generate'; null for doc-level stages
  status       job_status not null default 'pending',
  attempts     int  not null default 0,
  max_attempts int  not null default 3,
  run_after    timestamptz not null default now(),  -- backoff gate
  lease_until  timestamptz,                          -- stuck-claim recovery
  error        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index jobs_claimable_idx on jobs (status, run_after);
create index jobs_document_idx  on jobs (document_id);

-- Idempotent enqueue: one live row per (document, stage, target).
create unique index jobs_unique_live
  on jobs (document_id, stage, coalesce(target_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status <> 'dead';
```

**Lifecycle:** `pending → claimed → done`, or `claimed → failed`; `failed` re-enters
`pending` with a backoff `run_after` until `attempts >= max_attempts`, then `dead`.

`agent_runs` (token/cost telemetry) is unchanged — `recordRun` still fires inside each
handler. `documents.processing_status` becomes a **derived mirror** the drain updates,
so existing document/list UI keeps working without query changes.

## Execution

### Stage handlers

`runFullPipeline` is split into five idempotent handlers. Bodies are the existing
`runIngestionAgent` / `runChunkingAgent` / `runExtractionAgent` / `runStructuringAgent`
and a per-question slice of `runResponseGenerationAgent`. They already delete-then-insert
keyed by `document_id` (or upsert per question), so re-running a stage is safe.

- `ingest`, `chunk`, `extract`, `structure` — doc-level, `target_id = null`.
- `generate` — one job per question, `target_id = question_id`. The `structure`
  handler enqueues these after writing the `questions` rows.

Each handler signature: `(supabase, job) → void`; throws on failure.

### Drain endpoint

`POST /api/jobs/drain` — admin client, guarded by `x-cron-secret` header (compared to
`CRON_SECRET` env), time-boxed.

```sql
-- 0. recover stuck claims (crashed mid-run)
update jobs set status='pending', updated_at=now()
 where status='claimed' and lease_until < now();

-- 1. claim a small batch
update jobs
   set status='claimed', attempts=attempts+1,
       lease_until=now()+interval '5 minutes', updated_at=now()
 where id in (
   select id from jobs
    where status='pending' and run_after <= now()
    order by created_at
    limit 3
    for update skip locked
 )
 returning *;
```

For each claimed job:

- **Success** → `status='done'`; enqueue successor(s) (idempotent insert; unique index
  swallows dupes); update `documents.processing_status`.
- **Failure** → if `attempts < max_attempts`: `status='failed'` then immediately back to
  `pending` with `run_after = now() + backoff(attempts)` (e.g. 5s, 30s, 2m). Else
  `status='dead'` and mark the document needs-attention.

Overlapping drains are safe via `FOR UPDATE SKIP LOCKED`. Batch of 3, run sequentially,
keeps each invocation well under the time budget.

### Enqueue

`app/api/documents/process/route.ts` stops running the pipeline inline:

```
insert into jobs (document_id, org_id, stage) values (:doc, :org, 'ingest');
update documents set processing_status = 'queued' where id = :doc;
return 200;   -- upload UX instant
```

The existing `CEREBRAS_API_KEY`-missing short-circuit is preserved (mark document,
return success, do not enqueue).

### Driver (trigger)

**Production — pg_cron + pg_net (Supabase-native):**

```sql
select cron.schedule('drain-pipeline', '30 seconds', $$
  select net.http_post(
    url     := current_setting('app.base_url') || '/api/jobs/drain',
    headers := jsonb_build_object('x-cron-secret', current_setting('app.cron_secret'))
  );
$$);
```

Requires pg_cron ≥ 1.5 (sub-minute schedules) + pg_net, both available on Supabase.
`app.base_url` / `app.cron_secret` set via `alter database ... set`.

**Local dev:** an `npm run drain` script loops `POST /api/jobs/drain` every ~2s against
`localhost`. pg_cron is not used in dev.

**Documented fallback:** a `vercel.json` cron hitting the same endpoint (1/min Hobby,
1/30s Pro). One less Postgres extension; swap without touching the schema or handlers.

## Progress & failure UX

Progress derived from the job aggregate — no extra bookkeeping:

```sql
select stage, status, count(*)
  from jobs where document_id = :doc
 group by stage, status;
```

- Doc-level stages → coarse phase ("Extracting…").
- `generate` → "34 / 50 drafted" from done-vs-total generate rows.
- Document overall: any `dead` → **needs attention**; all `done` → **completed**;
  otherwise **processing**.

Retry = re-insert the failed stage's job as `pending` (or reset the `dead` row). One bad
question no longer fails the document; the user retries just that unit.

## Rollout

1. Migration `0010_jobs.sql` — enum types, `jobs` table, indexes.
2. Refactor `lib/agents.ts`: extract per-stage handlers; keep `runFullPipeline` as a thin
   synchronous fallback (feature-flagged) until the drain path is verified.
3. Add `app/api/jobs/drain/route.ts` (claim + dispatch + enqueue-successor).
4. Flip `app/api/documents/process/route.ts` to enqueue-only.
5. Derive progress in document/list views from the job aggregate.
6. Add `npm run drain` dev loop; document pg_cron + `vercel.json` cron prod options.
7. Backfill/cutover: in-flight documents re-enqueued at `ingest`.

## Open questions

None blocking. pg_cron vs Vercel cron is a deploy-time choice; the schema and handlers are
identical either way.
