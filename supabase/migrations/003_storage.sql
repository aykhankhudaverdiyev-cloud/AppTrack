-- ============================================================================
-- AppTrack — Phase 0, Migration 003: Storage policies (v2 — backend-aware)
-- ----------------------------------------------------------------------------
-- AUDITED AGAINST THE LIVE DATABASE:
--   student-documents → PRIVATE (correct today, kept private) — PDFs, IDs,
--     transcripts... accessed via signed URLs (1 h expiry).
--   avatars → PUBLIC today and the app renders avatars with getPublicUrl().
--     WE DO NOT TOUCH IT. Forcing it private (previous version) would have
--     broken profile photos.
--
-- Path convention used by the app (src/lib/storage.js):
--     {user_id}/{applicationId}/{category}/{uuid}.{ext}
-- so the first path folder is always the owner's id — policies rely on it.
--
-- IDEMPOTENT: safe to run multiple times.
-- ============================================================================

-- ============================================================================
-- 1. Keep student-documents explicitly PRIVATE
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('student-documents', 'student-documents', false)
on conflict (id) do update
  set public = false;   -- never allow an accidental public flip

-- ============================================================================
-- 2. Policies on storage.objects for student-documents only
-- ============================================================================
-- Owner: full control over own folder tree ({user_id}/...)
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

-- Counselor: read-only on assigned students' files.
-- The folder-name guard keeps non-UUID top folders from matching at all.
drop policy if exists p_storage_student_docs_counselor on storage.objects;
create policy p_storage_student_docs_counselor on storage.objects
  for select to authenticated
  using (
    bucket_id = 'student-documents'
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_assigned_counselor(((storage.foldername(name))[1])::uuid)
  );

-- ============================================================================
-- 3. avatars — intentionally untouched (public bucket, used by getPublicUrl)
-- ============================================================================
