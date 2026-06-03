-- Proposal templates: reusable cover/intro/footer + branding for deal exports
create table if not exists proposal_templates (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  name          text not null,
  description   text,
  intro         text,              -- cover/intro paragraph rendered before Q&A
  footer        text,              -- footer/closing block rendered after Q&A
  accent_color  text default '#3B47D6',
  font_family   text default 'default',
  is_default    boolean not null default false,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists proposal_templates_org_idx on proposal_templates(org_id);
create unique index if not exists proposal_templates_one_default
  on proposal_templates(org_id) where is_default = true;

alter table proposal_templates enable row level security;

create policy "members read templates" on proposal_templates for select
  using (org_id in (select org_id from team_members where user_id = auth.uid()));
create policy "members write templates" on proposal_templates for all
  using (org_id in (select org_id from team_members where user_id = auth.uid()))
  with check (org_id in (select org_id from team_members where user_id = auth.uid()));

-- Track which template was used for each export (optional FK, set null on delete)
alter table exports
  add column if not exists template_id uuid references proposal_templates(id) on delete set null;
