/** ============================================================================
 * honors.js — pure helpers for Honors & Awards (spec §3)
 * ============================================================================
 * No React, no Supabase: unit-tested with `node --test`.
 *
 * Draft shape (UI) → DB row (public.honors):
 *   received 'YYYY-MM' → received_month / received_year
 *   levels / grade_levels stay arrays
 * ============================================================================ */

import { formatDate, dateToMonth, monthToDate } from './dates.js'
import {
  HONOR_LIMITS, HONOR_GRADE_LEVELS,
  honorCategory, honorResult, honorLevelLabel, highestLevel,
} from '../constants/honors.js'

const trim = (value) => (value == null ? '' : String(value)).trim()

const REQUIRED_CREATE = [
  { key: 'title', label: 'Honor title' },
  { key: 'category', label: 'Category' },
  { key: 'grade_levels', label: 'Grade levels' },
  { key: 'levels', label: 'Level of recognition' },
]

/** Expected (status-pill) fields in the order they are shown in the panel. */
export const STATUS_FIELDS = [
  { key: 'date', label: 'Date' },
  { key: 'result', label: 'Result' },
  { key: 'issuer', label: 'Awarding body' },
  { key: 'description', label: 'Description' },
]

/* ---------------------------------------------------------------------------
 * Status pill (spec §3.2)
 * ------------------------------------------------------------------------- */

/**
 * Draft (grey) when none of the expected fields are filled,
 * "Missing: …" (amber) when the first expected field is absent,
 * "✓ Complete" (green) when all expected fields are filled.
 * Selectivity, subject, certificate and link never make a card "Missing".
 */
export function computeHonorStatus(row = {}) {
  const expected = [
    { key: 'date', label: 'Date', value: Boolean(row.received_month && row.received_year) },
    { key: 'result', label: 'Result', value: trim(row.result) !== '' },
    { key: 'issuer', label: 'Awarding body', value: trim(row.issuer) !== '' },
    { key: 'description', label: 'Description', value: trim(row.description) !== '' },
  ]
  const filled = expected.filter((field) => field.value)
  if (filled.length === 0) return { key: 'draft', label: 'Draft', missing: null, filled: 0, total: expected.length }
  const missing = expected.find((field) => !field.value)
  return missing
    ? { key: 'missing', label: `Missing: ${missing.label}`, missing: missing.label, filled: filled.length, total: expected.length }
    : { key: 'complete', label: '✓ Complete', missing: null, filled: filled.length, total: expected.length }
}

/* ---------------------------------------------------------------------------
 * Card meta (spec §3.3)
 * ------------------------------------------------------------------------- */

/** "Grade 9" / "Grades 9, 10". */
export function gradesLabel(gradeLevels = []) {
  const levels = [...new Set((gradeLevels || []).map(Number))]
    .filter((level) => HONOR_GRADE_LEVELS.includes(level))
    .sort((a, b) => a - b)
  if (!levels.length) return ''
  if (levels.length === 1) return `Grade ${levels[0]}`
  return `Grades ${levels.join(', ')}`
}

/** "Jun 2025" from received_month + received_year; '' when unset. */
export function receivedDateLabel(row = {}) {
  if (!row.received_month || !row.received_year) return ''
  return formatDate(`${String(row.received_year).padStart(4, '0')}-${String(row.received_month).padStart(2, '0')}`, 'month')
}

/**
 * One-line meta under the title:
 *   "Grade 9 · National · Jun 2025"
 *   "Grades 9, 10 · National"
 * Empty parts are skipped.
 */
export function buildHonorMeta(row = {}) {
  const parts = []
  const grades = gradesLabel(row.grade_levels)
  if (grades) parts.push(grades)
  const level = highestLevel(row.levels)
  if (level) parts.push(honorLevelLabel(level))
  const date = receivedDateLabel(row)
  if (date) parts.push(date)
  return parts.join(' · ')
}

/* ---------------------------------------------------------------------------
 * Draft ↔ row
 * ------------------------------------------------------------------------- */

export function emptyHonorDraft() {
  return {
    title: '',
    category: '',
    subject: '',
    received_month: '',
    received_year: '',
    issuer: '',
    result: '',
    grade_levels: [],
    levels: [],
    participants_context: '',
    description: '',
    certificate_document_id: '',
    verification_url: '',
    is_top5_commonapp: false,
  }
}

/** DB row → editable draft (every key always present). */
export function draftFromRow(row = {}) {
  return {
    ...emptyHonorDraft(),
    title: trim(row.title),
    category: row.category || '',
    subject: trim(row.subject || ''),
    received_month: dateToMonth(`${row.received_year || ''}-${String(row.received_month || '').padStart(2, '0')}`) || '',
    received_year: String(row.received_year || ''),
    issuer: trim(row.issuer || ''),
    result: row.result || '',
    grade_levels: [...(row.grade_levels || [])].map(Number).sort((a, b) => a - b),
    levels: [...(row.levels || [])],
    participants_context: trim(row.participants_context || ''),
    description: trim(row.description || ''),
    certificate_document_id: row.certificate_document_id || '',
    verification_url: trim(row.verification_url || ''),
    is_top5_commonapp: Boolean(row.is_top5_commonapp),
  }
}

