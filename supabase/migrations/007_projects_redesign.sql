-- ============================================================================
-- AppTrack — Migration 007: Projects redesign (`projects_redesign`)
-- ----------------------------------------------------------------------------
-- The Projects page becomes its own screen with three description fields
-- ("Problem" → problem, "What you built" → build_summary, "Result" → result),
-- a role segmented control (Solo / Team lead / Team member) and a status
-- segmented control (In progress / Live / Paused).
--
-- Only `public.projects` is touched. RLS policies are unchanged
-- (owner ALL, assigned counselor SELECT, admin ALL) and no rows are seeded.
--
--   1. Adds `build_summary` ("What you built", ≤ 500).
--   2. Normalises role_type / status to the fixed UI values.
--   3. Adds length + value CHECKs and a listing index.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- 1. New column --------------------------------------------------------------
alter table public.projects add column if not exists build_summary text;

-- 2. Normalise existing values ----------------------------------------------
--    team → team_member; completed/maintained → live; idea → paused.
update public.projects set role_type = 'team_member' where role_type = 'team';
update public.projects set status = 'live'   where status in ('completed', 'maintained');
update public.projects set status = 'paused' where status = 'idea';

alter table public.projects alter column status set default 'in_progress';

-- 3. Fixed value sets --------------------------------------------------------
alter table public.projects drop constraint if exists projects_role_type_check;
alter table public.projects add constraint projects_role_type_check
  check (role_type is null or role_type in ('solo', 'team_lead', 'team_member'));

alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects add constraint projects_status_check
  check (status in ('in_progress', 'live', 'paused'));

-- 4. Field limits (the UI counters block anything longer) --------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.projects'::regclass and conname = 'projects_problem_check') then
    alter table public.projects add constraint projects_problem_check
      check (problem is null or char_length(problem) <= 300);
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.projects'::regclass and conname = 'projects_build_summary_check') then
    alter table public.projects add constraint projects_build_summary_check
      check (build_summary is null or char_length(build_summary) <= 500);
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.projects'::regclass and conname = 'projects_result_check') then
    alter table public.projects add constraint projects_result_check
      check (result is null or char_length(result) <= 300);
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.projects'::regclass and conname = 'projects_short_description_check') then
    alter table public.projects add constraint projects_short_description_check
      check (short_description is null or char_length(short_description) <= 200);
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.projects'::regclass and conname = 'projects_tech_tags_check') then
    alter table public.projects add constraint projects_tech_tags_check
      check (cardinality(tech_tags) <= 12);
  end if;
end $$;

create index if not exists idx_projects_user_created on public.projects (user_id, created_at);

-- ----------------------------------------------------------------------------
-- Verification (run manually after the migration):
--   select conname from pg_constraint where conrelid='public.projects'::regclass
--    order by conname;                                  -- 5 new checks
--   select count(*) from public.projects
--    where status not in ('in_progress','live','paused'); -- 0
-- ----------------------------------------------------------------------------
