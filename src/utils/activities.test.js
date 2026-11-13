/**
 * Activities redesign — pure helper tests (spec §8: computeStatus, location,
 * month helpers, hours helper, meta line and validation).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildMeta,
  categoryCounts,
  computeStatus,
  dateToMonth,
  draftFromRow,
  emptyDraft,
  formatLocation,
  formatMonthInput,
  gradesLabel,
  hoursHelperText,
  monthToDate,
  parseLocation,
  parseMonthInput,
  requiredCompleted,
  rowFromDraft,
  seasonLabel,
  validateActivity,
} from './activities.js'

/* ── status pill ──────────────────────────────────────────────────────────── */

test('status: nothing written → Draft', () => {
  assert.equal(computeStatus({ activity_type: 'sports' }).key, 'draft')
  assert.equal(computeStatus({ activity_type: 'volunteering', long_description: '   ' }).label, 'Draft')
})

test('status: volunteering needs both descriptions', () => {
  const one = computeStatus({ activity_type: 'volunteering', long_description: 'Helped out' })
  assert.equal(one.key, 'missing')
  assert.equal(one.label, 'Missing: About the organization')
  const other = computeStatus({ activity_type: 'volunteering', organization_description: 'Library' })
  assert.equal(other.label, 'Missing: What you did')
})

test('status: work behaves like volunteering, other types only need "What you did"', () => {
  assert.equal(computeStatus({ activity_type: 'work', long_description: 'Built a tool' }).key, 'missing')
  assert.equal(computeStatus({ activity_type: 'work', organization_description: 'Acme', long_description: 'Built a tool' }).key, 'complete')
  assert.equal(computeStatus({ activity_type: 'research', long_description: 'Studied X' }).key, 'complete')
  assert.equal(computeStatus({ activity_type: 'research', long_description: 'Studied X' }).label, '✓ Complete')
})

/* ── location ─────────────────────────────────────────────────────────────── */

test('location: split on the last comma and round-trip', () => {
  assert.deepEqual(parseLocation('Shamakhi, Azerbaijan'), { city: 'Shamakhi', country: 'Azerbaijan' })
  assert.deepEqual(parseLocation('Paris, Texas, USA'), { city: 'Paris, Texas', country: 'USA' })
  assert.deepEqual(parseLocation('Baku'), { city: 'Baku', country: null })
  assert.deepEqual(parseLocation('  '), { city: null, country: null })
  assert.equal(formatLocation({ city: 'Shamakhi', country: 'Azerbaijan' }), 'Shamakhi, Azerbaijan')
  assert.equal(formatLocation({ city: 'Baku', country: null }), 'Baku')
  assert.equal(formatLocation({}), '')
})

/* ── months ───────────────────────────────────────────────────────────────── */

test('months: month ↔ date conversion stores the 1st', () => {
  assert.equal(monthToDate('2026-06'), '2026-06-01')
  assert.equal(monthToDate('2026-13'), null)
  assert.equal(monthToDate(''), null)
  assert.equal(dateToMonth('2026-06-01'), '2026-06')
  assert.equal(dateToMonth('2026-06-30'), '2026-06')
  assert.equal(dateToMonth(null), '')
})

test('months: MM/YYYY input parsing and formatting', () => {
  assert.equal(formatMonthInput('2026-06'), '06/2026')
  assert.equal(formatMonthInput('bad'), '')
  assert.equal(parseMonthInput('06/2026'), '2026-06')
  assert.equal(parseMonthInput('6/2026'), '2026-06')
  assert.equal(parseMonthInput('13/2026'), '')
  assert.equal(parseMonthInput('06/26'), '')
})

/* ── hours helper ─────────────────────────────────────────────────────────── */

test('hours helper: total with thousands separator, ongoing vs ended', () => {
  assert.equal(hoursHelperText(20, 13, false), '≈ 260 hours in total')
  assert.equal(hoursHelperText(4, 40, true), '≈ 160 hours per year')
  assert.equal(hoursHelperText(2, 30, true), '≈ 60 hours per year')
  assert.equal(hoursHelperText(30, 52, true), '≈ 1,560 hours per year')
  assert.equal(hoursHelperText('', 30, true), '')
  assert.equal(hoursHelperText(0, 30, true), '')
})

/* ── meta line ────────────────────────────────────────────────────────────── */

test('meta: grades, hours, weeks and mode', () => {
  const meta = buildMeta({
    activity_type: 'volunteering', grade_levels: [10, 11], hours_per_week: 4,
    weeks_per_year: 40, participation_mode: 'online',
  })
  assert.equal(meta, 'Grades 10–11 · 4 h/wk · 40 wk/yr · Online')
})

