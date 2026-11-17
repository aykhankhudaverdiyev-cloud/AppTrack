-- ============================================================================
-- AppTrack — Migration 009: Honors & Tests corrective fix (`honors_tests_fix`)
-- ----------------------------------------------------------------------------
-- Fixes the bugs left by the ad-hoc application of migration 008
-- (`honors_tests_redesign`) which was never recorded in schema_migrations and
-- contains real defects:
--
--   1. trg_honors_top5_order (AFTER ... FOR EACH STATEMENT) calls
--      recompute_top5_order() which UPDATEs public.honors → the trigger fires
--      again → infinite recursion / stack depth limit exceeded.
--   2. recompute_top5_order() is SECURITY DEFINER, updates every user's rows,
--      bypasses RLS, and never clears top5_order for honors that left the top 5.
--   3. Storage INSERT policy "storage_student_docs_insert_admin 1j8zbmu_0"
--      (any authenticated user, any folder) was never dropped; permissive
--      policies are OR-ed so the new policy does not close the hole.
--   4. projects_status_check has no 'completed'.
--   5. save_test_sections casts (elem->>'score')::numeric which throws on
--      empty string; ignores display order; never checks attempt ownership.
--   6. enforce_one_best_attempt() is SECURITY DEFINER (unnecessary); no
--      unique index guarantees one "best" per test type + exam.
--   7. Missing check constraints: description, participants_context, subject,
--      issuer, verification_url on honors; top5_order bound; missing indexes.
--   8. honors_grade_levels_check allows grade 13 (everything else uses 9–12).
--   9. honors_title_length_check duplicates the existing honors_title_check.
--
-- Idempotent: safe to re-run. Leaves one correct final state.
-- ============================================================================

-- 0. Remove the broken ad-hoc objects ----------------------------------------

drop trigger if exists trg_honors_top5_order on public.honors;
drop function if exists public.recompute_top5_order();

drop trigger if exists trg_one_best_attempt on public.test_attempts;
drop function if exists public.enforce_one_best_attempt();

alter table public.honors drop constraint if exists honors_title_length_check;

-- 1. Projects: allow "completed" --------------------------------------------

alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects add constraint projects_status_check
  check (status in ('in_progress','live','paused','completed'));

-- 2. Honors: data rules ------------------------------------------------------

alter table public.honors drop constraint if exists honors_grade_levels_check;
alter table public.honors add constraint honors_grade_levels_check
  check (grade_levels <@ array[9,10,11,12]::smallint[]);

alter table public.honors drop constraint if exists honors_levels_check;
alter table public.honors add constraint honors_levels_check
  check (levels <@ array['school','city','regional','national','international']::text[]);

alter table public.honors drop constraint if exists honors_description_check;
alter table public.honors add constraint honors_description_check
  check (description is null or char_length(description) <= 350);

alter table public.honors drop constraint if exists honors_participants_context_check;
alter table public.honors add constraint honors_participants_context_check
  check (participants_context is null or char_length(participants_context) <= 120);

alter table public.honors drop constraint if exists honors_subject_check;
alter table public.honors add constraint honors_subject_check
  check (subject is null or char_length(subject) <= 60);

alter table public.honors drop constraint if exists honors_issuer_check;
alter table public.honors add constraint honors_issuer_check
  check (issuer is null or char_length(issuer) <= 150);

alter table public.honors drop constraint if exists honors_verification_url_check;
alter table public.honors add constraint honors_verification_url_check
  check (verification_url is null or verification_url ~* '^https?://');

alter table public.honors drop constraint if exists honors_top5_order_check;
alter table public.honors add constraint honors_top5_order_check
  check (top5_order is null or top5_order between 1 and 5);

create index if not exists idx_honors_user_sort on public.honors (user_id, sort_order);

-- 2a. At most 5 honors in the top 5; clear top5_order when switched off ------

