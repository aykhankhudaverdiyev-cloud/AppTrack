/**
 * ============================================================================
 * projectsApi.js — the only place that talks to public.projects
 * ============================================================================
 * Every call is owner-scoped twice: RLS (`user_id = auth.uid()`) plus an
 * explicit `.eq('user_id', userId)` filter. Only whitelisted columns are
 * written, so a caller can never change ownership, ids or timestamps.
 * ============================================================================
 */
import { supabase } from '../lib/supabase'
import { rowFromDraft } from '../utils/projects'

/** Columns the Projects page reads (legacy ones stay untouched). */
export const PROJECT_COLUMNS = [
  'id', 'user_id', 'project_type', 'title', 'role_type', 'team_size',
  'my_contribution', 'start_date', 'end_date', 'status', 'problem',
  'build_summary', 'result', 'result_metrics', 'tech_tags', 'github_url',
  'demo_url', 'video_url', 'paper_url', 'report_document_id', 'mentor_name',
  'related_activity_id', 'related_honor_id', 'visibility', 'short_description',
  'link', 'created_at', 'updated_at',
].join(', ')

/** Exactly the keys rowFromDraft produces — the write whitelist. */
export const WRITABLE_PROJECT_COLUMNS = [
  'project_type', 'title', 'role_type', 'start_date', 'status',
  'short_description', 'problem', 'build_summary', 'result', 'tech_tags',
  'github_url', 'demo_url', 'related_activity_id', 'visibility',
]

function pickWritable(row) {
  return Object.fromEntries(
    WRITABLE_PROJECT_COLUMNS.filter((key) => Object.hasOwn(row, key)).map((key) => [key, row[key]]),
  )
}

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

function sortItems(items) {
  return [...items].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
}

/** All projects for one student, in creation order. */
export async function listProjects(userId) {
  const data = unwrap(await supabase
    .from('projects')
    .select(PROJECT_COLUMNS)
    .eq('user_id', userId))
  return sortItems(data || [])
}

export async function createProject(userId, draft) {
  const row = { ...pickWritable(rowFromDraft(draft)), user_id: userId }
  return unwrap(await supabase.from('projects').insert(row).select(PROJECT_COLUMNS).single())
}

/** Full-draft update from the autosaving panel. */
export async function updateProject(userId, id, draft) {
  return unwrap(await supabase
    .from('projects')
    .update({ ...pickWritable(rowFromDraft(draft)), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select(PROJECT_COLUMNS)
    .single())
}

export async function deleteProject(userId, id) {
  unwrap(await supabase.from('projects').delete().eq('id', id).eq('user_id', userId).select('id'))
}

/** Copy every page column, append "(copy)" to the title. */
export async function duplicateProject(userId, source) {
  const copy = pickWritable(source)
  copy.title = `${String(copy.title || 'Project')} (copy)`.slice(0, 120)
  return unwrap(await supabase
    .from('projects')
    .insert({ ...copy, user_id: userId })
    .select(PROJECT_COLUMNS)
    .single())
}

/** Re-insert a project that was just deleted (Undo), keeping its id. */
export async function restoreProject(userId, row) {
  return unwrap(await supabase
    .from('projects')
    .insert({ ...pickWritable(row), id: row.id, user_id: userId, created_at: row.created_at })
    .select(PROJECT_COLUMNS)
    .single())
}
