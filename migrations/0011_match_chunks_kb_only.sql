-- Answer grounding must draw ONLY from the knowledge base (past proposals,
-- capability docs), never from the RFP being answered. Before this, match_chunks
-- returned every chunk in the org — including the deal document's own question
-- text, which out-ranked real KB answers (the query IS the RFP text) and made the
-- generator emit NO_SOURCE because its top "sources" were the questions themselves.
-- Restrict retrieval to KB chunks (knowledge_document_id is not null).

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
    and c.knowledge_document_id is not null
  order by c.embedding <=> p_embedding
  limit p_match_count;
$$;
