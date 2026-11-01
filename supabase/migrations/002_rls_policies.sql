-- ============================================================================
-- AppTrack — Phase 0, Migration 002: Row Level Security policies (v2)
-- ----------------------------------------------------------------------------
-- PRINCIPLE #6: privacy is enforced in the DATABASE, not only in the UI.
--
-- SCOPE (backend-aware): policies are created ONLY on the 33 NEW tables from
-- migration 001. The legacy tables that the app uses today (profiles,
-- applications, application_documents, licenses, license_media,
-- visibility_requests) and stale leftovers (students, education,
-- recommendations, documents, profile2s, user_roles, admin_notes,
-- change_requests, notifications, notification_settings) are NOT touched —
-- their existing RLS setup and the admin-approved visibility flow keep working.
--
-- Access model for NEW tables:
--   OWNER      (user_id = auth.uid())                → full control
--   COUNSELOR  (profiles.counselor_id = counselor)   → read assigned students
--   ADMIN      (profiles.role = 'admin')             → full control
--
-- A public directory view over profiles is intentionally DEFERRED to a later
-- phase (together with the legacy-table RLS migration), so today's public
-- explore flow keeps working unchanged.
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
-- 2. Enable RLS on the new tables
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
    'document_files','document_versions','document_links','recommenders',
    'recommendation_assignments','financial_profile','aid_forms','scholarships',
    'links','portfolio_items','reminders'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- ============================================================================
-- 3. Uniform policies for the 32 user-scoped tables (user_id column)
--    owner → ALL | counselor → SELECT | admin → ALL
--    (universities is reference data → handled separately below)
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
    'document_files','document_versions','document_links','recommenders',
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
-- 5. Deferred to the legacy-table RLS phase (NOT done here on purpose):
--    - counselor/admin policies on profiles, applications, application_documents,
--      licenses, license_media, visibility_requests
--    - public_directory view (will become the only public door when legacy
--      profiles reads are tightened)
-- ============================================================================
