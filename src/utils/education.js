/** ============================================================================
 * education.js — pure helpers for the Education page (no React, no Supabase)
 * ============================================================================
 * DB row (`public.education_entries`) ⇄ panel draft:
 *   start_date / end_date  date 'YYYY-MM-DD'  ⇄  'YYYY-MM'  ("Sep 2023")
 *   grading_scale          free text          ⇄  a fixed option that knows its
 *                                                 maximum ("1–5" → 5)
 *
 * Grades live in `public.grade_rows` as one row per subject × grade level ×
 * semester. The panel shows a subject × grade table, so the two helpers
 * `gradeSubjectsFromRows` / `gradeRowsFromSubjects` convert between the flat
 * row list and that table without losing any rows it does not display.
 * ============================================================================ */

import { dateToMonth, formatDate } from './dates.js'

/** Panel "Type" segmented control — order matters (spec: four equal parts). */
export const EDUCATION_TYPES = [
  { key: 'secondary_school', label: 'Secondary school', emoji: '🏫', tint: 'lilac' },
  { key: 'university', label: 'University', emoji: '🎓', tint: 'sky' },
  { key: 'pre_college', label: 'Program', emoji: '📚', tint: 'mint' },
  { key: 'foundation_year', label: 'Foundation year', emoji: '📚', tint: 'mint' },
]

export const TYPE_KEYS = EDUCATION_TYPES.map((type) => type.key)

/** Program-like entries share the "Programs" filter chip. */
export const PROGRAM_TYPES = ['pre_college', 'foundation_year']

export const educationType = (key) => EDUCATION_TYPES.find((type) => type.key === key) || EDUCATION_TYPES[0]

/** Every filter chip is always rendered, even at 0 (spec: "University 0"). */
export const EDUCATION_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'secondary_school', label: 'Secondary school' },
  { key: 'university', label: 'University' },
  { key: 'programs', label: 'Programs' },
]

export const LANGUAGE_OPTIONS = [
  'Azerbaijani', 'English', 'Russian', 'Turkish', 'French', 'German', 'Spanish', 'Other',
]

export const QUALIFICATION_OPTIONS = [
  'National diploma (Attestat)',
  'IB Diploma',
  'A Levels',
  'AP / US High School Diploma',
  'Other',
]

/** `maximum` drives the grey "/ 5" suffix inside Overall average. */
export const GRADING_SCALES = [
  { value: '1–5', maximum: 5 },
  { value: '0–100', maximum: 100 },
  { value: '4.0 GPA', maximum: 4 },
  { value: '1–7', maximum: 7 },
  { value: '0–20', maximum: 20 },
  { value: 'Other', maximum: null },
]

export const gradingMaximum = (scale) =>
  GRADING_SCALES.find((option) => option.value === scale)?.maximum ?? null

/** Grade columns in the GRADES table (spec: Grade 9 / 10 / 11). */
export const GRADE_COLUMNS = [9, 10, 11]

/** Grade levels the table can display, with their semesters. */
export const SEMESTER_COLUMNS = [1, 2]

const text = (value) => (value == null ? '' : String(value).trim())

/** 'YYYY-MM' for a month grid cell. */
export const monthIso = (year, month) => `${year}-${String(month).padStart(2, '0')}`

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/**
 * What a student may type into a month field: "09/2023", "9/2023", "Sep 2023",
 * "september 2023", "2023-09" → 'YYYY-MM'. Anything else → '' (ignored, the
 * field keeps the raw text until blur).
 */
export function parseMonthText(input) {
  const raw = text(input).toLowerCase().replace(/\s+/g, ' ')
  if (!raw) return ''
  const digits = /^(\d{1,2})\s*\/\s*(\d{4})$/.exec(raw)
  if (digits) {
    const month = Number(digits[1])
    return month >= 1 && month <= 12 ? monthIso(Number(digits[2]), month) : ''
  }
  const iso = /^(\d{4})-(\d{2})$/.exec(raw)
  if (iso) {
    const month = Number(iso[2])
    return month >= 1 && month <= 12 ? raw : ''
  }
  const named = /^([a-z]+)\.?,?\s*(\d{4})$/.exec(raw)
  if (!named) return ''
  const index = MONTH_NAMES.indexOf(named[1].slice(0, 3))
  return index === -1 ? '' : monthIso(Number(named[2]), index + 1)
}

