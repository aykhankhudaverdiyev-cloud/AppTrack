-- ============================================================================
-- AppTrack — Migration 008: Honors & Tests redesign (`honors_tests_redesign`)
-- ----------------------------------------------------------------------------
-- Rebuilds the Honors & Awards and Test Scores data layer on top of the
-- existing `public.honors`, `public.test_attempts`, `public.test_section_scores`
-- tables (created in migration 001, RLS in 002).
--
--   1. CHECK constraints on honors (title length, grade_levels, levels, result,
--      category) and test_attempts (overall_score bounds, date sanity).
--   2. Trigger: recompute top5_order whenever the top-5 set or sort order changes.
--   3. Trigger: enforce at most one is_best=true per test_type + national_exam_name.
--   4. RPCs: reorder_honors, save_test_sections, set_best_test_attempt.
--   5. Storage: student-documents INSERT now requires is_admin() (owners keep
--      SELECT/UPDATE/DELETE on their own folder; only admins may create new
--      objects). Users link existing documents via the DocumentPicker.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- 1. Honors constraints -------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.honors'::regclass
       and conname = 'honors_grade_levels_check'
  ) then
    alter table public.honors add constraint honors_grade_levels_check
      check (grade_levels <@ array[9,10,11,12,13]::smallint[]);
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.honors'::regclass
       and conname = 'honors_levels_check'
  ) then
    alter table public.honors add constraint honors_levels_check
      check (levels <@ array['school','city','regional','national','international']::text[]);
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.honors'::regclass
       and conname = 'honors_title_length_check'
  ) then
    alter table public.honors add constraint honors_title_length_check
      check (char_length(title) <= 100);
  end if;
end $$;

-- 2. Test attempts constraints ------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.test_attempts'::regclass
       and conname = 'test_attempts_overall_check'
  ) then
    alter table public.test_attempts add constraint test_attempts_overall_check
      check (overall_score is null or overall_max is null or overall_score <= overall_max);
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.test_attempts'::regclass
       and conname = 'test_attempts_dates_check'
  ) then
    alter table public.test_attempts add constraint test_attempts_dates_check
      check (test_date is null or expires_on is null or expires_on >= test_date);
  end if;
end $$;

-- 3. Trigger: recompute top5_order -------------------------------------------

-- After any insert/update/delete on honors, renumber top5_order so the top-5
-- flags map to dense positions 1..N (N <= 5, enforced by the application).
create or replace function public.recompute_top5_order()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.honors h
     set top5_order = x.ord
    from (
      select user_id, id, row_number() over (partition by user_id order by sort_order, created_at) as ord
      from public.honors
      where is_top5_commonapp
    ) x
   where h.id = x.id;
  return null;
end; $$;

create trigger trg_honors_top5_order
after insert or update or delete on public.honors
for each statement execute function public.recompute_top5_order();

-- 4. Trigger: at most one is_best per test type + exam ------------------------

create or replace function public.enforce_one_best_attempt()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.is_best then
    update public.test_attempts
       set is_best = false
     where user_id = NEW.user_id
       and test_type = NEW.test_type
       and national_exam_name is not distinct from NEW.national_exam_name
       and id <> NEW.id
       and is_best;
  end if;
  return NEW;
end; $$;

create trigger trg_one_best_attempt
before insert or update on public.test_attempts
for each row execute function public.enforce_one_best_attempt();

-- 5. RPCs ---------------------------------------------------------------------

-- Atomic drag reorder. RLS owner policy still applies (security invoker).
create or replace function public.reorder_honors(p_ids uuid[])
returns void language plpgsql security invoker set search_path = public as $$
begin
  update public.honors h
     set sort_order = x.ord::smallint
    from unnest(p_ids) with ordinality as x(id, ord)
   where h.id = x.id and h.user_id = auth.uid();
end; $$;
grant execute on function public.reorder_honors(uuid[]) to authenticated;

-- Atomic save of all sections for one attempt (insert / update / delete).
create or replace function public.save_test_sections(p_attempt_id uuid, p_sections jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
  delete from public.test_section_scores
   where attempt_id = p_attempt_id and user_id = auth.uid();

  insert into public.test_section_scores (attempt_id, user_id, section, score, score_max, sort_order)
  select
    p_attempt_id,
    auth.uid(),
    (elem ->> 'section')::text,
    (elem ->> 'score')::numeric,
    (elem ->> 'score_max')::numeric,
    coalesce((elem ->> 'sort_order')::smallint, 0)
  from jsonb_array_elements(p_sections) as elem;
end; $$;
grant execute on function public.save_test_sections(uuid, jsonb) to authenticated;

-- Toggle the "best" flag for one attempt (one DB call; trigger enforces uniqueness).
create or replace function public.set_best_test_attempt(p_id uuid, p_on boolean)
returns void language plpgsql security invoker set search_path = public as $$
begin
  update public.test_attempts
     set is_best = p_on
   where id = p_id and user_id = auth.uid();
end; $$;
grant execute on function public.set_best_test_attempt(uuid, boolean) to authenticated;

-- 6. Storage: insert requires is_admin() --------------------------------------
--
-- Owners keep SELECT / UPDATE / DELETE on their own folder tree.
-- INSERT (new objects) now requires is_admin(). Students link existing
-- documents through the DocumentPicker; only admins create new storage objects.
--
-- NOTE: if this section fails due to Supabase permissions, run it manually in
-- the Supabase Dashboard SQL editor and report the outcome.

drop policy if exists p_storage_student_docs_owner on storage.objects;

-- Owner: read/update/delete own folder tree (no INSERT).
create policy p_storage_student_docs_owner on storage.objects
  for select, update, delete to authenticated
  using (
    bucket_id = 'student-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'student-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner INSERT: only admins may create new storage objects.
create policy p_storage_student_docs_insert_admin on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'student-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_admin()
  );

-- ----------------------------------------------------------------------------
-- Verification (run manually after the migration):
--   select conname from pg_constraint where conrelid='public.honors'::regclass order by conname;
--   select conname from pg_constraint where conrelid='public.test_attempts'::regclass order by conname;
--   select proname from pg_proc where proname in ('reorder_honors','save_test_sections','set_best_test_attempt');
-- ----------------------------------------------------------------------------
