/** ============================================================================
 * honorsApi.js — the only place that talks to public.honors
 * ============================================================================
 * Owner-scoped twice: RLS (`user_id = auth.uid()`) plus an explicit
 * `.eq('user_id', userId)` filter. Only whitelisted columns are written.
 * ============================================================================ */

import { supabase } from '../lib/supabase'
import { HONOR_LIMITS } from '../constants/honors.js'
import { rowFromDraft } from '../utils/honors.js'

export const HONOR_COLUMNS = [
  'id', 'user_id', 'title', 'category', 'subject', 'received_month', 'received_year',
  'result', 'grade_levels', 'levels', 'issuer', 'participants_context', 'description', 'certificate_document_id',
  'verification_url', 'is_top5_commonapp', 'top5_order', 'sort_order', 'created_at', 'updated_at',
].join(', ')

export const WRITABLE_HONOR_COLUMNS = [
  'title', 'category', 'subject', 'received_month', 'received_year', 'result', 'grade_levels', 'levels',
  'issuer', 'participants_context', 'description', 'certificate_document_id',
  'verification_url', 'is_top5_commonapp',
]

function pickWritable(row) {
  return Object.fromEntries(
    WRITABLE_HONOR_COLUMNS.filter((key) => Object.hasOwn(row, key)).map((key) => [key, row[key]]),
  )
}

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

function sortItems(items) {
  return [...items].sort((a, b) => {
    const order = Number(a.sort_order || 0) - Number(b.sort_order || 0)
    return order !== 0 ? order : String(a.created_at || '').localeCompare(String(b.created_at || ''))
  })
}

export async function listHonors(userId) {
  const data = unwrap(await supabase
    .from('honors')
    .select(HONOR_COLUMNS)
    .eq('user_id', userId))
  return sortItems(data || [])
}

export async function createHonor(userId, draft, sortOrder = 0) {
  const row = { ...pickWritable(rowFromDraft(draft)), user_id: userId, sort_order: sortOrder }
  return unwrap(await supabase.from('honors').insert(row).select(HONOR_COLUMNS).single())
}

export async function updateHonor(userId, id, draft) {
  return unwrap(await supabase
    .from('honors')
    .update({ ...pickWritable(rowFromDraft(draft)), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select(HONOR_COLUMNS)
    .single())
}

export async function deleteHonor(userId, id) {
  unwrap(await supabase.from('honors').delete().eq('id', id).eq('user_id', userId).select('id'))
}

export async function restoreHonor(userId, row) {
  const restored = pickWritable(row)
  return unwrap(await supabase
    .from('honors')
    .insert({ ...restored, id: row.id, user_id: userId, sort_order: row.sort_order ?? 0 })
    .select(HONOR_COLUMNS)
    .single())
}

export async function duplicateHonor(userId, source, sortOrder) {
  const copy = { ...pickWritable(source), is_top5_commonapp: false }
  copy.title = `${String(copy.title || 'Honor').slice(0, HONOR_LIMITS.title - ' (copy)'.length)} (copy)`
  return unwrap(await supabase
    .from('honors')
    .insert({ ...copy, user_id: userId, sort_order: sortOrder })
    .select(HONOR_COLUMNS)
    .single())
}

export async function reorderHonors(ids) {
  unwrap(await supabase.rpc('reorder_honors', { p_ids: ids }))
}
