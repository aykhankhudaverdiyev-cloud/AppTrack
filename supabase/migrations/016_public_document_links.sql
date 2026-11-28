-- ============================================================================
-- 016_public_document_links.sql
-- ============================================================================
-- Public application files move from application_documents to
-- document_links + document_files. Other students may read a file ONLY when
-- BOTH the link is public AND the application itself is public.
--   1. document_links: public read policy
--   2. document_files: public read policy (only files with such a link)
--   3. storage.objects: the public-read policy no longer trusts the legacy
--      application_documents table, and also requires a public application
--      (so making the application private hides its files at once).
-- Data check on 28 Nov 2026: the only legacy row and the only link are both
-- 'private', so no file that is visible today becomes hidden.
-- Re-runnable. Number 017 is reserved for university_requests.
-- ============================================================================

-- 1. links
drop policy if exists p_document_links_public_read on public.document_links;
create policy p_document_links_public_read on public.document_links
  for select to authenticated
  using (
    visibility = 'public'
    and exists (
      select 1 from public.applications a
      where a.id = document_links.application_id
        and a.visibility = 'public'
    )
  );

-- 2. files
drop policy if exists p_document_files_public_read on public.document_files;
create policy p_document_files_public_read on public.document_files
  for select to authenticated
  using (
    exists (
      select 1
      from public.document_links dl
      join public.applications a on a.id = dl.application_id
      where dl.document_id = document_files.id
        and dl.visibility = 'public'
        and a.visibility = 'public'
    )
  );

-- 3. storage objects
drop policy if exists "Public documents readable by authenticated users" on storage.objects;
create policy "Public documents readable by authenticated users" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'student-documents'
    and exists (
      select 1
      from public.document_links dl
      join public.document_files df on df.id = dl.document_id
      join public.applications a on a.id = dl.application_id
      where df.file_path = objects.name
        and dl.visibility = 'public'
        and a.visibility = 'public'
    )
  );

-- 4. migration history
insert into supabase_migrations.schema_migrations (version, name, statements)
values ('20261128130000', 'public_document_links', array['016_public_document_links.sql'])
on conflict (version) do nothing;
