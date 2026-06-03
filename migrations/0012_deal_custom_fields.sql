-- Org-defined custom fields for deals (Microsoft Lists style).
-- Admins define fields once per org; every deal inherits them and stores
-- values in deals.custom_fields (a key->value jsonb map).

create table if not exists deal_field_definitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  label text not null,
  key text not null,
  type text not null default 'text'
    check (type in ('text','number','currency','date','select','boolean','url','person')),
  options jsonb,            -- for 'select': JSON array of string choices
  required boolean default false,
  position int default 0,
  archived boolean default false,
  created_at timestamptz default now(),
  unique(org_id, key)
);

create index if not exists idx_dfd_org on deal_field_definitions(org_id);

-- Per-deal values: { "<field_key>": <value>, ... }
alter table deals add column if not exists custom_fields jsonb not null default '{}'::jsonb;

alter table deal_field_definitions enable row level security;

drop policy if exists dfd_all on deal_field_definitions;
create policy dfd_all on deal_field_definitions
  for all using (org_id in (select current_user_org_ids()))
  with check (org_id in (select current_user_org_ids()));
