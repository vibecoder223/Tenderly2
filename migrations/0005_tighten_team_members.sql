-- ============================================================
-- Tighten team_members insert policy.
-- The previous policy allowed `user_id = auth.uid()` self-insert, which let
-- any authenticated user add themselves to any organization. Onboarding +
-- invite acceptance both use the service-role client server-side, so the
-- self-insert path is no longer needed.
-- ============================================================

drop policy if exists tm_insert on team_members;
create policy tm_insert on team_members
  for insert with check (
    org_id in (select current_user_org_ids())
  );
