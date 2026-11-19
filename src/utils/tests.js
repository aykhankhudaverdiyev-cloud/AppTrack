/** ============================================================================
 * tests.js — pure helpers for Test Scores (spec §4)
 * ============================================================================
 * No React, no Supabase: unit-tested with `node --test`.
 *
 * Attempt draft shape (UI) → DB row (public.test_attempts):
 *   test_date 'YYYY-MM-DD' → test_date (day precision)
 *   sections → saved with rpc('save_test_sections', …)
 * ============================================================================ */

import { formatDate } from './dates.js'
import { TEST_PRESETS, ADMISSION_TYPES, ENGLISH_TYPES, TEST_STATUSES, needsExamName } from '../constants/tests.js'

const trim = (value) => (value == null ? '' : String(value)).trim()

/** Convert a string/number input to a number or null. Empty → null, NaN → null. */
export function toNumberOrNull(value) {
  if (value == null) return null
  const text = String(value).trim()
  if (text === '') return null
  const n = Number(text)
  return Number.isFinite(n) ? n : null
}

const REQUIRED_CREATE = [
  { key: 'test_type', label: 'Test type' },
  { key: 'status', label: 'Status' },
]

/** Section row shape: { id?, section, score, score_max } */
export function emptySection() {
  return { id: '', section: '', score: '', score_max: '' }
}

/** Sort: Released first (test date desc), then Waiting, Registered, Planned (date asc). */
const STATUS_RANK = { released: 0, taken_waiting: 1, registered: 2, planned: 3 }

const MAX_DATE_KEY = 8_640_000_000_000_000

export function testSortKey(attempt = {}) {
  const statusRank = STATUS_RANK[attempt.status] ?? 99
  const date = Date.parse(attempt.test_date)
  if (!Number.isFinite(date)) return `${String(statusRank).padStart(2, '0')}|9999999999999999`
  // Released / waiting descend by date; planned / registered ascend by date.
  const dateKey = attempt.status === 'released' || attempt.status === 'taken_waiting'
    ? MAX_DATE_KEY - date
    : date
  return `${String(statusRank).padStart(2, '0')}|${String(dateKey).padStart(16, '0')}`
}

/** "11 Apr 2026" from test_date; '' when unset. */
export function testDateLabel(attempt = {}) {
  if (!attempt.test_date) return ''
  return formatDate(attempt.test_date, 'day')
}

/** Meta under the big score: "11 Apr 2026 · Attempt 1" or "Expires 11 Apr 2028". */
export function testMeta(attempt = {}) {
  const parts = []
  if (attempt.test_date) parts.push(testDateLabel(attempt))
  const attemptLabel = attempt.attempt_number != null ? `Attempt ${attempt.attempt_number}` : null
  if (ENGLISH_TYPES.includes(attempt.test_type) && attempt.expires_on) {
    parts.push(`Expires ${formatDate(attempt.expires_on, 'day')}`)
  } else if (attemptLabel) {
    parts.push(attemptLabel)
  }
  return parts.join(' · ')
}

/** Card big text: score + grey "/ max", or AP-style "5 · 5" with "{n} exams" grey. */
export function testScoreText(attempt = {}) {
  const sections = attempt.sections || []
  if (attempt.test_type === 'AP' && sections.length) {
    const scores = sections
      .map((s) => s.score)
      .filter((score) => score !== '' && score != null)
    return { big: scores.join(' · ') || '—', grey: `${scores.length} exams` }
  }
  if (attempt.overall_score != null && attempt.overall_score !== '') {
    return { big: String(attempt.overall_score), grey: attempt.overall_max != null ? `/ ${attempt.overall_max}` : '' }
  }
  return { big: '—', grey: '' }
}

/* ---------------------------------------------------------------------------
 * Overall score rules (spec §4.2 presets)
 * ------------------------------------------------------------------------- */

/** Round to nearest 0.5: x.25 → x.5, x.75 → next whole (IELTS rule). */
export function roundToHalf(value) {
  return Math.round(value * 2) / 2
}

/**
 * Suggested overall from sections, or null when the type has no suggestion.
 * "Auto" types (SAT / PSAT / TOEFL) are read-only sums; "suggested" types
 * prefill when empty and the user can type over them.
 */
