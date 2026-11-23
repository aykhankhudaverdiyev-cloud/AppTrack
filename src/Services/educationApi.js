/** ============================================================================
 * educationApi.js — the only place the Education page talks to
 * public.education_entries / public.grade_rows
 * ============================================================================
 * Owner-scoped twice: RLS (`user_id = auth.uid()`) plus an explicit
 * `.eq('user_id', userId)` filter. Only whitelisted columns are written.
 * Grade rows are synced through the existing, already-tested
 * `syncGradeRows()` in ProfileServiceV2 (upsert the sent rows, delete the rest)
 * so a cleared cell really deletes its row.
 * ============================================================================ */

import { supabase } from '../lib/supabase'
import { notifyDataChanged } from '../store/studentsStore'
import { syncGradeRows } from './ProfileServiceV2'
import { gradeRowsFromSubjects } from '../utils/education.js'

export const ENTRY_COLUMNS = [
  'id', 'user_id', 'entry_type', 'institution_name', 'country', 'city', 'ceeb_code',
  'language_of_instruction', 'start_date', 'end_date', 'is_current', 'qualification',
  'grading_scale', 'overall_average', 'scale_maximum', 'class_rank', 'class_size',
  'school_does_not_rank', 'school_counselor_name', 'school_counselor_email',
  'school_counselor_phone', 'transcript_document_id', 'degree', 'major', 'gpa',
  'gpa_scale', 'sort_order', 'created_at', 'updated_at',
].join(', ')

export const GRADE_COLUMNS = [
  'id', 'entry_id', 'subject', 'grade_level', 'semester', 'grade', 'is_predicted', 'sort_order',
].join(', ')

/** Every column the panel may write. Anything else is dropped before the request. */
export const WRITABLE_ENTRY_COLUMNS = [
  'entry_type', 'institution_name', 'country', 'city', 'ceeb_code',
  'language_of_instruction', 'start_date', 'end_date', 'is_current', 'qualification',
  'grading_scale', 'overall_average', 'scale_maximum', 'class_rank', 'class_size',
  'school_does_not_rank', 'school_counselor_name', 'school_counselor_email',
  'school_counselor_phone', 'transcript_document_id', 'degree', 'major', 'gpa',
  'gpa_scale', 'sort_order',
]

export function pickEntryFields(row = {}) {
  return Object.fromEntries(
    WRITABLE_ENTRY_COLUMNS.filter((key) => Object.hasOwn(row, key)).map((key) => [key, row[key]]),
  )
}

function unwrap({ data, error }) {
  if (error) throw error
  return data
}

const bySortOrder = (a, b) => (Number(a.sort_order || 0) - Number(b.sort_order || 0))
  || String(a.created_at || '').localeCompare(String(b.created_at || ''))

/** Entries in display order, each with its `grades` rows attached. */
export async function listEducation(userId) {
  if (!userId) return []
  const [entries, grades] = await Promise.all([
    supabase.from('education_entries').select(ENTRY_COLUMNS).eq('user_id', userId),
    supabase.from('grade_rows').select(GRADE_COLUMNS).eq('user_id', userId),
  ])
  const rows = unwrap(entries) || []
  const graded = unwrap(grades) || []
  return rows
    .map((entry) => ({
      ...entry,
      grades: graded.filter((row) => row.entry_id === entry.id).sort(bySortOrder),
    }))
    .sort(bySortOrder)
}

export async function createEntry(userId, fields) {
  const row = { ...pickEntryFields(fields), user_id: userId }
  const created = unwrap(await supabase
    .from('education_entries')
    .insert(row)
    .select(ENTRY_COLUMNS)
    .single())
  notifyDataChanged()
  return created
}

export async function updateEntry(userId, id, fields) {
  const saved = unwrap(await supabase
    .from('education_entries')
    .update({ ...pickEntryFields(fields), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select(ENTRY_COLUMNS)
    .single())
  notifyDataChanged()
  return saved
}

export async function deleteEntry(userId, id) {
  unwrap(await supabase
    .from('education_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id'))
  notifyDataChanged()
}

/** Copy an entry and everything in its grade table. */
export async function duplicateEntry(userId, entry, sortOrder = 0) {
  const fields = pickEntryFields(entry)
  fields.institution_name = `${String(fields.institution_name || 'Education').slice(0, 150)} (copy)`
  fields.sort_order = sortOrder
  const copy = unwrap(await supabase
    .from('education_entries')
    .insert({ ...fields, user_id: userId })
    .select(ENTRY_COLUMNS)
    .single())
  const grades = (entry.grades || []).map((row) => ({
    subject: row.subject,
    grade_level: row.grade_level,
    semester: row.semester,
    grade: row.grade,
    is_predicted: row.is_predicted,
    sort_order: row.sort_order,
  }))
  if (grades.length) {
    unwrap(await supabase
      .from('grade_rows')
      .insert(grades.map((row) => ({ ...row, user_id: userId, entry_id: copy.id })))
      .select(GRADE_COLUMNS))
  }
  notifyDataChanged()
  return { ...copy, grades: [] }
}

/**
 * Replace the entry's grade rows with the rows implied by the table.
 * An emptied cell is deleted, not stored as ''.
 */
export async function saveGrades(userId, entryId, subjects) {
  const rows = gradeRowsFromSubjects(subjects)
  await syncGradeRows(userId, entryId, rows) // notifies on its own
  return rows
}
