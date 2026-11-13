-- ============================================================================
-- AppTrack — Phase 0, Migration 001: Schema extensions (v2 — backend-aware)
-- ----------------------------------------------------------------------------
-- AUDITED AGAINST THE LIVE DATABASE:
--   Legacy/stale tables that already exist and are NEVER touched here:
--     profiles, applications, application_documents, licenses, license_media,
--     visibility_requests                      (the 6 tables the app uses today)
--     students, education, recommendations, documents, profile2s, user_roles,
--     admin_notes, change_requests, notifications, notification_settings
--                                              (leftovers from earlier work)
--   The NEW library table is named `document_files` to avoid any collision
--   with the legacy `documents` table (this was the cause of a previous
--   "column user_id does not exist" failure in migration 002).
--
-- WHAT THIS SCRIPT DOES:
--   1. Drops and recreates AppTrack's 33 NEW tables (they were created
--      minutes ago and contain no data — safe). Legacy tables above are NOT
--      in the drop list.
--   2. Extends `profiles` and `applications` with new columns (additive only).
--   3. Creates triggers and indexes.
--
-- IDEMPOTENT: safe to run multiple times.
-- ============================================================================

-- ============================================================================
-- 0. Drop ONLY the new tables (fresh recreate; legacy tables untouched)
-- ============================================================================
drop table if exists public.reminders cascade;
drop table if exists public.portfolio_items cascade;
drop table if exists public.links cascade;
drop table if exists public.scholarships cascade;
drop table if exists public.aid_forms cascade;
drop table if exists public.financial_profile cascade;
drop table if exists public.recommendation_assignments cascade;
drop table if exists public.recommenders cascade;
drop table if exists public.document_links cascade;
drop table if exists public.document_versions cascade;
drop table if exists public.document_files cascade;
drop table if exists public.application_essays cascade;
drop table if exists public.essay_shares cascade;
drop table if exists public.essay_comments cascade;
drop table if exists public.essay_versions cascade;
drop table if exists public.essays cascade;
drop table if exists public.supervisor_contacts cascade;
drop table if exists public.interviews cascade;
drop table if exists public.application_requirements cascade;
drop table if exists public.application_deadlines cascade;
drop table if exists public.application_choices cascade;
drop table if exists public.publications cascade;
drop table if exists public.projects cascade;
drop table if exists public.activities cascade;
drop table if exists public.honors cascade;
drop table if exists public.score_sending cascade;
drop table if exists public.test_section_scores cascade;
drop table if exists public.test_attempts cascade;
drop table if exists public.grade_rows cascade;
drop table if exists public.education_entries cascade;
drop table if exists public.parents cascade;
drop table if exists public.profile_private cascade;
drop table if exists public.universities cascade;

-- ============================================================================
-- 1. UNIVERSITIES (seeded reference table for autocomplete)
-- ============================================================================
create table public.universities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  country    text not null,          -- ISO 3166-1 alpha-2, e.g. 'AZ', 'US'
  city       text,
  created_at timestamptz not null default now(),
  unique (name, country)
);
create index idx_universities_name on public.universities (lower(name));
create index idx_universities_country on public.universities (country);

-- ============================================================================
-- 1b. DOCUMENT FILES — unified library (Section 12)  [created early:
--      test_attempts/honors/projects/publications/applications hold FK refs to it]
--     Named `document_files` (NOT `documents`) because a legacy `documents`
--     table already exists in this database and must stay untouched.
-- ============================================================================
create table public.document_files (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
  category     text not null check (category in
    ('passport','national_id','photo',
     'transcript','translated_transcript','diploma','enrollment_certificate','predicted_grades',
     'test_report','english_certificate','cv_resume','essay_export',
     'award_certificate','course_certificate',
     'bank_statement','financial_aid_document','sponsor_letter',
     'recommendation_copy','portfolio','research_proposal','writing_sample',
     'university_form','decision_letter','other')),
  issue_date   date,
  expiry_date  date,             -- alerts: passport, scores, bank statements
  language     text,
  is_translated boolean not null default false,
  is_certified  boolean not null default false,
  is_apostille  boolean not null default false,
  version      smallint not null default 1,
  file_path    text not null,    -- Supabase Storage, PRIVATE bucket
  mime_type    text,
  size_bytes   bigint,
  -- PRINCIPLE #6: sensitive categories can NEVER be public (enforced by CHECK
  -- below + RLS in 002, so even direct API calls cannot flip it)
  is_public    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint document_files_public_only_for_showcase check (
    is_public = false or category in
      ('cv_resume','award_certificate','course_certificate','portfolio',
       'research_proposal','writing_sample','university_form','other')
  )
);
create index idx_document_files_user     on public.document_files (user_id);
create index idx_document_files_category on public.document_files (category);
create index idx_document_files_expiry   on public.document_files (expiry_date);