create or replace function public.honors_top5_limit()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.is_top5_commonapp and (tg_op = 'INSERT' or not old.is_top5_commonapp) then
    if (select count(*) from public.honors
         where user_id = new.user_id and is_top5_commonapp and id <> new.id) >= 5 then
      raise exception 'TOP5_LIMIT' using errcode = 'P0001';
    end if;
  end if;
  if not new.is_top5_commonapp then new.top5_order := null; end if;
  return new;
end; $$;

drop trigger if exists trg_honors_top5_limit on public.honors;
create trigger trg_honors_top5_limit
  before insert or update of is_top5_commonapp on public.honors
  for each row execute function public.honors_top5_limit();

-- 2b. top5_order = position among the user's top-5 honors (row-level, no recursion)
create or replace function public.recompute_honor_top5(p_user uuid)
returns void language sql security invoker set search_path = public as $$
  update public.honors h
     set top5_order = r.rn
    from (
      select id,
             (case when is_top5_commonapp
                   then row_number() over (partition by is_top5_commonapp order by sort_order, created_at)
              end)::smallint as rn
        from public.honors where user_id = p_user
    ) r
   where h.id = r.id and h.user_id = p_user
     and h.top5_order is distinct from r.rn;
$$;

create or replace function public.honors_after_change()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  perform public.recompute_honor_top5(coalesce(new.user_id, old.user_id));
  return null;
end; $$;

drop trigger if exists trg_honors_top5_recompute on public.honors;
create trigger trg_honors_top5_recompute
  after insert or delete or update of is_top5_commonapp, sort_order on public.honors
  for each row execute function public.honors_after_change();

-- 2c. Atomic reorder (re-created for a clean state)
create or replace function public.reorder_honors(p_ids uuid[])
returns void language plpgsql security invoker set search_path = public as $$
begin
  update public.honors h
     set sort_order = x.ord::smallint
    from unnest(p_ids) with ordinality as x(id, ord)
   where h.id = x.id and h.user_id = auth.uid();
end; $$;
grant execute on function public.reorder_honors(uuid[]) to authenticated;

-- 3. Test attempts: data rules + exactly one "best" per test ----------------

alter table public.test_attempts drop constraint if exists test_attempts_overall_check;
alter table public.test_attempts add constraint test_attempts_score_check
  check (overall_score is null or (overall_score >= 0 and (overall_max is null or overall_score <= overall_max)));

alter table public.test_attempts drop constraint if exists test_attempts_dates_check;
alter table public.test_attempts add constraint test_attempts_expiry_check
  check (expires_on is null or test_date is null or expires_on > test_date);

alter table public.test_attempts drop constraint if exists test_attempts_attempt_number_check;
alter table public.test_attempts add constraint test_attempts_attempt_number_check
  check (attempt_number >= 1);

alter table public.test_attempts drop constraint if exists test_attempts_trf_check;
alter table public.test_attempts add constraint test_attempts_trf_check
  check (trf_number is null or char_length(trf_number) <= 40);

alter table public.test_attempts drop constraint if exists test_attempts_notes_check;
alter table public.test_attempts add constraint test_attempts_notes_check
  check (notes is null or char_length(notes) <= 500);

alter table public.test_attempts drop constraint if exists test_attempts_exam_name_check;
alter table public.test_attempts add constraint test_attempts_exam_name_check
  check (national_exam_name is null or char_length(national_exam_name) <= 100);

create unique index if not exists uq_test_attempts_best
  on public.test_attempts (user_id, test_type, coalesce(national_exam_name, '')) where is_best;

create index if not exists idx_test_attempts_user_type on public.test_attempts (user_id, test_type, test_date);

create or replace function public.set_best_test_attempt(p_id uuid, p_on boolean)
returns void language plpgsql security invoker set search_path = public as $$
declare t record;
begin
  select user_id, test_type, coalesce(national_exam_name, '') as n
    into t from public.test_attempts where id = p_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_on then
    update public.test_attempts
       set is_best = false
     where user_id = t.user_id and test_type = t.test_type
       and coalesce(national_exam_name, '') = t.n and is_best and id <> p_id;
  end if;
  update public.test_attempts set is_best = p_on where id = p_id;
end; $$;
grant execute on function public.set_best_test_attempt(uuid, boolean) to authenticated;