test('meta: school-break season replaces grades, unpaid work is called out', () => {
  const meta = buildMeta({
    activity_type: 'work', timing: 'school_break', start_date: '2026-06-01',
    hours_per_week: 20, weeks_per_year: 13, is_paid: false,
  })
  assert.equal(meta, 'Summer 2026 · 20 h/wk · 13 wk/yr · Unpaid')
})

test('meta: no grades and no end date reads "Since MM/YYYY" and empty parts are skipped', () => {
  assert.equal(buildMeta({ activity_type: 'research', start_date: '2026-05-01', ongoing: true }), 'Since 05/2026')
  assert.equal(buildMeta({}), '')
  assert.equal(gradesLabel([11]), 'Grade 11')
  assert.equal(gradesLabel([9, 10, 11]), 'Grades 9–11')
  assert.equal(gradesLabel([9, 12]), 'Grades 9, 12')
  assert.equal(seasonLabel('2026-06'), 'Summer 2026')
})

/* ── draft ↔ row ──────────────────────────────────────────────────────────── */

test('draft/row: round-trip keeps dates, location and descriptions', () => {
  const row = {
    activity_type: 'work', organization_name: 'Teleport', position: 'Intern',
    grade_levels: [11], timing: 'school_break', hours_per_week: '20', weeks_per_year: '13',
    start_date: '2026-06-01', end_date: '2026-09-01', ongoing: false,
    city: 'Baku', country: 'Azerbaijan', participation_mode: 'in_person',
    is_paid: false, employment_type: 'part_time', long_description: 'Did things',
  }
  const draft = draftFromRow(row)
  assert.equal(draft.location, 'Baku, Azerbaijan')
  assert.equal(draft.start_month, '2026-06')
  const back = rowFromDraft(draft)
  assert.equal(back.start_date, '2026-06-01')
  assert.equal(back.end_date, '2026-09-01')
  assert.equal(back.city, 'Baku')
  assert.deepEqual(back.grade_levels, [11])
})

test('row: ongoing drops the end date, blank text becomes null', () => {
  const back = rowFromDraft({ ...emptyDraft('sports'), ongoing: true, start_month: '2025-01', end_month: '2025-06' })
  assert.equal(back.end_date, null)
  assert.equal(back.organization_description, null)
  assert.equal(back.hours_per_week, null)
})

/* ── validation ───────────────────────────────────────────────────────────── */

test('validation: create requires the six required fields', () => {
  const errors = validateActivity(emptyDraft('other'), 'create')
  assert.deepEqual(Object.keys(errors).sort(), [
    'grade_levels', 'hours_per_week', 'organization_name', 'position', 'start_month', 'weeks_per_year',
  ])
  assert.equal(requiredCompleted(emptyDraft('other')), 0)
})

test('validation: ranges, dates and email', () => {
  const base = {
    organization_name: 'CodeBridge', position: 'Founder', grade_levels: [11],
    hours_per_week: '4', weeks_per_year: '40', start_month: '2025-09',
    ongoing: false, end_month: '2025-06', supervisor_email: 'nope',
  }
  const errors = validateActivity(base, 'edit')
  assert.equal(errors.end_month, 'End date must be after the start date')
  assert.equal(errors.supervisor_email, 'Enter a valid email address')
  assert.equal(validateActivity({ ...base, end_month: '2026-06', supervisor_email: 'a@b.co' }, 'edit').end_month, undefined)
  assert.equal(validateActivity({ ...base, hours_per_week: '41' }).hours_per_week, 'Hours per week must be between 0.5 and 40')
  assert.equal(validateActivity({ ...base, hours_per_week: '0.25' }).hours_per_week, 'Hours per week must be between 0.5 and 40')
  assert.equal(validateActivity({ ...base, weeks_per_year: '53' }).weeks_per_year, 'Weeks per year must be between 1 and 52')
  assert.deepEqual(validateActivity({ ...base, end_month: '2026-06', supervisor_email: '' }), {})
})

test('validation: over-long text is rejected', () => {
  const long = 'x'.repeat(351)
  assert.equal(validateActivity({ long_description: long }).long_description, 'Keep it to 350 characters or fewer')
  assert.equal(validateActivity({ organization_description: 'y'.repeat(251) }).organization_description, 'Keep it to 250 characters or fewer')
})

/* ── chips ────────────────────────────────────────────────────────────────── */

test('chips: counts per category', () => {
  assert.deepEqual(categoryCounts([
    { activity_type: 'volunteering' }, { activity_type: 'volunteering' }, { activity_type: 'work' },
  ]), { volunteering: 2, work: 1 })
  assert.deepEqual(categoryCounts([]), {})
})
