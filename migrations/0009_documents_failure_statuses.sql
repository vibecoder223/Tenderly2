-- 0009_documents_failure_statuses.sql
-- Add granular failure statuses so the UI can distinguish where in the
-- pipeline a document broke (embedding vs extraction vs generation) and
-- offer a targeted retry. `error_message` already exists from 0001_init.

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'documents_processing_status_check'
  ) then
    alter table documents drop constraint documents_processing_status_check;
  end if;
end $$;

alter table documents
  add constraint documents_processing_status_check
  check (processing_status in (
    'uploaded',
    'extracting',
    'chunked',
    'analyzing',
    'structured',
    'completed',
    'failed',
    'embedding_failed',
    'extraction_failed',
    'generation_failed'
  ));
