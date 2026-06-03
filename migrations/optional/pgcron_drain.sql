-- OPTIONAL — production drain trigger. NOT applied by scripts/migrate.mjs
-- (it only globs *.sql in the top-level migrations/ dir, not subfolders).
-- Run this by hand in the Supabase SQL editor on a project that has the
-- pg_cron and pg_net extensions enabled.
--
-- It pings /api/jobs/drain every 30s; the endpoint claims and runs a batch.
-- Locally, use `npm run drain` instead — do not point pg_cron at localhost.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Set these once per database (replace the placeholder values):
--   alter database postgres set app.base_url   = 'https://your-app.example.com';
--   alter database postgres set app.cron_secret = '<same value as CRON_SECRET env>';

select cron.schedule(
  'drain-pipeline',
  '30 seconds',
  $$
    select net.http_post(
      url     := current_setting('app.base_url') || '/api/jobs/drain',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cron-secret', current_setting('app.cron_secret')
      )
    );
  $$
);

-- To remove:  select cron.unschedule('drain-pipeline');
