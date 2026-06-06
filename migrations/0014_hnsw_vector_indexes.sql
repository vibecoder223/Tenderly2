-- Replace ivfflat vector indexes with HNSW.
--
-- ivfflat partitions vectors into `lists` clusters and, with the default
-- `ivfflat.probes = 1`, a query searches only ONE cluster. On a small or
-- moderately-sized knowledge base most of the 100 lists are empty or hold a
-- single chunk, so retrieval returned almost nothing — match_chunks came back
-- empty and every AI draft fell back to "no_source". Raising probes to 100
-- (search all lists) made all matches reappear, confirming the index was the
-- cause, not the query.
--
-- HNSW needs no probes tuning, gives high recall out of the box, and works well
-- on small datasets — the right default for an early-stage workspace. Cosine
-- ops match the `1 - (embedding <=> query)` similarity used by match_chunks /
-- match_answers.

drop index if exists idx_chunks_embedding;
create index if not exists idx_chunks_embedding
  on document_chunks using hnsw (embedding vector_cosine_ops);

drop index if exists idx_library_embedding;
create index if not exists idx_library_embedding
  on response_library using hnsw (embedding vector_cosine_ops);
