-- ============================================================================
-- AppTrack — Migration 012: one link table for every "Proof" file
-- ----------------------------------------------------------------------------
-- Before this migration each section kept its own single-document column:
--   education_entries.transcript_document_id
--   test_attempts.report_document_id
--   honors.certificate_document_id
--   projects.report_document_id
-- A student usually has more than one file per item (transcript + translation),
-- and the Documents page had no way to see where a file is used.
--
-- public.item_documents replaces them with one row per (section, item, file):
--   1. The table + its constraints (one file per item, section whitelist).
--   2. RLS: exactly the three document_files policies (owner, admin,
--      counselor-read), so a link is as private as the file itself.
--   3. Indexes for the two real queries: "files of this item" and "items using
--      this file" (the delete dialog / Documents page).
--   4. A generic AFTER DELETE trigger on the four item tables: deleting an
--      education entry / test / honor / project removes its links.
--   5. A backfill of the four old columns. Idempotent (`on conflict do
--      nothing`), so it is safe to run again at any time.
--
-- The four old columns are left in place, unused by the app, as a safety net.
-- Idempotent: safe to re-run.
-- ============================================================================

-- 1. The table -----------------------------------------------------------------

create table if not exists public.item_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  section text not null check (section in ('education', 'test', 'honor', 'project')),
  item_id uuid not null,
  document_id uuid not null references public.document_files(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint item_documents_unique unique (section, item_id, document_id)
);

comment on table public.item_documents is
  'Files attached to an Education / Test / Honor / Project item ("Proof").';

-- 2. RLS: the same three policies document_files has ---------------------------

alter table public.item_documents enable row level security;

drop policy if exists p_item_documents_admin on public.item_documents;
create policy p_item_documents_admin on public.item_documents
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists p_item_documents_counselor on public.item_documents;
create policy p_item_documents_counselor on public.item_documents
  for select to authenticated using (public.is_assigned_counselor(user_id));

drop policy if exists p_item_documents_owner on public.item_documents;
create policy p_item_documents_owner on public.item_documents
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3. Indexes -------------------------------------------------------------------

create index if not exists idx_item_documents_item on public.item_documents (section, item_id);
create index if not exists idx_item_documents_document on public.item_documents (document_id);
create index if not exists idx_item_documents_user on public.item_documents (user_id);

-- 4. Deleting an item removes its links ----------------------------------------

create or replace function public.delete_item_documents()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  delete from public.item_documents where section = tg_argv[0] and item_id = old.id;
  return old;
end; $$;

drop trigger if exists trg_education_entries_item_docs on public.education_entries;
create trigger trg_education_entries_item_docs after delete on public.education_entries
  for each row execute function public.delete_item_documents('education');

drop trigger if exists trg_test_attempts_item_docs on public.test_attempts;
create trigger trg_test_attempts_item_docs after delete on public.test_attempts
  for each row execute function public.delete_item_documents('test');

drop trigger if exists trg_honors_item_docs on public.honors;
create trigger trg_honors_item_docs after delete on public.honors
  for each row execute function public.delete_item_documents('honor');

drop trigger if exists trg_projects_item_docs on public.projects;
create trigger trg_projects_item_docs after delete on public.projects
  for each row execute function public.delete_item_documents('project');

-- 5. Backfill the four old columns (idempotent: run as often as you like) ------
-- This block is also mirrored in supabase/scripts/backfill_item_documents.sql
-- so it can be re-run right before a merge without touching the app.

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
