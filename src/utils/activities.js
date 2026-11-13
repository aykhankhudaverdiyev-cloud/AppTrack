/**
 * ============================================================================
 * activities.js — pure helpers for the Activities & Experiences section
 * ============================================================================
 * No React and no Supabase imports here on purpose: everything below is a pure
 * function so it can be unit-tested with `node --test src/utils/*.test.js`.
 *
 * Draft shape (UI)            → DB row (public.activities)
 *   start_month 'YYYY-MM'     → start_date 'YYYY-MM-01'
 *   end_month   'YYYY-MM'     → end_date   'YYYY-MM-01'  (null when ongoing)
 *   location "City, Country"  → city, country (split on the LAST comma)
 * ============================================================================
 */

import { ACTIVITY_LIMITS, categoryLabel } from '../constants/activityTypes.js'

const trim = (value) => (value == null ? '' : String(value)).trim()

/* ---------------------------------------------------------------------------
 * Status pill (spec §4)
 * ------------------------------------------------------------------------- */

export const STATUS_FIELD_LABELS = {
  organization_description: 'About the organization',
  long_description: 'What you did',
}

/** Fields the status pill looks at, in the order they are shown in the panel. */
export function expectedDescriptionFields(activityType) {
  const fields = ['long_description']
  if (activityType === 'volunteering' || activityType === 'work') fields.unshift('organization_description')
  return fields
}

/**
 * Draft (grey) when nothing is written, "Missing: …" (amber) when part of the
 * descriptions are there, "✓ Complete" (green) when all of them are.
 */
export function computeStatus(row = {}) {
  const fields = expectedDescriptionFields(row.activity_type)
  const filled = fields.filter((field) => trim(row[field]))
  if (filled.length === 0) return { key: 'draft', label: 'Draft', missing: null, filled: 0, total: fields.length }
  if (filled.length < fields.length) {
    const missingField = fields.find((field) => !trim(row[field]))
    return {
      key: 'missing',
      label: `Missing: ${STATUS_FIELD_LABELS[missingField]}`,
      missing: STATUS_FIELD_LABELS[missingField],
      filled: filled.length,
      total: fields.length,
    }
  }
  return { key: 'complete', label: '✓ Complete', missing: null, filled: filled.length, total: fields.length }
}

/* ---------------------------------------------------------------------------
 * Location
 * ------------------------------------------------------------------------- */

/** "Shamakhi, Azerbaijan" → { city: 'Shamakhi', country: 'Azerbaijan' } */
export function parseLocation(value) {
  const text = trim(value)
  if (!text) return { city: null, country: null }
  const index = text.lastIndexOf(',')
  if (index === -1) return { city: text, country: null }
  const city = text.slice(0, index).trim()
  const country = text.slice(index + 1).trim()
  if (!city || !country) return { city: text, country: null }
  return { city, country }
}

/** { city, country } → "Shamakhi, Azerbaijan" */
export function formatLocation(row = {}) {
  return [trim(row.city), trim(row.country)].filter(Boolean).join(', ')
}

/* ---------------------------------------------------------------------------
 * Dates: MM/YYYY in the UI, YYYY-MM in the draft, YYYY-MM-01 in the DB
 * ------------------------------------------------------------------------- */

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/

/** '2026-06' → '2026-06-01' */
export function monthToDate(month) {
  const text = trim(month)
  if (!MONTH_PATTERN.test(text)) return null
  return `${text}-01`
}

/** '2026-06-01' → '2026-06' */
export function dateToMonth(date) {
  const text = trim(date)
  const match = /^(\d{4})-(0[1-9]|1[0-2])-\d{2}$/.exec(text)
  return match ? `${match[1]}-${match[2]}` : ''
}

/** '2026-06' → '06/2026' (what the input shows) */
export function formatMonthInput(month) {
  const text = trim(month)
  if (!MONTH_PATTERN.test(text)) return ''
  const [year, part] = text.split('-')
  return `${part}/${year}`
}

/** '06/2026' or '6/2026' → '2026-06'; '' when incomplete or invalid. */
export function parseMonthInput(input) {
  const text = trim(input).replace(/\s+/g, '')
  const match = /^(\d{1,2})\/(\d{4})$/.exec(text)
  if (!match) return ''
  const month = Number(match[1])
  if (month < 1 || month > 12) return ''
  return `${match[2]}-${String(month).padStart(2, '0')}`
}

