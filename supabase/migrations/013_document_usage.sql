-- ============================================================================
-- AppTrack — Migration 013: "where is this file used?" + one-call delete
-- ----------------------------------------------------------------------------
-- Deleting a file must work from any screen (Proof block, Documents page) and
-- must never leave a dangling link behind. Two SECURITY INVOKER functions:
--
--   document_usage(p_document_id)  → [{ section, item_id, title }] for the
--      owner. Titles come from the item tables, so the dialog can name them.
--   delete_document(p_document_id) → [storage_path]. Deletes the links first,
--      then the document_files row (RLS keeps it to the owner) and hands the
--      path back so the client can drop the storage object with the anon key.
--
-- Idempotent: safe to re-run.
-- ============================================================================

create or replace function public.document_usage(p_document_id uuid)
returns table (section text, item_id uuid, title text)
language sql
security invoker
set search_path = public
stable
as $$
  select l.section, l.item_id, coalesce(t.title, l.section)::text as title
  from public.item_documents l
  left join lateral (
    select case l.section
      when 'education' then e.institution_name
      when 'test' then cat.test_type
      when 'honor' then h.title
      when 'project' then p.title
    end as title
    from (select 1) one
    left join public.education_entries e on l.section = 'education' and e.id = l.item_id
    left join public.test_attempts cat on l.section = 'test' and cat.id = l.item_id
    left join public.honors h on l.section = 'honor' and h.id = l.item_id
    left join public.projects p on l.section = 'project' and p.id = l.item_id
  ) t on true
  where l.document_id = p_document_id
  order by l.section, t.title;
$$;

grant execute on function public.document_usage(uuid) to authenticated;

create or replace function public.delete_document(p_document_id uuid)
returns setof text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_path text;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select d.file_path into v_path
    from public.document_files d
   where d.id = p_document_id and d.user_id = auth.uid();

  if v_path is null then
    raise exception 'DOCUMENT_NOT_FOUND';
  end if;

  delete from public.item_documents
   where document_id = p_document_id and user_id = auth.uid();

  delete from public.document_files
   where id = p_document_id and user_id = auth.uid();

  return next v_path;
end; $$;

grant execute on function public.delete_document(uuid) to authenticated;

comment on function public.document_usage(uuid) is
  'Where a document is attached (drives the "Delete this file?" dialog).';
comment on function public.delete_document(uuid) is
  'Delete a file everywhere; returns its storage path for the client to remove.';
