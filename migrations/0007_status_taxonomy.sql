-- 0007_status_taxonomy.sql
-- Collapse deal + question status enums to 5 canonical values each.
--
-- Deals  (12 → 5):   new, in_progress, submitted, won, lost
-- Questions (10 → 5): todo, drafting, review, approved, blocked

begin;

-- ─── Deals ──────────────────────────────────────────────────────────────

-- Drop old check constraint so we can rewrite values freely
do $$
begin
  if exists (select 1 from pg_constraint where conname='deals_status_check') then
    alter table deals drop constraint deals_status_check;
  end if;
end $$;

-- Backfill old values → new canonical 5
update deals set status = case status
  when 'open' then 'new'
  when 'new'  then 'new'
  when 'parsing' then 'in_progress'
  when 'drafting' then 'in_progress'
  when 'in_progress' then 'in_progress'
  when 'under_review' then 'in_progress'
  when 'awaiting_approval' then 'in_progress'
  when 'submitted' then 'submitted'
  when 'completed' then 'submitted'
  when 'responded' then 'submitted'
  when 'won' then 'won'
  when 'lost' then 'lost'
  else 'new'
end;

alter table deals add constraint deals_status_check
  check (status in ('new','in_progress','submitted','won','lost'));

alter table deals alter column status set default 'new';

-- ─── Questions ──────────────────────────────────────────────────────────

do $$
begin
  if exists (select 1 from pg_constraint where conname='questions_status_check') then
    alter table questions drop constraint questions_status_check;
  end if;
end $$;

update questions set status = case status
  when 'unanswered' then 'todo'
  when 'pending'    then 'todo'
  when 'ai_drafted' then 'drafting'
  when 'assigned'   then 'drafting'
  when 'in_progress' then 'drafting'
  when 'in_review'  then 'review'
  when 'submitted'  then 'review'
  when 'approved'   then 'approved'
  when 'finalized'  then 'approved'
  when 'rejected'   then 'blocked'
  else 'todo'
end;

alter table questions add constraint questions_status_check
  check (status in ('todo','drafting','review','approved','blocked'));

alter table questions alter column status set default 'todo';

commit;