-- 4. Section scores: data rules, owner match, safe atomic save -------------

alter table public.test_section_scores drop constraint if exists test_section_scores_section_check;
alter table public.test_section_scores add constraint test_section_scores_section_check
  check (char_length(section) between 1 and 60);

alter table public.test_section_scores drop constraint if exists test_section_scores_score_check;
alter table public.test_section_scores add constraint test_section_scores_score_check
  check (score is null or (score >= 0 and (score_max is null or score <= score_max)));

create index if not exists idx_test_sections_attempt_sort on public.test_section_scores (attempt_id, sort_order);

create or replace function public.test_sections_owner_match()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if not exists (
    select 1 from public.test_attempts a
     where a.id = new.attempt_id and a.user_id = new.user_id
  ) then
    raise exception 'ATTEMPT_OWNER_MISMATCH';
  end if;
  return new;
end; $$;

drop trigger if exists trg_test_sections_owner on public.test_section_scores;
create trigger trg_test_sections_owner
  before insert or update of attempt_id, user_id on public.test_section_scores
  for each row execute function public.test_sections_owner_match();

create or replace function public.save_test_sections(p_attempt_id uuid, p_sections jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare v_user uuid;
begin
  select user_id into v_user from public.test_attempts where id = p_attempt_id;
  if v_user is null then raise exception 'NOT_FOUND'; end if;

  delete from public.test_section_scores s
   where s.attempt_id = p_attempt_id
     and not exists (
       select 1 from jsonb_array_elements(coalesce(p_sections, '[]'::jsonb)) e
       where nullif(e->>'id', '')::uuid = s.id
     );

  insert into public.test_section_scores (id, user_id, attempt_id, section, score, score_max, sort_order)
  select
    coalesce(nullif(e->>'id', '')::uuid, gen_random_uuid()),
    v_user, p_attempt_id,
    trim(e->>'section'),
    nullif(trim(e->>'score'), '')::numeric,
    nullif(trim(e->>'score_max'), '')::numeric,
    (x.ord - 1)::smallint
  from jsonb_array_elements(coalesce(p_sections, '[]'::jsonb)) with ordinality as x(e, ord)
  where nullif(trim(e->>'section'), '') is not null
  on conflict (id) do update
     set section = excluded.section, score = excluded.score,
         score_max = excluded.score_max, sort_order = excluded.sort_order;
end; $$;
grant execute on function public.save_test_sections(uuid, jsonb) to authenticated;

-- 5. A linked document must belong to the same user --------------------------

create or replace function public.assert_document_owner()
returns trigger language plpgsql security invoker set search_path = public as $$
declare v_doc uuid := nullif(to_jsonb(new)->>tg_argv[0], '')::uuid;
begin
  if v_doc is not null and not exists (
    select 1 from public.document_files d where d.id = v_doc and d.user_id = new.user_id
  ) then
    raise exception 'DOCUMENT_OWNER_MISMATCH';
  end if;
  return new;
end; $$;

drop trigger if exists trg_honors_doc_owner on public.honors;
create trigger trg_honors_doc_owner before insert or update of certificate_document_id on public.honors
  for each row execute function public.assert_document_owner('certificate_document_id');

drop trigger if exists trg_test_attempts_doc_owner on public.test_attempts;
create trigger trg_test_attempts_doc_owner before insert or update of report_document_id on public.test_attempts
  for each row execute function public.assert_document_owner('report_document_id');

drop trigger if exists trg_projects_doc_owner on public.projects;
create trigger trg_projects_doc_owner before insert or update of report_document_id on public.projects
  for each row execute function public.assert_document_owner('report_document_id');

-- 6. Storage: close the hole -------------------------------------------------

drop policy if exists "storage_student_docs_insert_admin 1j8zbmu_0" on storage.objects;
drop policy if exists p_storage_student_docs_insert_admin on storage.objects;

create policy p_storage_student_docs_insert_admin on storage.objects
  for insert to authenticated
  with check (bucket_id = 'student-documents' and public.is_admin());
