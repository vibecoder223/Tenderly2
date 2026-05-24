-- 0008_onboarding.sql
-- Track onboarding dismissal + tag sample seed data so the checklist
-- only counts real user activity toward completion.

begin;

alter table organizations
  add column if not exists onboarding_dismissed boolean not null default false;

-- Mark seeded sample rows so they can be excluded from progress counts
-- and rendered with a "Sample" badge in the UI.
alter table knowledge_documents add column if not exists is_sample boolean not null default false;
alter table deals               add column if not exists is_sample boolean not null default false;
alter table documents           add column if not exists is_sample boolean not null default false;
alter table questions           add column if not exists is_sample boolean not null default false;

commit;
