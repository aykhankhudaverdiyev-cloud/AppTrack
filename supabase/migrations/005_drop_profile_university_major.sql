-- ============================================================================
-- AppTrack — Migration 005: remove single-university concept from `profiles`
-- ----------------------------------------------------------------------------
-- WHY
--   `profiles.university` + `profiles.major` encoded "the one university / major
--   this student is tied to". AppTrack is multi-university by design: every
--   university a student applies to lives in `applications`
--   (`university`, `university_id`, `program`, `major`), and intended majors
--   live in `profiles.intended_major_1` / `intended_major_2`.
--
-- WHAT
--   1. Backfills `intended_major_1` from the legacy `major` column where the
--      new field is still empty (no data loss).
--   2. Drops the dead legacy columns:
--        profiles.university            -> replaced by applications.university
--        profiles.major                 -> replaced by intended_major_1/2
--        profiles.committed_university  -> dead since migration 001 (never read)
--
-- SAFETY
--   - Idempotent: every step is guarded with `if exists` / `is null`.
--   - No view, RLS policy, function or trigger references these columns
--     (verified against the live project: ugvgktlphevruvnoteum).
--   - Per-application columns (`applications.university`, `applications.major`,
--     `applications.university_id`) and the `universities` reference table are
--     untouched.
-- ============================================================================

begin;

-- 1. Keep the existing data: legacy major -> intended_major_1 (only if empty).
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'major'
  ) and exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'intended_major_1'
  ) then
    update public.profiles
       set intended_major_1 = nullif(btrim(major), '')
     where (intended_major_1 is null or btrim(intended_major_1) = '')
       and major is not null
       and btrim(major) <> '';
  end if;
end $$;

-- 2. Drop the single-university / single-major columns.
alter table public.profiles drop column if exists university;
alter table public.profiles drop column if exists major;
alter table public.profiles drop column if exists committed_university;

commit;

-- ----------------------------------------------------------------------------
-- Verification (run manually after the migration):
--   select column_name from information_schema.columns
--    where table_schema='public' and table_name='profiles'
--      and column_name in ('university','major','committed_university');  -- 0 rows
--   select count(*) from public.profiles where intended_major_1 is not null;
-- ----------------------------------------------------------------------------
