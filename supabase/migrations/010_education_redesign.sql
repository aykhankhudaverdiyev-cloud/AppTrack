-- ============================================================================
-- AppTrack — Migration 010: Education redesign (`education_redesign`)
-- ----------------------------------------------------------------------------
-- The Education page (rebuild of the academic library tab) links one transcript
-- document to each education entry, so the "PROOF" section can show
-- "No transcript linked yet" or the chosen document, exactly like Test Scores
-- links a score report. `public.document_files` already exists (migration 001)
-- and already carries the `transcript` category.
--
--   1. education_entries.transcript_document_id → document_files(id), ON DELETE
--      SET NULL (same shape as test_attempts.report_document_id).
--   2. assert_document_owner() trigger (created in migration 009) so a user can
--      never link somebody else's document.
--   3. Index for the document → entries lookup.
--
-- Idempotent: safe to re-run. No rows are touched, RLS is unchanged.
-- ============================================================================

-- 1. Link column ---------------------------------------------------------------

alter table public.education_entries
  add column if not exists transcript_document_id uuid
    references public.document_files(id) on delete set null;

create index if not exists idx_education_transcript_doc
  on public.education_entries (transcript_document_id);

-- 2. A linked document must belong to the same user ----------------------------

drop trigger if exists trg_education_entries_doc_owner on public.education_entries;
create trigger trg_education_entries_doc_owner
  before insert or update of transcript_document_id on public.education_entries
  for each row execute function public.assert_document_owner('transcript_document_id');