export function suggestOverall(testType, sections = []) {
  const preset = TEST_PRESETS[testType]
  if (!preset || !preset.overall) return null
  const nums = sections.map((s) => toNumberOrNull(s.score))

  switch (preset.overall) {
    case 'sum-auto':
    case 'sum':
      if (nums.some((n) => n == null) || nums.length < preset.sections.length || !nums.length) return null
      return nums.reduce((a, b) => a + b, 0)
    case 'avg':
      if (nums.length === 0) return null
      return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
    case 'ielts':
      if (nums.length < 4 || nums.slice(0, 4).some((n) => n == null)) return null
      return roundToHalf(nums.slice(0, 4).reduce((a, b) => a + b, 0) / 4)
    case 'verbal-quant': {
      const verbal = nums[0], quant = nums[1]
      if (!Number.isFinite(verbal) || !Number.isFinite(quant)) return null
      return verbal + quant
    }
    default:
      return null
  }
}

/** IELTS/TOEFL/Duolingo/PTE: test date + 2 years; otherwise null. */
export function defaultExpiry(testType, testDate) {
  if (!ENGLISH_TYPES.includes(testType)) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(testDate || ''))
  if (!match) return null
  const [year, month, day] = match.slice(1).map(Number)
  const targetYear = year + 2
  const lastDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate()
  return `${String(targetYear).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}

/** Apply a preset to a brand-new attempt. Never overwrites sections the user already entered. */
export function applyPreset(testType, existingSections = []) {
  if (existingSections.some((s) => [s.section, s.score, s.score_max].some((field) => trim(field) !== ''))) return existingSections
  const preset = TEST_PRESETS[testType]
  if (!preset) return []
  return preset.sections.map(([section, scoreMax], index) => ({
    id: '',
    section,
    score: '',
    score_max: String(scoreMax),
    sort_order: index,
  }))
}

/* ---------------------------------------------------------------------------
 * Draft ↔ row
 * ------------------------------------------------------------------------- */

export function scoreDraft(draft, sections) {
  if (draft.status !== 'released') return draft
  const auto = suggestOverall(draft.test_type, sections)
  return { ...draft, overall_score: draft.overall_score === '' ? auto : draft.overall_score }
}

export function emptyTestDraft(testType = 'SAT') {
  return {
    test_type: testType,
    national_exam_name: '',
    status: 'planned',
    test_date: '',
    attempt_number: 1,
    overall_score: '',
    overall_max: TEST_PRESETS[testType]?.overallMax ?? '',
    trf_number: '',
    expires_on: '',
    is_best: false,
    notes: '',
    report_document_id: '',
    sections: [],
  }
}

/** DB row (+ optional section rows) → editable draft. */
export function draftFromRow(row = {}, sections = []) {
  return {
    ...emptyTestDraft(row.test_type),
    test_type: row.test_type || 'SAT',
    national_exam_name: trim(row.national_exam_name || ''),
    status: row.status || 'planned',
    test_date: row.test_date || '',
    attempt_number: Number(row.attempt_number || 1),
    overall_score: row.overall_score == null ? '' : String(row.overall_score),
    overall_max: row.overall_max == null ? '' : String(row.overall_max),
    trf_number: trim(row.trf_number || ''),
    expires_on: row.expires_on || '',
    is_best: Boolean(row.is_best),
    notes: trim(row.notes || ''),
    report_document_id: row.report_document_id || '',
    sections: (sections || []).map((s) => ({
      id: s.id || '',
      section: trim(s.section || ''),
      score: s.score == null ? '' : String(s.score),
      score_max: s.score_max == null ? '' : String(s.score_max),
      sort_order: s.sort_order == null ? 0 : Number(s.sort_order),
    })).sort((a, b) => a.sort_order - b.sort_order),
  }
}

const nullable = (value, max) => {
  const text = trim(value)
  return text ? text.slice(0, max) : null
}

/** Draft → whitelisted column set testsApi may write (excludes sections). */
export function rowFromDraft(draft = {}) {
  return {
    test_type: draft.test_type || 'SAT',
    national_exam_name: nullable(draft.national_exam_name, 100),
    status: draft.status || 'planned',
    test_date: draft.test_date || null,
    attempt_number: Number(draft.attempt_number) || 1,
    overall_score: draft.overall_score === '' || draft.overall_score == null ? null : Number(draft.overall_score),
    overall_max: draft.overall_max === '' || draft.overall_max == null ? null : Number(draft.overall_max),
    trf_number: nullable(draft.trf_number, 40),
    expires_on: draft.expires_on || null,
    is_best: Boolean(draft.is_best),
    notes: nullable(draft.notes, 500),
    report_document_id: draft.report_document_id || null,
  }
}

/* ---------------------------------------------------------------------------
 * Validation (spec §4.1)
 * ------------------------------------------------------------------------- */

const URL_PATTERN = /^https?:\/\//i

// `mode` is kept in the signature (every call site passes it) so a future
// create-only rule can read it without changing callers; today both modes
// validate identically.
// eslint-disable-next-line no-unused-vars
export function validateTestAttempt(draft = {}, mode = 'edit', { touched = {} } = {}) {
  const errors = {}
  const show = (key) => touched[key]

  if (show('test_type') && !draft.test_type) errors.test_type = 'Pick a test type'
  if (draft.test_type && !ADMISSION_TYPES.includes(draft.test_type) && !ENGLISH_TYPES.includes(draft.test_type) && draft.test_type !== 'OTHER') {
    errors.test_type = 'Pick a valid test type'
  }

  if ((draft.test_type === 'NATIONAL_EXAM' || draft.test_type === 'OTHER')) {
    const name = trim(draft.national_exam_name)
    if (show('national_exam_name') && !name) errors.national_exam_name = 'Add the exam name'
    else if (name.length > 100) errors.national_exam_name = 'Keep it to 100 characters or fewer'
  }

  if (show('status') && !draft.status) errors.status = 'Pick a status'

  if (draft.status && !TEST_STATUSES.some((status) => status.key === draft.status)) errors.status = 'Pick a valid status'

  const attempt = Number(draft.attempt_number)
  if (show('attempt_number') && (!Number.isInteger(attempt) || attempt < 1)) {
    errors.attempt_number = 'Attempt must be 1 or higher'
  }

  const overall = draft.overall_score === '' || draft.overall_score == null ? null : Number(draft.overall_score)
  const max = draft.overall_max === '' || draft.overall_max == null ? null : Number(draft.overall_max)
  if (overall != null && (overall < 0 || (max != null && overall > max))) {
    errors.overall_score = 'Overall score cannot exceed the maximum'
  }

  const trf = trim(draft.trf_number)
  if (trf.length > 40) errors.trf_number = 'Keep it to 40 characters or fewer'

  const notes = trim(draft.notes)
  if (notes.length > 500) errors.notes = 'Keep it to 500 characters or fewer'

  const url = trim(draft.verification_url || '')
  if (url && !URL_PATTERN.test(url)) errors.verification_url = 'Link must start with http:// or https://'

  const testDate = draft.test_date
  const expires = draft.expires_on
  if (testDate && expires && expires <= testDate) {
    errors.expires_on = 'Expires on must be after the test date'
  }

  return errors
}

export function testRequiredFields(draft = {}) {
  return needsExamName(draft.test_type) ? [...REQUIRED_CREATE, { key: 'national_exam_name', label: 'Exam name' }] : REQUIRED_CREATE
}

/** Required fields filled (create). */
export function requiredCompleted(draft = {}) {
  return testRequiredFields(draft).filter(({ key }) => {
    const value = draft[key]
    return trim(value) !== ''
  }).length
}

/** Test counts per group for filter chips. */
export function testGroupCounts(items = []) {
  const counts = { admission: 0, english: 0, other: 0 }
  for (const item of items) {
    if (ENGLISH_TYPES.includes(item.test_type)) counts.english++
    else if (ADMISSION_TYPES.includes(item.test_type)) counts.admission++
    else counts.other++
  }
  return counts
}

/* ---------------------------------------------------------------------------
 * Database error → friendly message (spec §2)
 * ------------------------------------------------------------------------- */

export function mapDbError(error) {
  const message = String(error?.message || '')
  if (message.includes('ATTEMPT_OWNER_MISMATCH') || message.includes('DOCUMENT_OWNER_MISMATCH')) {
    return { message: 'This file could not be linked. Please choose it again.' }
  }
  const match = /violates check constraint "([^"]+)"/.exec(message)
  if (match) {
    const field = {
      test_attempts_score_check: 'overall_score',
      test_attempts_expiry_check: 'expires_on',
      test_attempts_trf_check: 'trf_number',
      test_attempts_notes_check: 'notes',
      test_attempts_exam_name_check: 'national_exam_name',
      test_attempts_attempt_number_check: 'attempt_number',
      test_section_scores_score_check: 'score',
    }[match[1]]
    return field ? { field, message: `Check the ${field.replace('_', ' ')} value.` } : { message }
  }
  return { message: message || 'Something went wrong. Please try again.' }
}