-- ============================================================================
-- 2. PROFILE — new columns (structured names, goals, graduate fields)
-- ============================================================================
alter table public.profiles
  add column if not exists given_name        text,
  add column if not exists middle_name       text,
  add column if not exists family_name       text,
  add column if not exists preferred_name    text,
  add column if not exists passport_name     text,   -- "exactly as in passport" (HKU/NTU/visa)
  add column if not exists native_script_name text,  -- optional
  add column if not exists pronouns          text,
  add column if not exists phone_country_code text,
  add column if not exists phone_e164        text,   -- E.164, validated with libphonenumber
  add column if not exists languages         jsonb not null default '[]'::jsonb, -- [{name, proficiency}]
  add column if not exists first_generation  boolean,
  -- Goals
  add column if not exists applying_level    text
    check (applying_level is null or applying_level in
      ('bachelor_first_year','transfer','master','phd','exchange')),
  add column if not exists start_term        text,   -- e.g. 'Fall 2027'
  add column if not exists intended_major_1  text,
  add column if not exists intended_major_2  text,
  add column if not exists will_apply_financial_aid boolean,
  add column if not exists gap_year_planned  boolean,
  add column if not exists committed_university text, -- DEPRECATED: dropped again in 005 (single-university concept removed)
  -- Graduate only
  add column if not exists grad_current_degree  text,
  add column if not exists grad_degree_status   text,
  add column if not exists work_experience_years numeric,
  add column if not exists research_interests   text[] default '{}',
  add column if not exists orcid         text,
  add column if not exists google_scholar text,
  add column if not exists linkedin      text,
  -- Counselor link (RLS anchor for NEW tables only).
  -- Legacy `assigned_counselor` (text) stays exactly as-is.
  add column if not exists counselor_id  uuid references public.profiles(id) on delete set null;