export const inFilter = (entry, filter) => {
  if (!filter || filter === 'all') return true
  if (filter === 'programs') return PROGRAM_TYPES.includes(entry?.entry_type)
  return entry?.entry_type === filter
}

export const filterEntries = (entries = [], filter = 'all') => entries.filter((entry) => inFilter(entry, filter))

/** [{ key, label, count }] for every chip — zeros included, always. */
export const filterCounts = (entries = []) => EDUCATION_FILTERS.map((chip) => ({
  key: chip.key,
  label: chip.label,
  count: chip.key === 'all'
    ? entries.length
    : entries.filter((entry) => inFilter(entry, chip.key)).length,
}))

/** 'YYYY-MM-DD' | 'YYYY-MM' → 'YYYY-MM' for the month picker. */
export const monthValue = (date) => dateToMonth(date)

/** 'YYYY-MM' → 'YYYY-MM-DD' for the date column (`null` when empty). */
export const dateValue = (month) => (/^\d{4}-\d{2}$/.test(String(month || '')) ? `${month}-01` : null)

/** "Sep 2023" */
export const monthLabel = (value) => (value ? formatDate(monthValue(value), 'month') : '')

const startAcademicYear = (value) => {
  const month = Number(String(value || '').slice(5, 7))
  const year = Number(String(value || '').slice(0, 4))
  if (!year || !month) return null
  // An academic year starts in September: Jan–Aug still belongs to the year before.
  return month >= 9 ? year : year - 1
}

/** Azerbaijani — and many international — secondary schools end at grade 11. */
export const FINAL_SECONDARY_GRADE = 11

/**
 * The grade the student is in right now, counted back from the expected
 * graduation: a school finishing in Jun 2027 is at grade 11 in 2026-27.
 * Returns null when the entry is not current or the result falls outside the
 * grade columns (9–11) the table shows.
 */
