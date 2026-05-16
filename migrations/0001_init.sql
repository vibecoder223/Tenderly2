-- ============================================================
-- Tenderly — initial schema
-- Idempotent: safe to re-run.
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- Tables
-- ============================================================

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text default 'user' check (role in ('admin','owner','user','viewer')),
  email text not null,
  name text,
  avatar_url text,
  created_at timestamptz default now(),
  unique(org_id, user_id)
);
create index if not exists idx_team_members_user on team_members(user_id);
create index if not exists idx_team_members_org on team_members(org_id);

create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  client_name text,
  status text default 'open' check (status in ('open','in_progress','responded','won','lost')),
  owner_id uuid references auth.users(id),
  value numeric,
  due_date timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_deals_org_id on deals(org_id);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  filename text not null,
  file_path text not null,
  file_size integer,
  mime_type text,
  extracted_text text,
  processing_status text default 'uploaded' check (processing_status in
    ('uploaded','extracting','chunked','analyzing','structured','completed','failed')),
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_documents_deal_id on documents(deal_id);

create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  chunk_index integer,
  section_title text,
  raw_text text,
  cleaned_text text,
  created_at timestamptz default now()
);
create index if not exists idx_chunks_doc on document_chunks(document_id);

create table if not exists extracted_requirements (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  requirement_id text,
  title text not null,
  description text,
  category text,
  priority text default 'medium' check (priority in ('low','medium','high','critical')),
  is_mandatory boolean default false,
  compliance_area text,
  created_at timestamptz default now()
);
create index if not exists idx_requirements_document_id on extracted_requirements(document_id);

