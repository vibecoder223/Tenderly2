-- 0016_proposal_templates.sql
-- REPRODUCIBILITY FIX: `proposal_templates` (and its `templates` storage bucket
-- + policies) were created out-of-band in the Studio SQL editor and existed in
-- no migration. A fresh Supabase project provisioned from migrations/ alone would
-- ship without them, breaking the entire templates feature. This migration is a
-- faithful reconstruction of the live schema so the DB is reproducible.
--
-- NOTE: accent_color defaults to '#3B47D6' (indigo) here to match the live table
-- exactly. The brand-correct green default (#00872F) is applied as an explicit,
-- separate change in the template-branding migration, not silently here.
--
-- Idempotent / safe to re-run.

create table if not exists proposal_templates (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  name         text not null,
  description  text,
  intro        text,
  footer       text,
  accent_color text default '#3B47D6',
  font_family  text default 'default',
  is_default   boolean not null default false,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  kind         text not null default 'text' check (kind in ('text','docx')),
  file_path    text,
  file_name    text,
  logo_path    text
);

create index if not exists proposal_templates_org_idx on proposal_templates (org_id);
-- At most one default template per org.
create unique index if not exists proposal_templates_one_default
  on proposal_templates (org_id) where (is_default = true);

-- keep updated_at fresh (set_updated_at() is defined in 0001_init.sql)
drop trigger if exists trg_proposal_templates_updated on proposal_templates;
create trigger trg_proposal_templates_updated before update on proposal_templates
  for each row execute function set_updated_at();

alter table proposal_templates enable row level security;

drop policy if exists "members read templates"  on proposal_templates;
drop policy if exists "members write templates" on proposal_templates;
create policy "members read templates" on proposal_templates
  for select using (org_id in (select current_user_org_ids()));
create policy "members write templates" on proposal_templates
  for all using (org_id in (select current_user_org_ids()))
  with check (org_id in (select current_user_org_ids()));

-- ---------- storage bucket for template assets (logos, .docx) ----------
insert into storage.buckets (id, name, public)
values ('templates', 'templates', false)
on conflict (id) do nothing;

-- Objects live under <org_id>/... so folder[1] must be one of the caller's orgs.
drop policy if exists "members read templates"   on storage.objects;
drop policy if exists "members upload templates" on storage.objects;
drop policy if exists "members delete templates" on storage.objects;
create policy "members read templates" on storage.objects
  for select using (
    bucket_id = 'templates'
    and (storage.foldername(name))[1] in (select current_user_org_ids()::text)
  );
create policy "members upload templates" on storage.objects
  for insert with check (
    bucket_id = 'templates'
    and (storage.foldername(name))[1] in (select current_user_org_ids()::text)
  );
create policy "members delete templates" on storage.objects
  for delete using (
    bucket_id = 'templates'
    and (storage.foldername(name))[1] in (select current_user_org_ids()::text)
  );