-- ============================================================================
-- 3. PROFILE_PRIVATE — 1:1 sensitive data (NEVER public, RLS-enforced in 002)
--    Passport, DOB, addresses, household. Separate table = cannot leak
--    through `select *` on profiles by another authenticated user.
-- ============================================================================
create table public.profile_private (
  user_id            uuid primary key references public.profiles(id) on delete cascade,
  date_of_birth      date,
  country_of_birth   text,
  citizenships       text[] default '{}',
  dual_citizenship   boolean default false,
  passport_number    text,
  passport_expiry    date,
  permanent_address  text,
  current_address    text,
  household_size     smallint,
  siblings           smallint,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ============================================================================
-- 4. PARENTS / GUARDIANS (private; up to 2 parents + 1 guardian)
-- ============================================================================
create table public.parents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  kind            text not null check (kind in ('mother','father','guardian')),
  full_name       text not null,
  relationship    text,
  is_living       boolean not null default true,
  education_level text,
  occupation      text,
  employer        text,
  email           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_parents_user on public.parents (user_id);

-- ============================================================================
-- 5. EDUCATION
-- ============================================================================
create table public.education_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  entry_type  text not null check (entry_type in
    ('secondary_school','university','pre_college','foundation_year')),
  institution_name text not null,
  country     text,
  city        text,
  ceeb_code   text,
  language_of_instruction text,
  start_date  date,
  end_date    date,              -- or expected graduation
  is_current  boolean not null default false,
  -- Secondary school (Bachelor)
  qualification text,            -- 'Attestat', 'IB', 'A-Level', 'AP', 'American HS Diploma', 'Other'
  grading_scale text,            -- '1-5', '0-100', '4.0', '1-7', ...
  overall_average numeric,
  scale_maximum numeric,
  class_rank    smallint,
  class_size    smallint,
  school_does_not_rank boolean default false,
  current_year_courses text,
  predicted_grades      text,
  mid_year_grades       text,
  school_counselor_name  text,
  school_counselor_email text,
  school_counselor_phone text,
  -- University (Master/PhD/Transfer)
  degree        text,            -- 'BSc', 'BA', 'BEng', 'MSc', ...
  major         text,
  minor         text,
  gpa           numeric,
  gpa_scale     numeric,
  credits_completed numeric,
  honours_classification text,   -- 'First Class', 'cum laude', ...
  rank_percentile numeric,
  thesis_title  text,
  thesis_supervisor text,
  thesis_abstract text,
  credential_eval_status text check (credential_eval_status is null or credential_eval_status in
    ('not_needed','in_progress','completed')),
  credential_eval_provider text, -- 'WES', 'ECE', 'SpanTran', ...
  credential_eval_number text,
  sort_order smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_education_user on public.education_entries (user_id);

-- Grades table: Subject x (Grade level x Semester) — HKU/NTU type-in forms
create table public.grade_rows (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  entry_id    uuid not null references public.education_entries(id) on delete cascade,
  subject     text not null,
  grade_level smallint check (grade_level between 9 and 14),
  semester    smallint check (semester between 1 and 3),
  grade       text,
  is_predicted boolean not null default false,
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_grade_rows_entry on public.grade_rows (entry_id);
create index idx_grade_rows_user  on public.grade_rows (user_id);

-- ============================================================================
-- 6. TEST SCORES
-- ============================================================================
create table public.test_attempts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  test_type      text not null check (test_type in
    ('SAT','ACT','PSAT','AP','IB','ALEVEL','IELTS','TOEFL','DUOLINGO','PTE',
     'CAMBRIDGE_C1','CAMBRIDGE_C2','GRE','GMAT','NATIONAL_EXAM','OTHER')),
  status         text not null default 'planned' check (status in
    ('planned','registered','taken_waiting','released')),
  attempt_number smallint not null default 1,
  test_date      date,           -- required for planned/registered (shows in Deadlines)
  overall_score  numeric,
  overall_max    numeric,
  -- type-specific references
  trf_number     text,           -- IELTS
  is_home_edition boolean default false,  -- TOEFL
  is_mybest      boolean default false,   -- TOEFL MyBest
  national_exam_name text,       -- e.g. 'Azerbaijan DIM'
  expires_on     date,           -- IELTS/TOEFL/Duolingo/PTE: +2y; GRE/GMAT: +5y
  is_best        boolean not null default false,  -- flagged automatically (app logic)
  notes          text,
  report_document_id uuid references public.document_files(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index idx_test_attempts_user on public.test_attempts (user_id);

create table public.test_section_scores (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  attempt_id uuid not null references public.test_attempts(id) on delete cascade,
  section    text not null,      -- 'RW','Math','English','L','R','W','S','Verbal','Quant','AWA', AP/IB subject...
  score      numeric,
  score_max  numeric,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_test_sections_attempt on public.test_section_scores (attempt_id);
create index idx_test_sections_user    on public.test_section_scores (user_id);

-- Score sending tracker (per application)
create table public.score_sending (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  attempt_id     uuid not null references public.test_attempts(id) on delete cascade,
  requirement    text not null default 'required' check (requirement in
    ('required','optional','test_blind')),
  self_reported  boolean not null default true,
  official_sent  boolean not null default false,
  sent_on        date,
  delivery_confirmed boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (application_id, attempt_id)
);
create index idx_score_sending_user on public.score_sending (user_id);

-- ============================================================================
-- 7. HONORS & AWARDS
-- ============================================================================
create table public.honors (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  title        text not null check (char_length(title) <= 100),  -- Common App limit
  levels       text[] not null default '{}',   -- 'school','state_regional','national','international'
  grade_levels smallint[] not null default '{}', -- 9,10,11,12,13(post-grad) | uni years for grad
  received_month smallint check (received_month between 1 and 12),
  received_year  smallint,
  category     text check (category is null or category in
    ('academic_olympiad','research','competition_hackathon','scholarship','arts','sports','leadership','other')),
  result       text check (result is null or result in
    ('gold_first','silver_second','bronze_third','finalist','semifinalist','honourable_mention','other')),
  subject      text,
  issuer       text,
  participants_context text,    -- e.g. '600 participants, top 5%'
  description  text,
  certificate_document_id uuid references public.document_files(id) on delete set null,
  verification_url text,
  is_top5_commonapp boolean not null default false,
  top5_order   smallint,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_honors_user on public.honors (user_id);

-- ============================================================================
-- 8. ACTIVITIES & EXPERIENCES (one unified list)
-- ============================================================================
create table public.activities (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  activity_type    text not null default 'other_club',  -- Common App categories, see src/constants/activityTypes.js
  position         text check (char_length(position) <= 50),   -- optional, CA limit
  organization_name text check (char_length(organization_name) <= 100),
  description      text check (char_length(description) <= 150), -- CA limit
  long_description text,          -- no limit; CV / UC 350 / scholarships
  grade_levels     smallint[] not null default '{}',
  timing           text check (timing is null or timing in ('school_year','school_break','all_year')),
  hours_per_week   numeric check (hours_per_week is null or hours_per_week between 0 and 168),
  weeks_per_year   numeric check (weeks_per_year is null or weeks_per_year between 0 and 52),
  start_date       date,
  end_date         date,
  ongoing          boolean not null default false,
  city             text,
  country          text,
  participation_mode text check (participation_mode is null or participation_mode in ('online','in_person','hybrid')),
  impact_metrics   jsonb not null default '[]'::jsonb, -- [{value: 30, label: 'students taught'}]
  supervisor_name  text,          -- private: verification + possible recommender
  supervisor_email text,
  -- Work-specific
  is_paid          boolean,
  employment_type  text check (employment_type is null or employment_type in ('internship','part_time','full_time')),
  industry         text,
  earnings_for_family boolean default false,
  -- Research-specific
  research_mentor        text,
  research_institution   text,
  research_question      text,
  output_status text default 'in_progress' check (output_status in
    ('in_progress','under_review','submitted','accepted','published')),
  plan_to_continue boolean,
  sort_order       smallint not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index idx_activities_user on public.activities (user_id);

-- ============================================================================
-- 9. PROJECTS & RESEARCH
-- ============================================================================
create table public.projects (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  title          text not null,
  project_type   text check (project_type is null or project_type in
    ('software_app','hardware_engineering','research_paper','data_analysis','competition_project','creative_work','other')),
  role_type      text check (role_type is null or role_type in ('solo','team')),
  team_size      smallint,
  my_contribution text,          -- required for team projects (app-level validation)
  start_date     date,
  end_date       date,
  status         text default 'in_progress' check (status in
    ('idea','in_progress','completed','maintained')),
  problem        text,
  method         text,
  result         text,
  result_metrics text,           -- e.g. 'reduced runtime 40%'
  tech_tags      text[] not null default '{}',
  github_url     text,
  demo_url       text,
  video_url      text,
  paper_url      text,           -- DOI / arXiv
  report_document_id uuid references public.document_files(id) on delete set null,
  mentor_name    text,           -- private
  related_activity_id uuid references public.activities(id) on delete set null,
  related_honor_id    uuid references public.honors(id) on delete set null,
  visibility     text not null default 'private' check (visibility in ('private','public')),
  short_description text,        -- legacy field from current modal
  link           text,           -- legacy field from current modal
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index idx_projects_user on public.projects (user_id);

-- ============================================================================
-- 10. PUBLICATIONS (Master/PhD; optional for others)
-- ============================================================================
create table public.publications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  title         text not null,
  authors       text[] not null default '{}',
  my_author_position smallint,   -- highlighted in UI
  venue         text,            -- journal / conference
  pub_year      smallint,
  doi_url       text,
  pub_type      text check (pub_type is null or pub_type in
    ('journal','conference','preprint','poster','thesis')),
  peer_reviewed boolean,
  status        text default 'in_preparation' check (status in
    ('in_preparation','submitted','under_review','accepted','published')),
  pdf_document_id uuid references public.document_files(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_publications_user on public.publications (user_id);

-- ============================================================================
-- 11. APPLICATIONS — new columns on the EXISTING table (additive only)
-- ============================================================================
alter table public.applications
  add column if not exists university_id uuid references public.universities(id) on delete set null,
  add column if not exists campus        text,
  add column if not exists degree_level  text check (degree_level is null or degree_level in
    ('bachelor','master','phd','foundation','transfer','exchange','dual_degree')),
  add column if not exists term_season   text check (term_season is null or term_season in
    ('Fall','Spring','Winter','Summer')),
  add column if not exists term_year     smallint,
  add column if not exists deferred_entry boolean default false,
  -- Platform & round
  add column if not exists platform      text check (platform is null or platform in
    ('common_app','uc_application','coalition_scoir','ucas','questbridge','ouac','university_portal','other')),
  add column if not exists round         text check (round is null or round in
    ('ed1','ed2','ea','rea_scea','rd','rolling','priority','round1','round2','round3',
     'uk_oct15','uk_jan_equal')),
  add column if not exists is_binding    boolean default false,
  -- Portal (NO passwords — principle #7)
  add column if not exists portal_url    text,
  add column if not exists portal_email  text,
  add column if not exists applicant_id  text,   -- reference number
  add column if not exists portal_activated boolean default false,
  -- Fee
  add column if not exists fee_amount    numeric,
  add column if not exists fee_currency  text,
  add column if not exists fee_waiver_requested boolean default false,
  add column if not exists fee_waiver_granted   boolean default false,
  add column if not exists fee_paid_on   date,
  -- Fit
  add column if not exists fit           text check (fit is null or fit in ('reach','target','likely')),
  add column if not exists fit_reason    text,
  add column if not exists acceptance_rate numeric,
  -- "Why this university" research notes
  add column if not exists why_courses    text,
  add column if not exists why_professors text,
  add column if not exists why_programs   text,
  add column if not exists why_links      text,
  -- Progress (computed from the checklist, cached here)
  add column if not exists progress_percent smallint default 0
    check (progress_percent between 0 and 100),
  -- Decision extensions
  add column if not exists decision_conditions text,   -- e.g. 'IELTS 7.0, A*AA'
  add column if not exists decision_at         timestamptz,
  add column if not exists reply_deadline_at   timestamptz,
  add column if not exists reply_deadline_tz   text,
  add column if not exists decision_letter_document_id uuid references public.document_files(id) on delete set null,
  add column if not exists committed_at        timestamptz,
  -- Aid result
  add column if not exists aid_scholarship_name text,
  add column if not exists aid_amount           numeric,
  add column if not exists aid_currency         text,
  add column if not exists aid_period           text check (aid_period is null or aid_period in ('per_year','total')),
  add column if not exists aid_renewal_conditions text,
  add column if not exists net_cost_per_year    numeric,
  -- Aid policy
  add column if not exists aid_policy text check (aid_policy is null or aid_policy in
    ('need_blind','need_aware','merit_only','none_international','unknown')),
  add column if not exists updated_at timestamptz not null default now();

-- Ranked program choices (HKU up to 3, NTU up to 5)
create table public.application_choices (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  rank_order     smallint not null default 1,
  program_name   text not null,
  program_code   text,           -- e.g. HKU 6999
  major          text,
  minor          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index idx_app_choices_application on public.application_choices (application_id);

-- Deadlines with ORIGINAL time zone (core principle #5)
create table public.application_deadlines (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  application_id   uuid not null references public.applications(id) on delete cascade,
  kind             text not null check (kind in
    ('application','supplements','documents','financial_aid','scholarship','interview_request','reply_deposit')),
  label            text,
  due_at           timestamptz not null,
  original_timezone text not null default 'UTC',  -- IANA, e.g. 'Asia/Hong_Kong'
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index idx_app_deadlines_application on public.application_deadlines (application_id);
create index idx_app_deadlines_user        on public.application_deadlines (user_id);
create index idx_app_deadlines_due         on public.application_deadlines (due_at);

-- Requirements checklist (generated by app from level+platform+country, editable)
create table public.application_requirements (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  req_key        text not null,  -- stable key, e.g. 'essay_common_app', 'rec_teacher_1', 'css_profile'
  label          text not null,
  status         text not null default 'not_started' check (status in
    ('not_started','in_progress','done','submitted','waived')),
  meta           jsonb not null default '{}'::jsonb, -- e.g. {css_code:'1234', count:2}
  sort_order     smallint not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (application_id, req_key)
);
create index idx_app_reqs_application on public.application_requirements (application_id);

-- Interviews (repeatable per application)
create table public.interviews (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  scheduled_at   timestamptz,
  original_timezone text default 'UTC',
  interview_type text check (interview_type is null or interview_type in
    ('alumni','faculty','group','admissions_officer','recorded_video','other')),
  interviewer    text,
  prep_notes     text,
  thank_you_sent_on date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index idx_interviews_application on public.interviews (application_id);

-- PhD supervisor contact log (Section 18)
create table public.supervisor_contacts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  professor_name text not null,
  lab            text,
  email          text,
  match_notes    text,
  first_contacted_on date,
  reply_status   text default 'not_contacted' check (reply_status in
    ('not_contacted','contacted','replied','meeting','declined','offer')),
  follow_ups     jsonb not null default '[]'::jsonb, -- [{date, note}]
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index idx_supervisor_contacts_application on public.supervisor_contacts (application_id);

-- ============================================================================
-- 12. ESSAYS (new, highest priority — Section 10)
-- ============================================================================
create table public.essays (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  essay_type  text not null check (essay_type in
    ('common_app_personal','supplement','short_answer','uc_piq','ucas_personal_statement',
     'additional_info','personal_statement','study_plan','autobiography',
     'statement_of_purpose','personal_history_diversity','research_statement','writing_sample',
     'scholarship','other')),
  prompt_text text,
  limit_value  smallint,
  limit_type   text not null default 'words' check (limit_type in ('words','characters','none')),
  min_value    smallint,
  status       text not null default 'brainstorm' check (status in
    ('brainstorm','draft','counselor_review','revising','final','submitted')),
  content     text not null default '',
  notes       text,
  -- privacy: essays are ALWAYS private; sharing = explicit per-user rows in essay_shares
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_essays_user on public.essays (user_id);

create table public.essay_versions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  essay_id   uuid not null references public.essays(id) on delete cascade,
  version    smallint not null default 1,
  content    text not null default '',
  word_count int,
  char_count int,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (essay_id, version)
);
create index idx_essay_versions_essay on public.essay_versions (essay_id);

create table public.essay_comments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade, -- essay owner
  essay_id      uuid not null references public.essays(id) on delete cascade,
  version_id    uuid references public.essay_versions(id) on delete cascade,
  author_id     uuid not null references public.profiles(id) on delete cascade, -- counselor/teacher
  selected_text text,
  anchor_start  int,
  anchor_end    int,
  comment       text not null,
  suggestion    text,
  resolved      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_essay_comments_essay on public.essay_comments (essay_id);

-- Explicit sharing ("share with specific user", NEVER public)
create table public.essay_shares (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade, -- essay owner
  essay_id    uuid not null references public.essays(id) on delete cascade,
  shared_with uuid not null references public.profiles(id) on delete cascade,
  can_comment boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (essay_id, shared_with)
);
create index idx_essay_shares_essay on public.essay_shares (essay_id);

-- Link essays to applications (many-to-many) + per-university AI rules note
create table public.application_essays (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  essay_id       uuid not null references public.essays(id) on delete cascade,
  ai_rules_note  text,           -- per-university writing-assistance policy (integrity, Section 10)
  created_at     timestamptz not null default now(),
  unique (application_id, essay_id)
);
create index idx_application_essays_application on public.application_essays (application_id);
create index idx_application_essays_essay       on public.application_essays (essay_id);


create table public.document_versions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  document_id uuid not null references public.document_files(id) on delete cascade,
  version     smallint not null default 1,
  file_path   text not null,
  note        text,
  created_at  timestamptz not null default now(),
  unique (document_id, version)
);
create index idx_document_versions_document on public.document_versions (document_id);

-- many-to-many: document file ↔ application, with per-application status
create table public.document_links (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  document_id    uuid not null references public.document_files(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  status         text not null default 'needed' check (status in
    ('needed','uploaded_to_portal','sent','confirmed')),
  created_at     timestamptz not null default now(),
  unique (document_id, application_id)
);
create index idx_document_links_application on public.document_links (application_id);
create index idx_document_links_document    on public.document_links (document_id);

-- ============================================================================
-- 14. RECOMMENDATIONS (Section 13)
-- ============================================================================
create table public.recommenders (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  title          text check (title is null or title in ('mr','ms','dr','prof')),
  full_name      text not null,
  recommender_role text not null check (recommender_role in
    ('school_counselor','teacher','professor','research_supervisor','employer','coach','other')),
  subject        text,           -- for teachers
  relationship   text,
  years_known    numeric,
  institution    text,
  email          text,
  phone          text,
  letter_language text,
  translation_needed boolean not null default false,
  translator_name text,
  ferpa_waived   boolean,        -- US: waived letters are trusted more
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index idx_recommenders_user on public.recommenders (user_id);

-- Per-application assignment: one recommender writes for many universities
create table public.recommendation_assignments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  recommender_id uuid not null references public.recommenders(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  due_date       date,
  method         text check (method is null or method in
    ('common_app_invite','ucas_reference','portal_link','email','school_rep','paper')),
  status         text not null default 'not_asked' check (status in
    ('not_asked','asked','agreed','invited','submitted','confirmed','declined')),
  last_reminder_at timestamptz,
  brag_sheet_sent boolean not null default false,
  cv_sent         boolean not null default false,
  asked_on        date,
  thank_you_sent_on date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (recommender_id, application_id)
);
create index idx_rec_assignments_application on public.recommendation_assignments (application_id);
create index idx_rec_assignments_recommender on public.recommendation_assignments (recommender_id);

-- ============================================================================
-- 15. FINANCIAL AID & SCHOLARSHIPS (Section 14) — private, NEVER public
-- ============================================================================
create table public.financial_profile (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  currency       text not null default 'AZN',
  annual_income  numeric,
  assets         numeric,
  debts          numeric,
  household_size smallint,
  num_in_university smallint,
  special_circumstances text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.aid_forms (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  form_type      text not null check (form_type in
    ('css_profile','isfaa','institutional','fafsa','other')),
  school_code    text,           -- e.g. CSS Profile school code
  deadline_at    timestamptz,
  original_timezone text default 'UTC',
  status         text not null default 'not_started' check (status in
    ('not_started','in_progress','submitted','confirmed','waived')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (application_id, form_type)
);
create index idx_aid_forms_application on public.aid_forms (application_id);

create table public.scholarships (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  name           text not null,
  provider       text,
  amount         numeric,
  currency       text,
  amount_period  text check (amount_period is null or amount_period in ('per_year','total')),
  deadline_at    timestamptz,
  original_timezone text default 'UTC',
  requirements   text,
  essay_id       uuid references public.essays(id) on delete set null,
  status         text default 'researching' check (status in
    ('researching','in_progress','submitted','won','rejected','waitlisted')),
  result         text,
  renewal_conditions text,       -- e.g. 'min GPA 3.0'
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index idx_scholarships_user on public.scholarships (user_id);

-- ============================================================================
-- 16. LINKS & PORTFOLIO (Section 16)
-- ============================================================================
create table public.links (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  link_type  text not null check (link_type in
    ('github','personal_website','linkedin','orcid','google_scholar','codeforces','leetcode',
     'kaggle','behance','dribbble','youtube','slideroom','other')),
  url        text not null,
  description text,
  project_id uuid references public.projects(id) on delete set null,
  visibility text not null default 'private' check (visibility in ('private','public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_links_user on public.links (user_id);

create table public.portfolio_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  medium     text,
  dimensions text,
  year       smallint,
  file_path  text,               -- image/PDF/video, private bucket, signed URL
  is_original boolean not null default true,  -- "original work" confirmation
  visibility text not null default 'private' check (visibility in ('private','public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_portfolio_user on public.portfolio_items (user_id);

-- ============================================================================
-- 17. REMINDERS (Section 15: 30/14/7/3/1 days + day-of)
-- ============================================================================
create table public.reminders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null,     -- 'application_deadline','recommendation','scholarship','test_date','interview','reply_deposit'
  entity_id   uuid,
  remind_at   timestamptz not null,
  channel     text not null default 'in_app' check (channel in ('in_app','email')),
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index idx_reminders_user on public.reminders (user_id);
create index idx_reminders_due  on public.reminders (remind_at);

-- ============================================================================
-- 18. updated_at trigger (applies to every new table with updated_at)
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profile_private','parents','education_entries','grade_rows','test_attempts',
    'test_section_scores','score_sending','honors','activities','projects','publications',
    'application_choices','application_deadlines','application_requirements',
    'interviews','supervisor_contacts','essays','essay_versions','essay_comments',
    'essay_shares','application_essays','document_files','document_versions','document_links',
    'recommenders','recommendation_assignments','financial_profile','aid_forms','scholarships',
    'links','portfolio_items'
  ]
  loop
    execute format('drop trigger if exists trg_%s_updated_at on public.%I', t, t);
    execute format(
      'create trigger trg_%s_updated_at before update on public.%I
       for each row execute function public.set_updated_at()', t, t);
  end loop;
end;
$$;

-- ============================================================================
-- 19. Helpful indexes on existing tables (safe, additive)
-- ============================================================================
create index if not exists idx_applications_student on public.applications (student_id);
create index if not exists idx_app_documents_application on public.application_documents (application_id);
