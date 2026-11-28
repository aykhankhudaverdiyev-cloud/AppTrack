-- ============================================================================
-- 014_application_documents.sql (RECONSTRUCTED BASELINE)
-- ============================================================================
-- The original file was never committed. supabase_migrations.schema_migrations
-- version 20261125120000 ("application_documents") stores only the file name.
-- This file was rebuilt on 28 Nov 2026 from the LIVE schema (read-only catalog
-- queries), so the repo matches the database. It is idempotent: running it on
-- the live DB changes nothing. Do NOT add a new schema_migrations row for it.
-- What the original migration did (as seen in the live DB):
-- 1. document_links: + label, + visibility
-- 2. item_documents: section check now allows 'activity'
-- 3. document_usage(): + activities, + application links (document_links)
-- 4. delete_document(): also removes document_links; admins allowed
-- 5. one-off data copy application_documents -> document_links (1 row).
-- Already done; intentionally NOT repeated here.
-- ============================================================================

-- 1. document_links columns
alter table public.document_links add column if not exists label text;
alter table public.document_links add column if not exists visibility text not null default 'private';

-- 2. item_documents section whitelist
alter table public.item_documents drop constraint if exists item_documents_section_check;
alter table public.item_documents add constraint item_documents_section_check
check (section = any (array['education','test','honor','project','activity']));

-- 3. where a file is used
create or replace function public.document_usage(p_document_id uuid)
returns table(section text, item_id uuid, title text)
language sql
stable
set search_path to 'public'
as $function$
select l.section, l.item_id, coalesce(t.title, l.section)::text as title
from public.item_documents l
left join lateral (
select case l.section
when 'education' then e.institution_name
when 'test' then cat.test_type
when 'honor' then h.title
when 'project' then p.title
when 'activity' then coalesce(nullif(a.position,''), nullif(a.organization_name,''), a.activity_type::text, 'Activity')
end as title
from (select 1) one
left join public.education_entries e on l.section = 'education' and e.id = l.item_id
left join public.test_attempts cat on l.section = 'test' and cat.id = l.item_id
left join public.honors h on l.section = 'honor' and h.id = l.item_id
left join public.projects p on l.section = 'project' and p.id = l.item_id
left join public.activities a on l.section = 'activity' and a.id = l.item_id
) t on true
where l.document_id = p_document_id

union all

select
'application'::text as section,
dl.application_id as item_id,
coalesce(nullif(dl.label, ''), app.university, 'Application')::text as title
from public.document_links dl
left join public.applications app on app.id = dl.application_id
where dl.document_id = p_document_id

order by section, title;
$function$;

grant execute on function public.document_usage(uuid) to authenticated;

-- 4. delete a file everywhere
create or replace function public.delete_document(p_document_id uuid)
returns setof text
language plpgsql
set search_path to 'public'
as $function$
declare
v_path text;
v_owner uuid;
begin
if auth.uid() is null then
raise exception 'NOT_AUTHENTICATED';
end if;

select d.file_path, d.user_id into v_path, v_owner
from public.document_files d
where d.id = p_document_id;

if v_path is null then
raise exception 'DOCUMENT_NOT_FOUND';
end if;

if v_owner <> auth.uid() and not public.is_admin() then
raise exception 'DOCUMENT_NOT_FOUND';
end if;

delete from public.item_documents
where document_id = p_document_id;

delete from public.document_links
where document_id = p_document_id;

delete from public.document_files
where id = p_document_id;

return next v_path;
end; $function$;

grant execute on function public.delete_document(uuid) to authenticated;
