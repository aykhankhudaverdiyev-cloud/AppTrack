-- ============================================================================
-- AppTrack — Migration 011: Education data rules (`education_constraints`)
-- ----------------------------------------------------------------------------
-- The Education panel lets a student type anything, so every rule the UI shows
-- is enforced here as well. The table is small (one row per school) and the
-- existing data was checked clean before these constraints were added.
--
--   1. education_entries.final_grade_level — the last grade of that school
--      (10 for schools ending at grade 10, 11 for the Azerbaijani diploma,
--      12/13/14 for IB, A Levels and other systems). Drives the grade table
--      columns, so it can no longer be guessed from the dates alone.
--   2. CHECK constraints on education_entries (names, dates, scales, rank,
--      counselor e-mail, CEEB code, thesis abstract).
--   3. CHECK constraints on grade_rows (subject name, grade text length) plus
--      a unique index that makes a duplicate subject × grade × semester
--      impossible even if two tabs save at once.
--   4. grade_rows owner-match trigger — a grade row must belong to the same
--      user as its entry.
--   5. rpc save_grade_rows(entry_id, rows) — the grade table saves through one
--      SECURITY INVOKER function: delete + insert in a single transaction, so
--      a half-saved table is impossible and a cleared cell really deletes.
--
-- Idempotent: safe to re-run. RLS is unchanged.
-- ============================================================================

-- 1. Final grade level --------------------------------------------------------

alter table public.education_entries
  add column if not exists final_grade_level smallint not null default 12;

alter table public.education_entries drop constraint if exists education_entries_final_grade_level_check;
alter table public.education_entries add constraint education_entries_final_grade_level_check
  check (final_grade_level between 10 and 14);

-- 2. education_entries rules --------------------------------------------------

alter table public.education_entries drop constraint if exists education_entries_name_check;
alter table public.education_entries add constraint education_entries_name_check
  check (char_length(btrim(institution_name)) between 1 and 200);

alter table public.education_entries drop constraint if exists education_entries_dates_check;
alter table public.education_entries add constraint education_entries_dates_check
  check (start_date is null or end_date is null or end_date >= start_date);

alter table public.education_entries drop constraint if exists education_entries_scale_maximum_check;
alter table public.education_entries add constraint education_entries_scale_maximum_check
  check (scale_maximum is null or scale_maximum > 0);

alter table public.education_entries drop constraint if exists education_entries_overall_average_check;
alter table public.education_entries add constraint education_entries_overall_average_check
  check (overall_average is null or (
    overall_average >= 0
    and (scale_maximum is null or overall_average <= scale_maximum)
  ));

alter table public.education_entries drop constraint if exists education_entries_gpa_check;
alter table public.education_entries add constraint education_entries_gpa_check
  check (gpa is null or (
    gpa >= 0
    and (gpa_scale is null or gpa <= gpa_scale)
  ));

alter table public.education_entries drop constraint if exists education_entries_class_rank_check;
alter table public.education_entries add constraint education_entries_class_rank_check
  check (
    (class_rank is null or class_rank >= 1)
    and (class_size is null or class_size >= 1)
    and (class_rank is null or class_size is null or class_rank <= class_size)
  );

-- "School does not rank" means no rank at all — not a hidden rank.
alter table public.education_entries drop constraint if exists education_entries_no_rank_check;
alter table public.education_entries add constraint education_entries_no_rank_check
  check (not coalesce(school_does_not_rank, false) or class_rank is null);

alter table public.education_entries drop constraint if exists education_entries_counselor_email_check;
alter table public.education_entries add constraint education_entries_counselor_email_check
  check (
    school_counselor_email is null
    or school_counselor_email = ''
    or school_counselor_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$'
  );

alter table public.education_entries drop constraint if exists education_entries_ceeb_check;
alter table public.education_entries add constraint education_entries_ceeb_check
  check (ceeb_code is null or char_length(ceeb_code) <= 10);

alter table public.education_entries drop constraint if exists education_entries_thesis_abstract_check;
alter table public.education_entries add constraint education_entries_thesis_abstract_check
  check (thesis_abstract is null or char_length(thesis_abstract) <= 1500);

-- 3. grade_rows rules ---------------------------------------------------------

alter table public.grade_rows drop constraint if exists grade_rows_subject_check;
alter table public.grade_rows add constraint grade_rows_subject_check
  check (char_length(btrim(subject)) between 1 and 80);

-- Grade values are text ("5", "4.5", "A*"), never long.
alter table public.grade_rows drop constraint if exists grade_rows_grade_check;
alter table public.grade_rows add constraint grade_rows_grade_check
  check (grade is null or char_length(grade) <= 10);

-- 4. A grade row belongs to the same user as its entry ------------------------

create or replace function public.assert_grade_row_owner()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if not exists (
    select 1 from public.education_entries e
    where e.id = new.entry_id and e.user_id = new.user_id
  ) then
    raise exception 'GRADE_ROW_OWNER_MISMATCH';
  end if;
  return new;
end; $$;

drop trigger if exists trg_grade_rows_owner on public.grade_rows;
create trigger trg_grade_rows_owner
  before insert or update on public.grade_rows
  for each row execute function public.assert_grade_row_owner();

-- One row per subject × grade level × semester (semester null = final grade).
create unique index if not exists grade_rows_unique_cell
  on public.grade_rows (
    entry_id,
    lower(btrim(subject)),
    grade_level,
    coalesce(semester, 0)
  );

-- 5. save_grade_rows ----------------------------------------------------------

create or replace function public.save_grade_rows(p_entry_id uuid, p_rows jsonb default '[]'::jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_count integer := 0;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if not exists (
    select 1 from public.education_entries e
    where e.id = p_entry_id and e.user_id = v_user
  ) then
    raise exception 'ENTRY_NOT_FOUND';
  end if;

  -- The function body runs as one transaction: either the whole table saves or
  -- nothing changes.
  delete from public.grade_rows
   where entry_id = p_entry_id and user_id = v_user;

  insert into public.grade_rows (user_id, entry_id, subject, grade_level, semester, grade, is_predicted, sort_order)
  select
    v_user,
    p_entry_id,
    btrim(row.subject),
    row.grade_level,
    row.semester,
    nullif(btrim(row.grade), ''),
    coalesce(row.is_predicted, false),
    coalesce(row.sort_order, 0)
  from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as row(
    subject text,
    grade_level smallint,
    semester smallint,
    grade text,
    is_predicted boolean,
    sort_order smallint
  )
  where char_length(btrim(coalesce(row.subject, ''))) between 1 and 80
    and (row.grade is null or nullif(btrim(row.grade), '') is not null);

  get diagnostics v_count = row_count;
  return v_count;
end; $$;

grant execute on function public.save_grade_rows(uuid, jsonb) to authenticated;

comment on function public.save_grade_rows(uuid, jsonb) is
  'Replace an education entry''s grade rows (delete + insert, one transaction).';
