-- ============================================================================
-- AppTrack — Phase 0, Migration 002: Row Level Security policies
-- ----------------------------------------------------------------------------
-- PRINCIPLE #6: privacy is enforced in the DATABASE, not only in the UI.
--
-- Access model:
--   OWNER      (user_id = auth.uid())                 → full control
--   COUNSELOR  (profiles.counselor_id = counselor)    → read assigned students
--   ADMIN      (profiles.role = 'admin')              → full control
--   ANON       → only through `public_directory` view (public fields only)
--
-- Sensitive tables (profile_private, parents, financial_profile, essays,
-- documents...) have NO public path: even a direct API call with an anon key
-- cannot read them, and CHECK constraints stop `is_public` on sensitive
-- document categories.
--
-- IDEMPOTENT: safe to run multiple times.
-- ============================================================================

-- ============================================================================
-- 1. Helper functions (SECURITY DEFINER → bypass RLS → no recursion)
-- ============================================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
$$;

create or replace function public.is_assigned_counselor(student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = student_id and counselor_id = auth.uid()
  )
$$;

-- ============================================================================
-- 2. Enable RLS on every new table
-- ============================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'universities','profile_private','parents','education_entries','grade_rows',
    'test_attempts','test_section_scores','score_sending','honors','activities',
    'projects','publications','application_choices','application_deadlines',
    'application_requirements','interviews','supervisor_contacts','essays',
    'essay_versions','essay_comments','essay_shares','application_essays',
    'documents','document_versions','document_links','recommenders',
    'recommendation_assignments','financial_profile','aid_forms','scholarships',
    'links','portfolio_items','reminders'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- ============================================================================
-- 3. Uniform policies for every user-scoped table (user_id column)
--    owner → ALL | counselor → SELECT | admin → ALL
-- ============================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'profile_private','parents','education_entries','grade_rows',
    'test_attempts','test_section_scores','score_sending','honors','activities',
    'projects','publications','application_choices','application_deadlines',
    'application_requirements','interviews','supervisor_contacts','essays',
    'essay_versions','essay_comments','essay_shares','application_essays',
    'documents','document_versions','document_links','recommenders',
    'recommendation_assignments','financial_profile','aid_forms','scholarships',
    'links','portfolio_items','reminders'
  ]
  loop
    -- owner: full control over own rows
    execute format('drop policy if exists p_%s_owner on public.%I', t, t);
    execute format(
      'create policy p_%s_owner on public.%I for all to authenticated
       using (user_id = auth.uid())
       with check (user_id = auth.uid())', t, t);

    -- counselor: read rows of assigned students only
    execute format('drop policy if exists p_%s_counselor on public.%I', t, t);
    execute format(
      'create policy p_%s_counselor on public.%I for select to authenticated
       using (public.is_assigned_counselor(user_id))', t, t);

    -- admin: full control (dashboards)
    execute format('drop policy if exists p_%s_admin on public.%I', t, t);
    execute format(
      'create policy p_%s_admin on public.%I for all to authenticated
       using (public.is_admin())
       with check (public.is_admin())', t, t);
  end loop;
end;
$$;

-- essay_shares: a user explicitly shared with can read (and comment) the essay
drop policy if exists p_essay_shares_shared_user on public.essay_shares;
create policy p_essay_shares_shared_user on public.essay_shares
  for select to authenticated
  using (shared_with = auth.uid());

-- Counselor can insert comments on essays of assigned students
drop policy if exists p_essay_comments_counselor_insert on public.essay_comments;
create policy p_essay_comments_counselor_insert on public.essay_comments
  for insert to authenticated
  with check (public.is_assigned_counselor(user_id));

-- ============================================================================
-- 4. universities — public reference data (autocomplete)
-- ============================================================================
drop policy if exists p_universities_read on public.universities;
create policy p_universities_read on public.universities
  for select to anon, authenticated
  using (true);

-- ============================================================================
-- 5. Existing tables — counselor read access (assigned students only)
--    (No-ops if RLS is not enabled on them; safe either way.)
-- ============================================================================
drop policy if exists p_profiles_counselor on public.profiles;
create policy p_profiles_counselor on public.profiles
  for select to authenticated
  using (public.is_assigned_counselor(id));

drop policy if exists p_applications_counselor on public.applications;
create policy p_applications_counselor on public.applications
  for select to authenticated
  using (public.is_assigned_counselor(student_id));

drop policy if exists p_app_documents_counselor on public.application_documents;
create policy p_app_documents_counselor on public.application_documents
  for select to authenticated
  using (public.is_assigned_counselor(user_id));

drop policy if exists p_licenses_counselor on public.licenses;
create policy p_licenses_counselor on public.licenses
  for select to authenticated
  using (public.is_assigned_counselor(user_id));

drop policy if exists p_license_media_counselor on public.license_media;
create policy p_license_media_counselor on public.license_media
  for select to authenticated
  using (public.is_assigned_counselor(user_id));

-- ============================================================================
-- 6. PUBLIC DIRECTORY VIEW — the ONLY door for public/private-by-flag data
-- ----------------------------------------------------------------------------
-- Per-field visibility flags are honoured: email/phone/photo appear ONLY if
-- the student set that field to 'public'. Private columns (passport, DOB,
-- addresses) are NOT part of the view at all — they physically cannot leak.
-- ============================================================================
create or replace view public.public_directory as
select
  p.id,
  p.full_name,
  p.preferred_name,
  case when p.photo_visibility = 'public' then p.photo_url end as photo_url,
  p.major,
  p.university,
  p.committed_university,
  p.applying_level,
  p.start_term,
  p.intended_major_1,
  p.intended_major_2,
  case when p.email_visibility = 'public' then p.email end as email,
  case when p.phone_visibility = 'public' then p.phone end as phone,
  p.profile_visibility,
  p.created_at
from public.profiles p
where p.profile_visibility = 'public'
  and coalesce(p.is_profile_completed, false);

grant select on public.public_directory to anon, authenticated;

comment on view public.public_directory is
  'Public student directory. Only flag-approved fields are exposed; sensitive
   columns are excluded by construction. Base profiles table stays RLS-guarded.';

-- ============================================================================
-- 7. Sanity checks (run-time guarantees for the acceptance criteria)
--    - a sensitive document can never be public (CHECK in 001)
--    - essays have no public visibility at all (no column, no policy)
--    - anon has no direct select on user tables (RLS enabled, no anon policy)
-- ============================================================================
