-- ============================================================
-- Team invites by shareable token.
-- ============================================================

create table if not exists invites (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  email        text not null,
  role         text not null default 'user'
               check (role in ('admin','owner','user','viewer')),
  token        text not null unique,
  invited_by   uuid references auth.users(id),
  expires_at   timestamptz not null default (now() + interval '14 days'),
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users(id),
  created_at   timestamptz default now()
);
create index if not exists idx_invites_org on invites(org_id);
create index if not exists idx_invites_token on invites(token);

alter table invites enable row level security;

drop policy if exists invites_select on invites;
create policy invites_select on invites
  for select using (org_id in (select current_user_org_ids()));

drop policy if exists invites_insert on invites;
create policy invites_insert on invites
  for insert with check (org_id in (select current_user_org_ids()));

drop policy if exists invites_update on invites;
create policy invites_update on invites
  for update using (org_id in (select current_user_org_ids()));

drop policy if exists invites_delete on invites;
create policy invites_delete on invites
  for delete using (org_id in (select current_user_org_ids()));
