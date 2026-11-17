/** ============================================================================
 * testsApi.js — the only place that talks to public.test_attempts and
 * public.test_section_scores
 * ============================================================================
 * Owner-scoped twice: RLS plus an explicit `.eq('user_id', userId)` filter.
 * Sections are saved atomically with rpc('save_test_sections', …); best-attempt
 * toggling with rpc('set_best_test_attempt', …).
 * ============================================================================ */

import { supabase } from '../lib/supabase'
import { rowFromDraft } from '../utils/tests.js'

export const TEST_COLUMNS = [
  'id', 'user_id', 'test_type', 'national_exam_name', 'status', 'attempt_number',
  'test_date', 'overall_score', 'overall_max', 'trf_number', 'expires_on',
  'is_best', 'notes', 'report_document_id', 'created_at', 'updated_at',
].join(', ')

export const WRITABLE_TEST_COLUMNS = [
  'test_type', 'national_exam_name', 'status', 'attempt_number', 'test_date',
  'overall_score', 'overall_max', 'trf_number', 'expires_on', 'is_best',
  'notes', 'report_document_id',
]

function pickWritable(row) {
  return Object.fromEntries(
    WRITABLE_TEST_COLUMNS.filter((key) => Object.hasOwn(row, key)).map((key) => [key, row[key]]),
  )
}

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

function sortItems(items) {
  return [...items].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
}

export async function listTests(userId) {
  const data = unwrap(await supabase
    .from('test_attempts')
    .select(TEST_COLUMNS)
    .eq('user_id', userId))
  return sortItems(data || [])
}

export async function createTest(userId, draft) {
  const row = { ...pickWritable(rowFromDraft(draft)), user_id: userId }
  return unwrap(await supabase.from('test_attempts').insert(row).select(TEST_COLUMNS).single())
}

export async function updateTest(userId, id, draft) {
  return unwrap(await supabase
    .from('test_attempts')
    .update({ ...pickWritable(rowFromDraft(draft)), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select(TEST_COLUMNS)
    .single())
}

export async function deleteTest(userId, id) {
  unwrap(await supabase.from('test_attempts').delete().eq('id', id).eq('user_id', userId).select('id'))
}

export async function restoreTest(userId, row) {
  return unwrap(await supabase
    .from('test_attempts')
    .insert({ ...pickWritable(row), id: row.id, user_id: userId })
    .select(TEST_COLUMNS)
    .single())
}

export async function duplicateTest(userId, source) {
  const copy = pickWritable(source)
  copy.national_exam_name = `${String(copy.national_exam_name || copy.test_type || 'Test')} (copy)`.slice(0, 100)
  return unwrap(await supabase
    .from('test_attempts')
    .insert({ ...copy, user_id: userId })
    .select(TEST_COLUMNS)
    .single())
}

/** Switch the "best" flag for one attempt of a type atomically (one DB call). */
export async function setBestTest(id, on) {
  unwrap(await supabase.rpc('set_best_test_attempt', { p_id: id, p_on: on }))
}

/** Save every section of one attempt atomically (insert / update / delete). */
export async function saveSections(attemptId, sections) {
  unwrap(await supabase.rpc('save_test_sections', { p_attempt_id: attemptId, p_sections: sections }))
}
