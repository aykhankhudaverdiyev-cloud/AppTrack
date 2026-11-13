-- ============================================================================
-- AppTrack — Migration 006: Activities redesign (`activities_redesign`)
-- ----------------------------------------------------------------------------
-- One unified activities list replaces the old Volunteering / Internships /
-- Projects tabs. This migration only tightens the existing `public.activities`
-- table — no other table, view or RLS policy is touched.
--
--   1. Normalises activity_type to the nine fixed categories and locks them
--      with a CHECK constraint.
--   2. Adds `organization_description` ("About the organization", ≤ 250) and
--      caps `long_description` ("What you did", ≤ 350).
--      NOTE: the legacy `description` column keeps its own 150-char limit and
--      is NOT used by the new UI.
--   3. Adds data-sanity constraints (dates, grade levels) and the ordering index.
--   4. Adds the atomic reorder RPC used by drag-and-drop. `security invoker`
--      keeps the owner RLS policy in force.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- 1. Fixed categories ---------------------------------------------------------
update public.activities set activity_type = case
  when activity_type in ('academic','volunteering','work','research','sports','arts','clubs','family','other') then activity_type
  when activity_type ilike '%volunt%' or activity_type ilike '%community%' then 'volunteering'
  when activity_type ilike '%intern%' or activity_type ilike '%job%' or activity_type ilike '%work%' then 'work'
  when activity_type ilike '%research%' then 'research'
  when activity_type ilike '%sport%' or activity_type ilike '%athlet%' then 'sports'
  when activity_type ilike '%music%' or activity_type ilike '%theat%' or activity_type ilike '%arts%' or activity_type = 'art' then 'arts'
  when activity_type ilike '%family%' then 'family'
  when activity_type ilike '%academ%' then 'academic'
  when activity_type ilike '%club%' or activity_type ilike '%leader%' then 'clubs'
  else 'other' end;

alter table public.activities alter column activity_type set default 'other';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.activities'::regclass
       and conname = 'activities_activity_type_check'
  ) then
    alter table public.activities add constraint activities_activity_type_check
      check (activity_type in ('academic','volunteering','work','research','sports','arts','clubs','family','other'));
  end if;
end $$;

-- 2. Description fields -------------------------------------------------------
alter table public.activities add column if not exists organization_description text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.activities'::regclass
       and conname = 'activities_organization_description_check'
  ) then
    alter table public.activities add constraint activities_organization_description_check
      check (organization_description is null or char_length(organization_description) <= 250);
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.activities'::regclass
       and conname = 'activities_long_description_check'
  ) then
    alter table public.activities add constraint activities_long_description_check
      check (long_description is null or char_length(long_description) <= 350);
  end if;
end $$;

-- 3. Data sanity --------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.activities'::regclass
       and conname = 'activities_dates_check'
  ) then
    alter table public.activities add constraint activities_dates_check
      check (start_date is null or end_date is null or end_date >= start_date);
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.activities'::regclass
       and conname = 'activities_grade_levels_check'
  ) then
    alter table public.activities add constraint activities_grade_levels_check
      check (grade_levels <@ array[9,10,11,12]::smallint[]);
  end if;
end $$;

create index if not exists idx_activities_user_sort on public.activities (user_id, sort_order);

-- 4. Atomic reorder (RLS still applies: security invoker) ---------------------
create or replace function public.reorder_activities(p_ids uuid[])
returns void language plpgsql security invoker set search_path = public as $$
begin
  update public.activities a
     set sort_order = x.ord::smallint
    from unnest(p_ids) with ordinality as x(id, ord)
   where a.id = x.id and a.user_id = auth.uid();
end; $$;

grant execute on function public.reorder_activities(uuid[]) to authenticated;

-- ----------------------------------------------------------------------------
-- Verification (run manually after the migration):
--   select conname from pg_constraint
--    where conrelid = 'public.activities'::regclass order by conname;  -- 6 new
--   select proname from pg_proc where proname = 'reorder_activities';  -- 1 row
-- ----------------------------------------------------------------------------