/* ---------------------------------------------------------------------------
 * Totals and metadata
 * ------------------------------------------------------------------------- */

/** ≈ hours in total, with a thousands separator. '' when either value is empty. */
export function hoursHelperText(hours, weeks, ongoing = false) {
  const h = Number(hours)
  const w = Number(weeks)
  if (!Number.isFinite(h) || !Number.isFinite(w) || h <= 0 || w <= 0) return ''
  const total = Math.round(h * w)
  return `≈ ${total.toLocaleString('en-US')} hours ${ongoing ? 'per year' : 'in total'}`
}

const trimNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? String(number) : ''
}

const SEASON_BY_MONTH = {
  1: 'Winter', 2: 'Winter', 3: 'Spring', 4: 'Spring', 5: 'Spring',
  6: 'Summer', 7: 'Summer', 8: 'Summer', 9: 'Fall', 10: 'Fall', 11: 'Fall', 12: 'Winter',
}

/** "Summer 2026" for a school-break activity, using its start month. */
export function seasonLabel(month) {
  const text = trim(month)
  if (!MONTH_PATTERN.test(text)) return ''
  const [year, part] = text.split('-')
  return `${SEASON_BY_MONTH[Number(part)]} ${year}`
}

/** "Grades 10–11", "Grade 11" */
export function gradesLabel(gradeLevels = []) {
  const levels = [...new Set((gradeLevels || []).map(Number).filter((n) => ACTIVITY_LIMITS.gradeLevels.includes(n)))].sort((a, b) => a - b)
  if (!levels.length) return ''
  if (levels.length === 1) return `Grade ${levels[0]}`
  const consecutive = levels.every((level, index) => index === 0 || level === levels[index - 1] + 1)
  return consecutive ? `Grades ${levels[0]}–${levels[levels.length - 1]}` : `Grades ${levels.join(', ')}`
}

export const MODE_LABELS = { in_person: 'In person', online: 'Online', hybrid: 'Hybrid' }
export const TIMING_LABELS = { school_year: 'School year', school_break: 'School break', all_year: 'All year' }
export const EMPLOYMENT_LABELS = { internship: 'Internship', part_time: 'Part-time', full_time: 'Full-time' }
export const OUTPUT_LABELS = {
  in_progress: 'In progress',
  under_review: 'Under review',
  submitted: 'Submitted',
  accepted: 'Accepted',
  published: 'Published',
}

/**
 * The one-line meta under the title:
 *   "Grades 10–11 · 4 h/wk · 40 wk/yr · Online"
 *   "Summer 2026 · 20 h/wk · 13 wk/yr · Unpaid"
 * Empty parts are skipped.
 */
export function buildMeta(row = {}) {
  const parts = []
  if (row.timing === 'school_break') {
    const season = seasonLabel(dateToMonth(row.start_date) || trim(row.start_month))
    if (season) parts.push(season)
  } else {
    const grades = gradesLabel(row.grade_levels)
    if (grades) parts.push(grades)
  }
  if (!parts.length) {
    const start = dateToMonth(row.start_date) || trim(row.start_month)
    const end = dateToMonth(row.end_date) || trim(row.end_month)
    if (start && !end) parts.push(`Since ${formatMonthInput(start)}`)
    else if (start && end) parts.push(`${formatMonthInput(start)} – ${formatMonthInput(end)}`)
  }
  const hours = trimNumber(row.hours_per_week)
  if (hours) parts.push(`${hours} h/wk`)
  const weeks = trimNumber(row.weeks_per_year)
  if (weeks) parts.push(`${weeks} wk/yr`)
  if (row.participation_mode && MODE_LABELS[row.participation_mode]) parts.push(MODE_LABELS[row.participation_mode])
  if (row.activity_type === 'work' && row.is_paid === false) parts.push('Unpaid')
  return parts.join(' · ')
}

/* ---------------------------------------------------------------------------
 * Draft ↔ row
 * ------------------------------------------------------------------------- */

export const REQUIRED_FIELDS = [
  { key: 'organization_name', label: 'Organization name' },
  { key: 'position', label: 'Your role' },
  { key: 'grade_levels', label: 'Grade levels' },
  { key: 'hours_per_week', label: 'Hours per week' },
  { key: 'weeks_per_year', label: 'Weeks per year' },
  { key: 'start_month', label: 'Start date' },
]

