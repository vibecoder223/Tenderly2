-- 0010_jobs.sql
-- Async, resumable document pipeline. Each pipeline stage becomes an
-- idempotent row in `jobs`, drained in small batches by /api/jobs/drain.
-- Resumability lives here, not in the runtime: a failed unit retries on its
-- own without re-running the whole document.
--
-- Idempotent / safe to re-run (migrate.mjs concatenates and replays all files).

-- ---------- enums ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'job_stage') then
    create type job_stage as enum ('ingest','extract','structure','generate');
  end if;
  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type job_status as enum ('pending','claimed','done','failed','dead');
  end if;
end $$;

-- ---------- table ----------
create table if not exists jobs (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  org_id       uuid not null,
  stage        job_stage  not null,
  target_id    uuid,                        -- question_id for 'generate'; null for doc-level stages
  status       job_status not null default 'pending',
  attempts     int  not null default 0,
  max_attempts int  not null default 3,
  run_after    timestamptz not null default now(),
  lease_until  timestamptz,
  error        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists jobs_claimable_idx on jobs (status, run_after);
create index if not exists jobs_document_idx  on jobs (document_id);

-- One live (non-dead) row per (document, stage, target). Makes successor
-- enqueue idempotent: a duplicate insert raises 23505, which callers ignore.
create unique index if not exists jobs_unique_live
  on jobs (document_id, stage, coalesce(target_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status <> 'dead';

-- ---------- claim / recovery functions ----------
-- Atomic claim: flips up to p_limit pending rows to 'claimed' and returns them.
-- FOR UPDATE SKIP LOCKED makes concurrent drains safe.
create or replace function claim_jobs(p_limit int)
returns setof jobs
language plpgsql
as $$
begin
  return query
  update jobs j
     set status      = 'claimed',
         attempts    = j.attempts + 1,
         lease_until = now() + interval '5 minutes',
         updated_at  = now()
   where j.id in (
     select id from jobs
      where status = 'pending' and run_after <= now()
      order by created_at
      limit p_limit
      for update skip locked
   )
  returning j.*;
end;
$$;

-- Reclaim rows whose worker died mid-run (lease expired without completion).
create or replace function recover_stuck_jobs()
returns void
language sql
as $$
  update jobs set status = 'pending', updated_at = now()
   where status = 'claimed' and lease_until < now();
$$;

-- ---------- documents status: add 'queued' ----------
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'documents_processing_status_check'
  ) then
    alter table documents drop constraint documents_processing_status_check;
  end if;
end $$;

alter table documents
  add constraint documents_processing_status_check
  check (processing_status in (
    'uploaded',
    'queued',
    'extracting',
    'chunked',
    'analyzing',
    'structured',
    'completed',
    'failed',
    'embedding_failed',
    'extraction_failed',
    'generation_failed'
  ));
