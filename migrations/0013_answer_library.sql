-- Answer Library — auto-capture on approval + suggest-on-question reuse.
-- Turns the orphaned response_library into a matchable Q->A store.
-- Spec: docs/superpowers/specs/2026-06-03-answer-library-design.md
--
-- We match an INCOMING question against STORED questions, so embedding is of
-- question_text only (not question+answer — answer prose dilutes the match).

alter table response_library
  add column if not exists question_text      text,
  add column if not exists embedding          vector(1024),
  add column if not exists source             text default 'manual',  -- 'manual' | 'approved'
  add column if not exists source_question_id uuid references questions(id) on delete set null,
  add column if not exists last_used_at       timestamptz;

create index if not exists idx_library_embedding
  on response_library using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Org-scoped nearest-question search over library embeddings.
-- Mirrors match_chunks; only rows with an embedding participate.
create or replace function match_answers(
  p_org_id    uuid,
  p_embedding vector(1024),
  p_match_count int default 5
)
returns table (
  id           uuid,
  question_text text,
  response_text text,
  usage_count  integer,
  last_used_at timestamptz,
  source_question_id uuid,
  similarity   float
)
language sql
stable
as $$
  select
    l.id,
    l.question_text,
    l.response_text,
    l.usage_count,
    l.last_used_at,
    l.source_question_id,
    1 - (l.embedding <=> p_embedding) as similarity
  from response_library l
  where l.org_id = p_org_id
    and l.embedding is not null
  order by l.embedding <=> p_embedding
  limit p_match_count;
$$;
