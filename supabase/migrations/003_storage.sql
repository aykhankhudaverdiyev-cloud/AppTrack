-- ============================================================================
-- AppTrack — Phase 0, Migration 003: Storage (private buckets + policies)
-- ----------------------------------------------------------------------------
-- PRINCIPLE #6: files live in PRIVATE buckets, accessed via signed URLs.
-- Path convention used by the app (src/lib/storage.js):
--     {user_id}/{application_id}/{category}/{uuid}.{ext}
-- so the first path folder is always the owner's id — policies rely on it.
--
-- IDEMPOTENT: safe to run multiple times.
-- ============================================================================

-- ============================================================================
-- 1. Buckets (create if missing; force PRIVATE)
-- ============================================================================
insert into storage.buckets (id, name, public)
values
  ('student-documents', 'student-documents', false),
  ('avatars', 'avatars', false)
on conflict (id) do update
  set public = false;   -- never allow accidental public flip

-- ============================================================================
-- 2. Policies on storage.objects
--    Owner = first path folder. Counselor = read-only on assigned students.
-- ============================================================================
drop policy if exists p_storage_student_docs_owner on storage.objects;
create policy p_storage_student_docs_owner on storage.objects
  for all to authenticated
  using (
    bucket_id = 'student-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'student-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists p_storage_student_docs_counselor on storage.objects;
create policy p_storage_student_docs_counselor on storage.objects
  for select to authenticated
  using (
    bucket_id = 'student-documents'
    and public.is_assigned_counselor((storage.foldername(name))[1]::uuid)
  );

drop policy if exists p_storage_avatars_owner on storage.objects;
create policy p_storage_avatars_owner on storage.objects
  for all to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- NOTE: signed URLs (createSignedUrl) are generated server-side by the
-- storage API after an RLS-checked SELECT; they expire (app uses 1 hour).
-- There is NO public read policy on these buckets — even a leaked object URL
-- from a public listing cannot exist.