const nullable = (value, max) => {
  const text = trim(value)
  return text ? text.slice(0, max) : null
}

/** Draft → whitelisted column set honorsApi may write. */
export function rowFromDraft(draft = {}) {
  const received = draft.received_month ? draft.received_month.split('-') : ['', '']
  return {
    title: trim(draft.title).slice(0, HONOR_LIMITS.title),
    category: draft.category || null,
    subject: nullable(draft.subject, HONOR_LIMITS.subject),
    received_month: received[1] ? Number(received[1]) : null,
    received_year: received[0] ? Number(received[0]) : null,
    issuer: nullable(draft.issuer, HONOR_LIMITS.issuer),
    result: draft.result || null,
    grade_levels: [...new Set((draft.grade_levels || []).map(Number))]
      .filter((level) => HONOR_GRADE_LEVELS.includes(level))
      .sort((a, b) => a - b),
    levels: [...new Set(draft.levels || [])].filter((level) =>
      ['school', 'city', 'regional', 'national', 'international'].includes(level)),
    participants_context: nullable(draft.participants_context, HONOR_LIMITS.participantsContext),
    description: nullable(draft.description, HONOR_LIMITS.description),
    certificate_document_id: draft.certificate_document_id || null,
    verification_url: nullable(draft.verification_url, 500),
    is_top5_commonapp: Boolean(draft.is_top5_commonapp),
  }
}

/* ---------------------------------------------------------------------------
 * Validation (spec §3.1)
 * ------------------------------------------------------------------------- */

const URL_PATTERN = /^https?:\/\//i

/**
 * Field → message. Required fields are enforced on create submit.
 * Inline errors only appear after the field was blurred (handled by the panel).
 */
export function validateHonor(draft = {}, mode = 'edit', { touched = {} } = {}) {
  const errors = {}
  const show = (key) => touched[key]

  const title = trim(draft.title)
  if (show('title') && !title) errors.title = 'Honor title is required'
  else if (title.length > HONOR_LIMITS.title) errors.title = `Keep it to ${HONOR_LIMITS.title} characters or fewer`

  if (show('category') && !draft.category) errors.category = 'Pick a category'

  const levels = draft.grade_levels || []
  if (show('grade_levels') && levels.length === 0) errors.grade_levels = 'Pick at least one grade level'

  const recognition = draft.levels || []
  if (show('levels') && recognition.length === 0) errors.levels = 'Pick at least one level of recognition'

  const subject = trim(draft.subject)
  if (subject.length > HONOR_LIMITS.subject) errors.subject = `Keep it to ${HONOR_LIMITS.subject} characters or fewer`

  const issuer = trim(draft.issuer)
  if (issuer.length > HONOR_LIMITS.issuer) errors.issuer = `Keep it to ${HONOR_LIMITS.issuer} characters or fewer`

  const participants = trim(draft.participants_context)
  if (participants.length > HONOR_LIMITS.participantsContext) {
    errors.participants_context = `Keep it to ${HONOR_LIMITS.participantsContext} characters or fewer`
  }

  const description = trim(draft.description)
  if (description.length > HONOR_LIMITS.description) {
    errors.description = `Keep it to ${HONOR_LIMITS.description} characters or fewer`
  }

  const url = trim(draft.verification_url)
  if (url && !URL_PATTERN.test(url)) errors.verification_url = 'Link must start with http:// or https://'

  return errors
}

/** How many of the four create-required fields are filled (sticky footer). */
export function requiredCompleted(draft = {}) {
  return REQUIRED_CREATE.filter(({ key }) => {
    const value = draft[key]
    if (key === 'grade_levels' || key === 'levels') return Array.isArray(value) && value.length > 0
    return trim(value) !== ''
  }).length
}

/** Per-category counts for the filter chips. */
export function honorCategoryCounts(items = []) {
  const counts = {}
  for (const item of items) counts[item.category] = (counts[item.category] || 0) + 1
  return counts
}

/** Card title fallback. */
export function honorTitle(row = {}) {
  return trim(row.title) || 'Untitled honor'
}

/* ---------------------------------------------------------------------------
 * Database error → friendly message (spec §2)
 * ------------------------------------------------------------------------- */

const FIELD_BY_CONSTRAINT = {
  honors_title_check: 'title',
  honors_subject_check: 'subject',
  honors_issuer_check: 'issuer',
  honors_description_check: 'description',
  honors_participants_context_check: 'participants_context',
  honors_verification_url_check: 'verification_url',
}

export function mapDbError(error) {
  const message = String(error?.message || '')
  const constraint = /violates check constraint "([^"]+)"/.exec(message)
  if (constraint && Object.hasOwn(FIELD_BY_CONSTRAINT, constraint[1])) {
    const field = FIELD_BY_CONSTRAINT[constraint[1]]
    return { field, message: `Check the ${field} field against its limit.` }
  }
  if (message.includes('TOP5_LIMIT')) {
    return { message: 'You can include up to 5 honors. Turn one off first.' }
  }
  if (message.includes('DOCUMENT_OWNER_MISMATCH') || message.includes('ATTEMPT_OWNER_MISMATCH')) {
    return { message: 'This file could not be linked. Please choose it again.' }
  }
  return { message: message || 'Something went wrong. Please try again.' }
}
