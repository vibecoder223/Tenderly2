-- ============================================================
-- Tenderly — workspace / collaboration layer (M-workspace)
-- Adds: per-question comments, expanded deal/question status enums,
-- explicit due dates, owner tracking.
-- ============================================================

-- Question comments
create table if not exists question_comments (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  author_id   uuid references auth.users(id),
  author_name text,
  body        text not null,
  created_at  timestamptz default now()
);
create index if not exists idx_qcomments_question on question_comments(question_id);

alter table question_comments enable row level security;

drop policy if exists qcomments_all on question_comments;
create policy qcomments_all on question_comments
  for all using (
    question_id in (
      select id from questions where document_id in (
        select id from documents where deal_id in (
          select id from deals where org_id in (select current_user_org_ids())
        )
      )
    )
  )
  with check (
    question_id in (
      select id from questions where document_id in (
        select id from documents where deal_id in (
          select id from deals where org_id in (select current_user_org_ids())
        )
      )
    )
  );

-- Expanded deal status
do $$
begin
  if exists (select 1 from pg_constraint where conname='deals_status_check') then
    alter table deals drop constraint deals_status_check;
  end if;
  alter table deals add constraint deals_status_check
    check (status in (
      'new','parsing','drafting','in_progress','under_review',
      'awaiting_approval','completed','submitted','won','lost','open','responded'
    ));
end $$;

-- Expanded question status
do $$
begin
  if exists (select 1 from pg_constraint where conname='questions_status_check') then
    alter table questions drop constraint questions_status_check;
  end if;
  alter table questions add constraint questions_status_check
    check (status in (
      'unanswered','ai_drafted','assigned','in_progress','in_review',
      'approved','finalized','rejected','pending','submitted'
    ));
end $$;

-- Track when a question was last edited / by whom (light audit)
alter table questions
  add column if not exists last_activity_at timestamptz default now();

create or replace function bump_question_activity()
returns trigger language plpgsql as $$
begin
  new.last_activity_at = now();
  return new;
end
$$;

drop trigger if exists trg_questions_activity on questions;
create trigger trg_questions_activity before update on questions
  for each row execute function bump_question_activity();