export function currentGrade(entry = {}, now = new Date()) {
  const end = startAcademicYear(entry.end_date)
  const today = startAcademicYear(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  if (end == null || today == null || !entry.is_current) return null
  const grade = FINAL_SECONDARY_GRADE - (end - today)
  return grade >= 9 && grade <= FINAL_SECONDARY_GRADE ? grade : null
}

/** "Sep 2023 – Jun 2027 · Grade 11" */
export function entryMeta(entry = {}, now = new Date()) {
  const start = monthLabel(entry.start_date)
  const end = monthLabel(entry.end_date)
  const range = start && end ? `${start} – ${end}` : start || (end ? `Until ${end}` : '')
  const grade = entry.is_current && entry.entry_type === 'secondary_school' ? currentGrade(entry, now) : null
  return [range, grade ? `Grade ${grade}` : null].filter(Boolean).join(' · ')
}

/** "5.00" — always two decimals, like the table cell in the design. */
export function formatAverage(value) {
  const number = Number(value)
  if (value === '' || value == null || Number.isNaN(number)) return ''
  return number.toFixed(2)
}

/** The two small grey chips on the selected card. */
export function entryChips(entry = {}) {
  const chips = []
  const average = formatAverage(entry.overall_average)
  if (average) {
    const maximum = Number(entry.scale_maximum) || gradingMaximum(text(entry.grading_scale))
    chips.push(maximum ? `Average ${average} / ${maximum}` : `Average ${average}`)
  }
  if (Number(entry.class_size) > 0) chips.push(`Class of ${Number(entry.class_size)}`)
  return chips
}

/** Card title with a readable fallback for a not-yet-named entry. */
export const entryTitle = (entry = {}) => text(entry.institution_name) || 'New education entry'

/** Labels in the panel carry a red asterisk; these keys must not stay empty. */
export const REQUIRED_FIELDS = ['institution_name', 'country', 'start_date', 'end_date', 'qualification', 'grading_scale']

/** University entries collect degree data instead of school grades. */
export const isUniversity = (entry = {}) => entry.entry_type === 'university'

export const showsGrades = (entry = {}) => entry.entry_type === 'secondary_school'

const REQUIRED_MESSAGES = {
  institution_name: 'Add the institution name',
  country: 'Choose the country',
  start_date: 'Add the start date',
  end_date: 'Add the expected graduation',
  qualification: 'Choose the qualification',
  grading_scale: 'Choose the grading scale',
}

/**
 * Inline error messages. All of them are returned; usePanelValidation decides
 * when to reveal them (after blur or after a submit attempt).
 */
export function validateEducation(draft = {}) {
  const errors = {}
  for (const key of REQUIRED_FIELDS) {
    if ((key === 'qualification' || key === 'grading_scale') && isUniversity(draft)) continue
    if (!text(draft[key])) errors[key] = REQUIRED_MESSAGES[key]
  }
  if (draft.start_date && draft.end_date && draft.end_date < draft.start_date) {
    errors.end_date = 'Expected graduation is before the start date'
  }
  if (text(draft.class_rank) && !draft.school_does_not_rank && Number(draft.class_size) > 0
    && Number(draft.class_rank) > Number(draft.class_size)) {
    errors.class_rank = 'Class rank is larger than the class size'
  }
  return errors
}

/* ---------------------------------------------------------------------------
 * Draft ⇄ database payload
 * ------------------------------------------------------------------------- */

/** Every field the panel edits, empty. */
export function emptyEntryDraft(type = 'secondary_school') {
  return {
    entry_type: type,
    institution_name: '',
    country: '',
    city: '',
    ceeb_code: '',
    language_of_instruction: '',
    start_date: '',
    end_date: '',
    is_current: false,
    qualification: '',
    grading_scale: type === 'secondary_school' ? '1–5' : '',
    overall_average: '',
    scale_maximum: gradingMaximum('1–5'),
    class_rank: '',
    class_size: '',
    school_does_not_rank: false,
    school_counselor_name: '',
    school_counselor_email: '',
    school_counselor_phone: '',
    transcript_document_id: '',
    degree: '',
    major: '',
    gpa: '',
    gpa_scale: '',
  }
}

/** DB row → panel draft (dates become 'YYYY-MM', the average keeps 2 decimals). */
export function draftFromEntry(row = {}) {
  const draft = emptyEntryDraft(row.entry_type || 'secondary_school')
  for (const key of Object.keys(draft)) {
    if (row[key] == null) continue
    draft[key] = row[key]
  }
  draft.overall_average = formatAverage(row.overall_average)
  draft.start_date = monthValue(row.start_date)
  draft.end_date = monthValue(row.end_date)
  draft.transcript_document_id = row.transcript_document_id || ''
  draft.overall_average = draft.overall_average === '' ? '' : draft.overall_average
  return draft
}

/** Panel draft → DB payload (a month becomes the first day of that month). */
export function entryPayload(draft = {}) {
  const number = (value) => {
    const clean = text(value)
    return clean === '' ? null : Number(clean)
  }
  const school = showsGrades(draft)
  return {
    entry_type: draft.entry_type || 'secondary_school',
    institution_name: text(draft.institution_name) || 'Untitled institution',
    country: text(draft.country) || null,
    city: text(draft.city) || null,
    ceeb_code: text(draft.ceeb_code) || null,
    language_of_instruction: draft.language_of_instruction || null,
    start_date: dateValue(draft.start_date),
    end_date: dateValue(draft.end_date),
    is_current: Boolean(draft.is_current),
    qualification: school ? draft.qualification || null : null,
    grading_scale: school ? draft.grading_scale || null : null,
    overall_average: school ? number(draft.overall_average) : null,
    scale_maximum: school ? gradingMaximum(draft.grading_scale) : null,
    class_rank: draft.school_does_not_rank ? null : number(draft.class_rank),
    class_size: number(draft.class_size),
    school_does_not_rank: Boolean(draft.school_does_not_rank),
    school_counselor_name: text(draft.school_counselor_name) || null,
    school_counselor_email: text(draft.school_counselor_email) || null,
    school_counselor_phone: text(draft.school_counselor_phone) || null,
    transcript_document_id: draft.transcript_document_id || null,
    degree: isUniversity(draft) ? text(draft.degree) || null : null,
    major: isUniversity(draft) ? text(draft.major) || null : null,
    gpa: isUniversity(draft) ? number(draft.gpa) : null,
    gpa_scale: isUniversity(draft) ? number(draft.gpa_scale) : null,
  }
}

/** Only the fields the user actually edited go into an autosave PATCH. */
export function patchFor(payload, keys) {
  return Object.fromEntries(keys.filter((key) => key in payload).map((key) => [key, payload[key]]))
}

/* ---------------------------------------------------------------------------
 * Grades: flat grade_rows ⇄ subject × grade table
 * ------------------------------------------------------------------------- */

const cellKey = (gradeLevel, semester) => `${gradeLevel}:${semester}`

/**
 * Rows → [{ key, name, cells: { '9:1': { id, grade, is_predicted } } }] in
 * sort order. Rows for grade levels/semesters that the table does not display
 * are kept in `cells` so saving never drops them.
 */
export function gradeSubjectsFromRows(rows = []) {
  const subjects = new Map()
  const order = []
  for (const row of rows) {
    const name = text(row.subject)
    if (!name) continue
    if (!subjects.has(name)) {
      subjects.set(name, { key: name, name, cells: {}, order: Number(row.sort_order ?? 0) })
      order.push(name)
    }
    const subject = subjects.get(name)
    subject.cells[cellKey(row.grade_level, row.semester || 1)] = {
      id: row.id,
      grade: row.grade == null ? '' : String(row.grade),
      is_predicted: Boolean(row.is_predicted),
    }
  }
  return [...subjects.values()].sort((a, b) => a.order - b.order)
}

/** Visible grade for a table cell ('' when the student has not typed one). */
export const cellGrade = (subject, gradeLevel, semester = 1) =>
  subject?.cells?.[cellKey(gradeLevel, semester)]?.grade ?? ''

/**
 * Subjects → grade_rows payload. Empty cells and unnamed subjects are skipped
 * (an empty cell means "no grade", and syncGradeRows deletes what it does not
 * receive). Every kept cell keeps its id so updates stay in place.
 */
export function gradeRowsFromSubjects(subjects = []) {
  const rows = []
  subjects.forEach((subject, subjectIndex) => {
    const name = text(subject.name)
    if (!name) return
    Object.entries(subject.cells || {}).forEach(([key, cell], cellIndex) => {
      const [gradeLevel, semester] = key.split(':').map(Number)
      const grade = text(cell?.grade)
      if (!grade) return
      rows.push({
        id: cell.id,
        subject: name,
        grade_level: gradeLevel,
        semester,
        grade,
        is_predicted: Boolean(cell.is_predicted),
        sort_order: subjectIndex * 10 + cellIndex,
      })
    })
  })
  return rows
}

/** "Saved just now" / "Saved 2 s ago" / "Saved 3 min ago" — header status. */
export function savedLabel(savedAt, now = Date.now()) {
  if (!savedAt) return ''
  const seconds = Math.max(0, Math.round((now - new Date(savedAt).getTime()) / 1000))
  if (seconds < 5) return 'Saved just now'
  if (seconds < 60) return `Saved ${seconds} s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `Saved ${minutes} min ago`
  return `Saved ${Math.round(minutes / 60)} h ago`
}
