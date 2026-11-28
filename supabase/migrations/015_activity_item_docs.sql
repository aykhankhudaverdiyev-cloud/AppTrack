-- ============================================================================
-- 015_activity_item_docs.sql
-- ============================================================================
-- 1. Deleting an activity removes its file links (same as the other 4 sections).
-- 2. Fix a hidden bug: these 5 tables have the trg_<table>_updated_at trigger
-- (set_updated_at() does new.updated_at = now()) but NO updated_at column,
-- so every UPDATE on them fails with
-- 'record "new" has no field "updated_at"'.
-- Found 28 Nov 2026 with a catalog query. Additive and safe.
-- Re-runnable.
-- ============================================================================

-- 1. activities -> item_documents cleanup
drop trigger if exists trg_activities_item_docs on public.activities;
create trigger trg_activities_item_docs
after delete on public.activities
for each row execute function public.delete_item_documents('activity');

-- 2. missing updated_at columns
alter table public.document_links add column if not exists updated_at timestamptz not null default now();
alter table public.document_versions add column if not exists updated_at timestamptz not null default now();
alter table public.essay_versions add column if not exists updated_at timestamptz not null default now();
alter table public.essay_shares add column if not exists updated_at timestamptz not null default now();
alter table public.application_essays add column if not exists updated_at timestamptz not null default now();

-- 3. migration history
insert into supabase_migrations.schema_migrations (version, name, statements)
values ('20261128120000', 'activity_item_docs', array['015_activity_item_docs.sql'])
on conflict (version) do nothing;
