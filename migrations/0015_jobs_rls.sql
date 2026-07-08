-- 0015_jobs_rls.sql
-- SECURITY FIX (P0): the `jobs` queue table shipped without row-level security
-- AND with full DML grants to the anon/authenticated roles. Confirmed live: an
-- unauthenticated (anon-key) client could SELECT every tenant's rows (org_id,
-- document_id, stage, error text) and, worse, INSERT / UPDATE / DELETE / TRUNCATE
-- the queue — i.e. wipe or poison the whole document pipeline. TRUNCATE is not
-- governed by RLS, so enabling RLS is not enough on its own; the grants must be
-- revoked too.
--
-- Fix:
--   1. Revoke all table privileges from anon (which never needs jobs) and
--      authenticated, then re-grant only SELECT to authenticated.
--   2. Enable RLS and scope those SELECTs to the caller's org.
-- All writes to `jobs` go through the service-role/admin client (lib/jobs.ts,
-- documents/process), which bypasses both grants and RLS, so the pipeline is
-- unaffected. The one user-context reader (deals/[id]/documents/page.tsx) keeps
-- working via the org-scoped SELECT policy below.
--
-- Idempotent / safe to re-run.

revoke all on table jobs from anon;
revoke all on table jobs from authenticated;
grant select on table jobs to authenticated;

alter table jobs enable row level security;

drop policy if exists jobs_select on jobs;
create policy jobs_select on jobs
  for select using (org_id in (select current_user_org_ids()));
