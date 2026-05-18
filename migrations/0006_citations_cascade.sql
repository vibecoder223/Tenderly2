-- Relax citations.chunk_id from RESTRICT to CASCADE so deleting a document
-- (which cascades to chunks) doesn't fail when responses-side citations still
-- reference the chunk.
alter table citations
  drop constraint if exists citations_chunk_id_fkey;

alter table citations
  add constraint citations_chunk_id_fkey
  foreign key (chunk_id) references document_chunks(id) on delete cascade;
