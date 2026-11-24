-- ============================================================================
-- AppTrack — backfill public.item_documents from the four legacy columns
-- ----------------------------------------------------------------------------
-- Migration 012 created the table and ran this once. Re-run this script any
-- time (e.g. right before merging) — every insert is `on conflict do nothing`,
-- so it never duplicates a link and never overwrites a newer one.
--
--   psql "$DATABASE_URL" -f supabase/scripts/backfill_item_documents.sql
-- ============================================================================

insert into public.item_documents (user_id, section, item_id, document_id)
select e.user_id, 'education', e.id, e.transcript_document_id
  from public.education_entries e
 where e.transcript_document_id is not null
on conflict (section, item_id, document_id) do nothing;

insert into public.item_documents (user_id, section, item_id, document_id)
select t.user_id, 'test', t.id, t.report_document_id
  from public.test_attempts t
 where t.report_document_id is not null
on conflict (section, item_id, document_id) do nothing;

insert into public.item_documents (user_id, section, item_id, document_id)
select h.user_id, 'honor', h.id, h.certificate_document_id
  from public.honors h
 where h.certificate_document_id is not null
on conflict (section, item_id, document_id) do nothing;

insert into public.item_documents (user_id, section, item_id, document_id)
select p.user_id, 'project', p.id, p.report_document_id
  from public.projects p
 where p.report_document_id is not null
on conflict (section, item_id, document_id) do nothing;