export function emptyDraft(activityType = 'other') {
  return {
    activity_type: activityType,
    organization_name: '',
    position: '',
    grade_levels: [],
    timing: 'school_year',
    hours_per_week: '',
    weeks_per_year: '',
    start_month: '',
    end_month: '',
    ongoing: true, // matches the create form default: no end date until toggled off
    location: '',
    participation_mode: 'in_person',
    is_paid: false,
    employment_type: 'part_time',
    supervisor_name: '',
    supervisor_email: '',
    organization_description: '',
    long_description: '',
    research_mentor: '',
    research_institution: '',
    research_question: '',
    output_status: 'in_progress',
  }
}

/** DB row → editable draft (all keys always present, so inputs stay controlled). */
export function draftFromRow(row = {}) {
  return {
    ...emptyDraft(row.activity_type || 'other'),
    activity_type: row.activity_type || 'other',
    organization_name: row.organization_name || '',
    position: row.position || '',
    grade_levels: [...(row.grade_levels || [])].map(Number).sort((a, b) => a - b),
    timing: row.timing || 'school_year',
    hours_per_week: row.hours_per_week == null ? '' : String(Number(row.hours_per_week)),
    weeks_per_year: row.weeks_per_year == null ? '' : String(Number(row.weeks_per_year)),
    start_month: dateToMonth(row.start_date),
    end_month: dateToMonth(row.end_date),
    ongoing: Boolean(row.ongoing),
    location: formatLocation(row),
    participation_mode: row.participation_mode || 'in_person',
    is_paid: Boolean(row.is_paid),
    employment_type: row.employment_type || 'part_time',
    supervisor_name: row.supervisor_name || '',
    supervisor_email: row.supervisor_email || '',
    organization_description: row.organization_description || '',
    long_description: row.long_description || '',
    research_mentor: row.research_mentor || '',
    research_institution: row.research_institution || '',
    research_question: row.research_question || '',
    output_status: row.output_status || 'in_progress',
  }
}

const nullable = (value, max) => {
  const text = trim(value)
  return text ? text.slice(0, max) : null
}

/** Draft → the exact column set activitiesApi is allowed to write. */
export function rowFromDraft(draft = {}) {
  const { city, country } = parseLocation(draft.location)
  const ongoing = Boolean(draft.ongoing)
  return {
    activity_type: draft.activity_type || 'other',
    organization_name: trim(draft.organization_name).slice(0, ACTIVITY_LIMITS.organizationName),
    position: trim(draft.position).slice(0, ACTIVITY_LIMITS.position),
    grade_levels: [...new Set((draft.grade_levels || []).map(Number))]
      .filter((level) => ACTIVITY_LIMITS.gradeLevels.includes(level))
      .sort((a, b) => a - b),
    timing: draft.timing || null,
    hours_per_week: draft.hours_per_week === '' || draft.hours_per_week == null ? null : Number(draft.hours_per_week),
    weeks_per_year: draft.weeks_per_year === '' || draft.weeks_per_year == null ? null : Number(draft.weeks_per_year),
    start_date: monthToDate(draft.start_month),
    end_date: ongoing ? null : monthToDate(draft.end_month),
    ongoing,
    city: nullable(city, 120),
    country: nullable(country, 120),
    participation_mode: draft.participation_mode || null,
    organization_description: nullable(draft.organization_description, ACTIVITY_LIMITS.organizationDescription),
    long_description: nullable(draft.long_description, ACTIVITY_LIMITS.longDescription),
    is_paid: Boolean(draft.is_paid),
    employment_type: draft.employment_type || null,
    supervisor_name: nullable(draft.supervisor_name, 120),
    supervisor_email: nullable(draft.supervisor_email, 160),
    research_mentor: nullable(draft.research_mentor, 120),
    research_institution: nullable(draft.research_institution, 160),
    research_question: nullable(draft.research_question, ACTIVITY_LIMITS.researchQuestion),
    output_status: draft.output_status || null,
  }
}

/* ---------------------------------------------------------------------------
 * Validation (spec §5.2: inline errors, invalid values are never saved)
 * ------------------------------------------------------------------------- */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Returns an object of field → message. An empty object means the draft can be
 * saved. `mode === 'create'` also enforces the six required fields.
 */