create table if not exists compliance_matrix (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  requirement_id text,
  our_capability text,
  compliance_status text default 'pending' check (compliance_status in
    ('compliant','partial','non_compliant','pending')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_compliance_doc on compliance_matrix(document_id);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  requirement_id text,
  question_text text not null,
  category text,
  assigned_to uuid references auth.users(id),
  status text default 'pending' check (status in
    ('pending','in_progress','submitted','approved','rejected')),
  priority text default 'medium',
  due_date timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_questions_document_id on questions(document_id);
create index if not exists idx_questions_assigned_to on questions(assigned_to);

create table if not exists responses (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  draft_text text,
  final_text text,
  ai_generated_draft text,
  tone text default 'technical' check (tone in ('formal','technical','consultative')),
  version integer default 1,
  status text default 'draft' check (status in ('draft','submitted','approved','exported')),
  submitted_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_responses_question_id on responses(question_id);

create table if not exists response_library (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  category text,
  keyword text,
  response_text text not null,
  created_by uuid references auth.users(id),
  usage_count integer default 0,
  created_at timestamptz default now()
);
create index if not exists idx_library_org on response_library(org_id);

create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  agent_type text,
  status text default 'pending' check (status in ('pending','running','completed','failed')),
  input_tokens integer,
  output_tokens integer,
  cost numeric,
  error_message text,
  result jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_agent_runs_document_id on agent_runs(document_id);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references auth.users(id),
  action text,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_activity_org on activity_log(org_id, created_at desc);

create table if not exists exports (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  file_path text,
  format text default 'pdf' check (format in ('pdf','docx')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz default now()
);
create index if not exists idx_exports_deal on exports(deal_id);

create table if not exists org_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade unique,
  default_ai_tone text default 'technical',
  ai_model text default 'claude-sonnet-4-6',
  max_monthly_tokens integer default 500000,
  integrations jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- Helper: which orgs does the current user belong to?
-- ============================================================
create or replace function current_user_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from team_members where user_id = auth.uid()
$$;

-- ============================================================
-- Row-Level Security
-- ============================================================

alter table organizations          enable row level security;
alter table team_members           enable row level security;
alter table deals                  enable row level security;
alter table documents              enable row level security;
alter table document_chunks        enable row level security;
alter table extracted_requirements enable row level security;
alter table compliance_matrix      enable row level security;
alter table questions              enable row level security;
alter table responses              enable row level security;
alter table response_library       enable row level security;
alter table agent_runs             enable row level security;
alter table activity_log           enable row level security;
alter table exports                enable row level security;
alter table org_settings           enable row level security;

-- Helper macro for "drop & recreate"
do $$
declare
  policies record;
begin
  for policies in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'organizations','team_members','deals','documents','document_chunks',
        'extracted_requirements','compliance_matrix','questions','responses',
        'response_library','agent_runs','activity_log','exports','org_settings'
      )
  loop
    execute format('drop policy if exists %I on %I.%I',
      policies.policyname, policies.schemaname, policies.tablename);
  end loop;
end $$;

-- organizations: visible iff user is in it; insert allowed (for self-serve onboarding)
create policy org_select on organizations
  for select using (id in (select current_user_org_ids()));
create policy org_insert on organizations
  for insert with check (auth.uid() is not null);
create policy org_update on organizations
  for update using (id in (select current_user_org_ids()))
  with check (id in (select current_user_org_ids()));

-- team_members: see your org's members; insert your own row
create policy tm_select on team_members
  for select using (org_id in (select current_user_org_ids()) or user_id = auth.uid());
create policy tm_insert on team_members
  for insert with check (user_id = auth.uid() or org_id in (select current_user_org_ids()));
create policy tm_update on team_members
  for update using (org_id in (select current_user_org_ids()));
create policy tm_delete on team_members
  for delete using (org_id in (select current_user_org_ids()));

-- Generic org-scoped helper macro for the rest
create policy deals_all on deals
  for all using (org_id in (select current_user_org_ids()))
  with check (org_id in (select current_user_org_ids()));

create policy documents_all on documents
  for all using (deal_id in (select id from deals where org_id in (select current_user_org_ids())))
  with check (deal_id in (select id from deals where org_id in (select current_user_org_ids())));

create policy chunks_all on document_chunks
  for all using (document_id in (select id from documents where deal_id in
    (select id from deals where org_id in (select current_user_org_ids()))))
  with check (document_id in (select id from documents where deal_id in
    (select id from deals where org_id in (select current_user_org_ids()))));

create policy req_all on extracted_requirements
  for all using (document_id in (select id from documents where deal_id in
    (select id from deals where org_id in (select current_user_org_ids()))))
  with check (document_id in (select id from documents where deal_id in
    (select id from deals where org_id in (select current_user_org_ids()))));

create policy comp_all on compliance_matrix
  for all using (document_id in (select id from documents where deal_id in
    (select id from deals where org_id in (select current_user_org_ids()))))
  with check (document_id in (select id from documents where deal_id in
    (select id from deals where org_id in (select current_user_org_ids()))));

create policy q_all on questions
  for all using (document_id in (select id from documents where deal_id in
    (select id from deals where org_id in (select current_user_org_ids()))))
  with check (document_id in (select id from documents where deal_id in
    (select id from deals where org_id in (select current_user_org_ids()))));

create policy r_all on responses
  for all using (question_id in (select id from questions where document_id in
    (select id from documents where deal_id in
      (select id from deals where org_id in (select current_user_org_ids())))))
  with check (question_id in (select id from questions where document_id in
    (select id from documents where deal_id in
      (select id from deals where org_id in (select current_user_org_ids())))));

create policy lib_all on response_library
  for all using (org_id in (select current_user_org_ids()))
  with check (org_id in (select current_user_org_ids()));

create policy ag_all on agent_runs
  for all using (document_id in (select id from documents where deal_id in
    (select id from deals where org_id in (select current_user_org_ids()))))
  with check (document_id in (select id from documents where deal_id in
    (select id from deals where org_id in (select current_user_org_ids()))));

create policy act_select on activity_log
  for select using (org_id in (select current_user_org_ids()));
create policy act_insert on activity_log
  for insert with check (org_id in (select current_user_org_ids()));

create policy exp_all on exports
  for all using (deal_id in (select id from deals where org_id in (select current_user_org_ids())))
  with check (deal_id in (select id from deals where org_id in (select current_user_org_ids())));

create policy settings_all on org_settings
  for all using (org_id in (select current_user_org_ids()))
  with check (org_id in (select current_user_org_ids()));

-- ============================================================
-- updated_at triggers
-- ============================================================
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['organizations','deals','documents','compliance_matrix',
                           'questions','responses','org_settings']
  loop
    execute format('drop trigger if exists trg_%s_updated on %I', t, t);
    execute format('create trigger trg_%s_updated before update on %I
                    for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- ============================================================
-- Storage bucket for documents
-- ============================================================
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Storage policies: a user can read/write objects under their org's deals
-- Path layout: {deal_id}/{filename}
drop policy if exists "docs_read" on storage.objects;
drop policy if exists "docs_write" on storage.objects;
drop policy if exists "docs_update" on storage.objects;
drop policy if exists "docs_delete" on storage.objects;

create policy "docs_read" on storage.objects for select
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (
      select id::text::uuid from deals where org_id in (select current_user_org_ids())
    )
  );

create policy "docs_write" on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (
      select id::text::uuid from deals where org_id in (select current_user_org_ids())
    )
  );

create policy "docs_update" on storage.objects for update
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (
      select id::text::uuid from deals where org_id in (select current_user_org_ids())
    )
  );

create policy "docs_delete" on storage.objects for delete
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (
      select id::text::uuid from deals where org_id in (select current_user_org_ids())
    )
  );
