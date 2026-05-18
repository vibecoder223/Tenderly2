-- ============================================================
-- Tenderly — RAG pipeline schema (additive, idempotent).
-- M1 of the RAG build plan.
-- ============================================================

create extension if not exists "vector";

-- ============================================================
-- Knowledge base (past proposals, security docs, policies, etc.)
-- ============================================================
create table if not exists knowledge_documents (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  filename      text not null,
  source_url    text,
  doc_type      text not null default 'other'
                check (doc_type in ('past_proposal','security_doc','policy','other')),
  file_path     text not null,           -- Supabase Storage path in `knowledge` bucket
  file_size     integer,
  mime_type     text,
  page_count    integer,
  text_hash     text,                    -- sha256(text) — dedup on re-upload
  ingestion_status text not null default 'pending'
                check (ingestion_status in ('pending','processing','ready','failed')),
  error_message text,
  uploaded_by   uuid references auth.users(id),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (org_id, text_hash)             -- dedup per workspace
);
create index if not exists idx_kdocs_org on knowledge_documents(org_id);
create index if not exists idx_kdocs_status on knowledge_documents(ingestion_status);

-- ============================================================
-- Document chunks: shared across knowledge base + RFPs.
-- Existing `document_chunks` references RFP documents; add KB-side columns
-- + the vector / sparse / page fields. Old rows get nulls and are
-- re-ingested on next pipeline run.
-- ============================================================
alter table document_chunks
  add column if not exists knowledge_document_id uuid references knowledge_documents(id) on delete cascade,
  add column if not exists org_id            uuid references organizations(id) on delete cascade,
  add column if not exists section_path      text,
  add column if not exists page_start        integer,
  add column if not exists page_end          integer,
  add column if not exists text_for_embedding text,
  add column if not exists embedding         vector(1024),
  add column if not exists sparse_terms      text[];

-- Allow document_id (the RFP side) to be NULL when chunk belongs to a KB doc.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name='document_chunks' and column_name='document_id' and is_nullable='NO'
  ) then
    alter table document_chunks alter column document_id drop not null;
  end if;
end $$;

-- Either an RFP chunk (document_id set) or a KB chunk (knowledge_document_id set), never both.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'document_chunks_source_check'
  ) then
    alter table document_chunks add constraint document_chunks_source_check
      check ((document_id is not null) <> (knowledge_document_id is not null));
  end if;
end $$;

-- Hybrid retrieval indexes
create index if not exists idx_chunks_embedding
  on document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists idx_chunks_org on document_chunks(org_id);
create index if not exists idx_chunks_sparse on document_chunks using gin(sparse_terms);

-- ============================================================
-- Citations (one row per [c:UUID] marker in an answer)
-- ============================================================
create table if not exists citations (
  id                  uuid primary key default gen_random_uuid(),
  response_id         uuid not null references responses(id) on delete cascade,
  chunk_id            uuid not null references document_chunks(id) on delete restrict,
  document_filename   text not null,
  section_path        text,
  page                integer,
  quote               text,
  created_at          timestamptz default now()
);
create index if not exists idx_citations_response on citations(response_id);
create index if not exists idx_citations_chunk on citations(chunk_id);

-- ============================================================
-- Extend extracted_requirements with spec-required fields.
-- Keep existing columns (category/priority/is_mandatory) — new columns
-- are added in parallel so legacy data stays intact.
-- ============================================================
alter table extracted_requirements
  add column if not exists section        text,
  add column if not exists source_page    integer,
  add column if not exists classification text
    check (classification in ('must','should','info')),
  add column if not exists topic          text
    check (topic in ('security','legal','pricing','technical','commercial'));

-- ============================================================
-- Extend responses with citation + confidence + gap.
-- ============================================================
alter table responses
  add column if not exists answer_text_with_markers text,
  add column if not exists confidence               numeric,
  add column if not exists gap_flag                 text
    check (gap_flag in ('ok','partial','no_source')),
  add column if not exists generated_by             text
    check (generated_by in ('ai','human','edited'));

-- Existing `status` enum lacks 'requires_review'. Recreate the check.
do $$
begin
  if exists (select 1 from pg_constraint where conname='responses_status_check') then
    alter table responses drop constraint responses_status_check;
  end if;
  alter table responses add constraint responses_status_check
    check (status in ('draft','submitted','approved','exported','requires_review'));
end $$;

-- ============================================================
-- RLS on new tables (mirror the org-scoped policies)
-- ============================================================
alter table knowledge_documents enable row level security;
alter table citations           enable row level security;

drop policy if exists kdocs_all on knowledge_documents;
create policy kdocs_all on knowledge_documents
  for all using (org_id in (select current_user_org_ids()))
  with check (org_id in (select current_user_org_ids()));

drop policy if exists citations_all on citations;
create policy citations_all on citations
  for all using (response_id in (
    select id from responses where question_id in (
      select id from questions where document_id in (
        select id from documents where deal_id in (
          select id from deals where org_id in (select current_user_org_ids())
        )
      )
    )
  ))
  with check (response_id in (
    select id from responses where question_id in (
      select id from questions where document_id in (
        select id from documents where deal_id in (
          select id from deals where org_id in (select current_user_org_ids())
        )
      )
    )
  ));

-- ============================================================
-- Storage bucket for knowledge base files
-- ============================================================
insert into storage.buckets (id, name, public)
values ('knowledge', 'knowledge', false)
on conflict (id) do nothing;

drop policy if exists "kb_read"   on storage.objects;
drop policy if exists "kb_write"  on storage.objects;
drop policy if exists "kb_update" on storage.objects;
drop policy if exists "kb_delete" on storage.objects;

create policy "kb_read" on storage.objects for select
  using (
    bucket_id = 'knowledge'
    and (storage.foldername(name))[1]::uuid in (select current_user_org_ids())
  );
create policy "kb_write" on storage.objects for insert
  with check (
    bucket_id = 'knowledge'
    and (storage.foldername(name))[1]::uuid in (select current_user_org_ids())
  );
create policy "kb_update" on storage.objects for update
  using (
    bucket_id = 'knowledge'
    and (storage.foldername(name))[1]::uuid in (select current_user_org_ids())
  );
create policy "kb_delete" on storage.objects for delete
  using (
    bucket_id = 'knowledge'
    and (storage.foldername(name))[1]::uuid in (select current_user_org_ids())
  );

-- ============================================================
-- Hybrid retrieval RPC
-- ============================================================
create or replace function match_chunks(
  p_org_id   uuid,
  p_embedding vector(1024),
  p_match_count int default 20
)
returns table (
  chunk_id     uuid,
  text         text,
  section_path text,
  page_start   integer,
  page_end     integer,
  document_filename text,
  similarity   float
)
language sql
stable
as $$
  select
    c.id        as chunk_id,
    coalesce(c.cleaned_text, c.raw_text)         as text,
    c.section_path,
    c.page_start,
    c.page_end,
    coalesce(kd.filename, d.filename)            as document_filename,
    1 - (c.embedding <=> p_embedding)            as similarity
  from document_chunks c
  left join knowledge_documents kd on kd.id = c.knowledge_document_id
  left join documents d on d.id = c.document_id
  where c.org_id = p_org_id
    and c.embedding is not null
  order by c.embedding <=> p_embedding
  limit p_match_count;
$$;
