/**
 * ============================================================================
 * activitiesApi.js — the only place that talks to public.activities
 * ============================================================================
 * Every call is owner-scoped twice: RLS (`user_id = auth.uid()`) plus an
 * explicit `.eq('user_id', userId)` filter. Only whitelisted columns are
 * written, so a caller can never change ownership, ids or timestamps.
 * ============================================================================
 */
import { supabase } from '../lib/supabase'
import { rowFromDraft } from '../utils/activities'

/** Columns the UI reads (the table also has legacy ones we never touch). */
export const ACTIVITY_COLUMNS = [
  'id', 'user_id', 'activity_type', 'position', 'organization_name',
  'description', 'long_description', 'organization_description', 'grade_levels',
  'timing', 'hours_per_week', 'weeks_per_year', 'start_date', 'end_date', 'ongoing',
  'city', 'country', 'participation_mode', 'impact_metrics', 'supervisor_name',
  'supervisor_email', 'is_paid', 'employment_type', 'industry', 'earnings_for_family',
  'research_mentor', 'research_institution', 'research_question', 'output_status',
  'plan_to_continue', 'sort_order', 'created_at', 'updated_at',
].join(', ')

/** Exactly the keys rowFromDraft produces — the write whitelist. */
export const WRITABLE_ACTIVITY_COLUMNS = [
  'activity_type', 'organization_name', 'position', 'grade_levels', 'timing',
  'hours_per_week', 'weeks_per_year', 'start_date', 'end_date', 'ongoing',
  'city', 'country', 'participation_mode', 'organization_description',
  'long_description', 'is_paid', 'employment_type', 'supervisor_name',
  'supervisor_email', 'research_mentor', 'research_institution',
  'research_question', 'output_status',
]

function pickWritable(row) {
  return Object.fromEntries(
    WRITABLE_ACTIVITY_COLUMNS.filter((key) => Object.hasOwn(row, key)).map((key) => [key, row[key]]),
  )
}

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

function sortItems(items) {
  return [...items].sort((a, b) => {
    const order = Number(a.sort_order || 0) - Number(b.sort_order || 0)
    if (order !== 0) return order
    return String(a.created_at || '').localeCompare(String(b.created_at || ''))
  })
}

/** All activities for one student, ranked by sort_order. */
export async function listActivities(userId) {
  const data = unwrap(await supabase
    .from('activities')
    .select(ACTIVITY_COLUMNS)
    .eq('user_id', userId))
  return sortItems(data || [])
}

/** Insert a new activity at the end of the list. */
export async function createActivity(userId, draft, sortOrder = 0) {
  const row = { ...pickWritable(rowFromDraft(draft)), user_id: userId, sort_order: sortOrder }
  return unwrap(await supabase.from('activities').insert(row).select(ACTIVITY_COLUMNS).single())
}

/** Partial update from a full draft (used by the autosaving panel). */
export async function updateActivity(userId, id, draft) {
  return unwrap(await supabase
    .from('activities')
    .update({ ...pickWritable(rowFromDraft(draft)), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select(ACTIVITY_COLUMNS)
    .single())
}

/** Patch a single column (Move to top, Ondrag renumbering fallback). */
export async function patchActivity(userId, id, patch) {
  return unwrap(await supabase
    .from('activities')
    .update({ ...pickWritable(patch), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select(ACTIVITY_COLUMNS)
    .single())
}

export async function deleteActivity(userId, id) {
  unwrap(await supabase.from('activities').delete().eq('id', id).eq('user_id', userId).select('id'))
}

/** Copy every content column, append " (copy)" to the organization name. */
export async function duplicateActivity(userId, source, sortOrder) {
  const copy = pickWritable(source)
  copy.organization_name = `${String(copy.organization_name || 'Activity')} (copy)`.slice(0, 100)
  return unwrap(await supabase
    .from('activities')
    .insert({ ...copy, user_id: userId, sort_order: sortOrder })
    .select(ACTIVITY_COLUMNS)
    .single())
}

/** Re-insert an activity that was just deleted (Undo), keeping its id and rank. */
export async function restoreActivity(userId, row) {
  const restored = pickWritable(row)
  return unwrap(await supabase
    .from('activities')
    .insert({ ...restored, id: row.id, user_id: userId, sort_order: row.sort_order ?? 0 })
    .select(ACTIVITY_COLUMNS)
    .single())
}

/** One atomic statement in Postgres — RLS still applies (security invoker). */
export async function reorderActivities(ids) {
  unwrap(await supabase.rpc('reorder_activities', { p_ids: ids }))
}