export function validateActivity(draft = {}, mode = 'edit') {
  const errors = {}
  const organization = trim(draft.organization_name)
  const position = trim(draft.position)

  if (mode === 'create' && !organization) errors.organization_name = 'Organization name is required'
  else if (organization.length > ACTIVITY_LIMITS.organizationName) errors.organization_name = `Keep it to ${ACTIVITY_LIMITS.organizationName} characters or fewer`

  if (mode === 'create' && !position) errors.position = 'Your role is required'
  else if (position.length > ACTIVITY_LIMITS.position) errors.position = `Keep it to ${ACTIVITY_LIMITS.position} characters or fewer`

  const levels = draft.grade_levels || []
  if (mode === 'create' && levels.length === 0) errors.grade_levels = 'Pick at least one grade level'

  const hours = draft.hours_per_week
  const hasHours = hours !== '' && hours != null
  if (mode === 'create' && !hasHours) errors.hours_per_week = 'Hours per week is required'
  else if (hasHours && (Number.isNaN(Number(hours)) || Number(hours) < ACTIVITY_LIMITS.hoursPerWeek.min || Number(hours) > ACTIVITY_LIMITS.hoursPerWeek.max)) {
    errors.hours_per_week = `Hours per week must be between ${ACTIVITY_LIMITS.hoursPerWeek.min} and ${ACTIVITY_LIMITS.hoursPerWeek.max}`
  }

  const weeks = draft.weeks_per_year
  const hasWeeks = weeks !== '' && weeks != null
  if (mode === 'create' && !hasWeeks) errors.weeks_per_year = 'Weeks per year is required'
  else if (hasWeeks && (!Number.isInteger(Number(weeks)) || Number(weeks) < ACTIVITY_LIMITS.weeksPerYear.min || Number(weeks) > ACTIVITY_LIMITS.weeksPerYear.max)) {
    errors.weeks_per_year = `Weeks per year must be between ${ACTIVITY_LIMITS.weeksPerYear.min} and ${ACTIVITY_LIMITS.weeksPerYear.max}`
  }

  const start = trim(draft.start_month)
  if (mode === 'create' && !start) errors.start_month = 'Start date is required'
  else if (start && !MONTH_PATTERN.test(start)) errors.start_month = 'Use MM/YYYY'

  const end = trim(draft.end_month)
  if (!draft.ongoing) {
    if (!end && mode === 'edit') errors.end_month = 'End date is required'
    else if (!MONTH_PATTERN.test(end)) errors.end_month = 'Use MM/YYYY'
    else if (end && start && MONTH_PATTERN.test(start) && end < start) errors.end_month = 'End date must be after the start date'
  }

  if (trim(draft.organization_description).length > ACTIVITY_LIMITS.organizationDescription) errors.organization_description = `Keep it to ${ACTIVITY_LIMITS.organizationDescription} characters or fewer`
  if (trim(draft.long_description).length > ACTIVITY_LIMITS.longDescription) errors.long_description = `Keep it to ${ACTIVITY_LIMITS.longDescription} characters or fewer`
  if (trim(draft.research_question).length > ACTIVITY_LIMITS.researchQuestion) errors.research_question = `Keep it to ${ACTIVITY_LIMITS.researchQuestion} characters or fewer`

  const email = trim(draft.supervisor_email)
  if (email && !EMAIL_PATTERN.test(email)) errors.supervisor_email = 'Enter a valid email address'

  return errors
}

/** How many of the six required fields are filled (create-mode footer). */
export function requiredCompleted(draft = {}) {
  return REQUIRED_FIELDS.filter(({ key }) => {
    const value = draft[key]
    if (key === 'grade_levels') return Array.isArray(value) && value.length > 0
    if (key === 'hours_per_week') return value !== '' && value != null && !Number.isNaN(Number(value))
    if (key === 'weeks_per_year') return value !== '' && value != null && !Number.isNaN(Number(value))
    return trim(value) !== ''
  }).length
}

/** Per-category counts for the filter chips. */
export function categoryCounts(items = []) {
  const counts = {}
  for (const item of items) counts[item.activity_type] = (counts[item.activity_type] || 0) + 1
  return counts
}

/** Panel title: organization name, or a friendly fallback while it is empty. */
export function activityTitle(row = {}) {
  return trim(row.organization_name) || 'New activity'
}

/** One-line label used in menus and dialogs. */
export function activityLabel(row = {}) {
  return trim(row.organization_name) || categoryLabel(row.activity_type)
}
