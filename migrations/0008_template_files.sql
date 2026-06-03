-- Add support for .docx template files
alter table proposal_templates
  add column if not exists kind text not null default 'text' check (kind in ('text', 'docx')),
  add column if not exists file_path text,
  add column if not exists file_name text;

-- Storage bucket for template files
insert into storage.buckets (id, name, public)
values ('templates', 'templates', false)
on conflict (id) do nothing;

-- RLS: members of org can read/write their templates bucket files
create policy "members upload templates"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'templates'
  and (storage.foldername(name))[1] in (
    select org_id::text from team_members where user_id = auth.uid()
  )
);

create policy "members read templates"
on storage.objects for select
to authenticated
using (
  bucket_id = 'templates'
  and (storage.foldername(name))[1] in (
    select org_id::text from team_members where user_id = auth.uid()
  )
);

create policy "members delete templates"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'templates'
  and (storage.foldername(name))[1] in (
    select org_id::text from team_members where user_id = auth.uid()
  )
);
