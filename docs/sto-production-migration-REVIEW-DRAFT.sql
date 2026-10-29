-- REVIEW DRAFT ONLY — DO NOT EXECUTE AGAINST PRODUCTION.
-- StepTrack independent STO persistence + STO permission correction.
-- Based on read-only schema metadata captured 2026-10-29.
-- Requires reviewer/owner migration approval, isolated verification, and rollback plan.
begin;

alter table public.sto_objectives
  add column if not exists qualifying_days integer;
alter table public.sto_objectives
  add constraint sto_objectives_qualifying_days_positive
  check (qualifying_days is null or qualifying_days > 0);

-- Existing annual-goal logs stay untouched. Each STO has its own independent records.
alter table public.sto_objectives
  add constraint sto_objectives_id_goal_id_unique unique (id, goal_id);

create table public.sto_trial_entries (
  id uuid primary key default gen_random_uuid(),
  sto_id uuid not null,
  goal_id uuid not null,
  child_id uuid not null,
  logged_by uuid not null default auth.uid() references auth.users(id),
  logged_on date not null default current_date check (logged_on <= current_date),
  value integer not null check (value >= 0),
  trial_total integer not null check (trial_total > 0 and value <= trial_total),
  supports text[] not null check (cardinality(supports) between 1 and 6
    and supports <@ array['Independent','Gesture','Verbal','Physical','Visual','Redirection']::text[]),
  setting text not null check (setting in ('Home','School','Therapy','Respite','Community')),
  note text not null default '' check (char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  constraint sto_trial_entries_sto_fk foreign key (sto_id,goal_id)
    references public.sto_objectives(id,goal_id) on delete restrict,
  constraint sto_trial_entries_goal_child_fk foreign key (goal_id,child_id)
    references public.goals(id,child_id) on delete cascade
);

create index sto_trial_entries_sto_date_idx on public.sto_trial_entries(sto_id,logged_on);
create index sto_trial_entries_child_date_idx on public.sto_trial_entries(child_id,logged_on);
alter table public.sto_trial_entries enable row level security;

-- Avoid Supabase public schema defaults broadening grants.
revoke all on public.sto_trial_entries from anon, authenticated;
grant select, insert, delete on public.sto_trial_entries to authenticated;

create policy sto_trial_entries_select on public.sto_trial_entries
  for select to authenticated using (public.is_member(child_id));
create policy sto_trial_entries_insert on public.sto_trial_entries
  for insert to authenticated
  with check (
    public.can_log(child_id)
    and logged_by = (select auth.uid())
    and exists (
      select 1 from public.sto_objectives s
      where s.id=sto_id and s.goal_id=sto_trial_entries.goal_id
        and s.measurement_type='trials'
    )
  );
create policy sto_trial_entries_delete on public.sto_trial_entries
  for delete to authenticated
  using (
    public.is_parent(child_id)
    or (logged_by=(select auth.uid()) and public.can_log(child_id) and logged_on=current_date)
  );
-- No UPDATE grant or RLS policy for trial entries until a separately reviewed editing flow.

-- Existing STO policies currently authorize ANY member to create/edit/delete.
-- Strengthen writes using the same authorized edit flag as goals plus role check.
drop policy if exists sto_objectives_insert on public.sto_objectives;
drop policy if exists sto_objectives_update on public.sto_objectives;
drop policy if exists sto_objectives_delete on public.sto_objectives;

create policy sto_objectives_insert on public.sto_objectives
  for insert to authenticated with check (
    created_by=(select auth.uid()) and exists (
      select 1 from public.goals g
      join public.memberships m on m.child_id=g.child_id
      where g.id=sto_objectives.goal_id and m.user_id=(select auth.uid())
        and m.can_edit_goals and m.role in ('parent','teacher','therapist')
    )
  );
create policy sto_objectives_update on public.sto_objectives
  for update to authenticated
  using (exists (
    select 1 from public.goals g join public.memberships m on m.child_id=g.child_id
    where g.id=sto_objectives.goal_id and m.user_id=(select auth.uid())
      and m.can_edit_goals and m.role in ('parent','teacher','therapist')
  ))
  with check (exists (
    select 1 from public.goals g join public.memberships m on m.child_id=g.child_id
    where g.id=sto_objectives.goal_id and m.user_id=(select auth.uid())
      and m.can_edit_goals and m.role in ('parent','teacher','therapist')
  ));
create policy sto_objectives_delete on public.sto_objectives
  for delete to authenticated using (exists (
    select 1 from public.goals g join public.memberships m on m.child_id=g.child_id
    where g.id=sto_objectives.goal_id and m.user_id=(select auth.uid())
      and m.can_edit_goals and m.role in ('parent','teacher','therapist')
  ));

commit;
