import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  cellGrade, currentGrade, dateValue, draftFromEntry, emptyEntryDraft, entryChips,
  entryMeta, entryPayload, entryTitle, filterCounts, filterEntries, formatAverage,
  gradeRowsFromSubjects, gradeSubjectsFromRows, gradingMaximum, inFilter, monthIso,
  monthValue, parseMonthText, patchFor, savedLabel, validateEducation,
} from './education.js'

const NOW = new Date('2026-11-23T10:00:00Z')

const SCHOOL = {
  entry_type: 'secondary_school',
  institution_name: 'Republican Physics, Mathematics and Informatics Lyceum',
  country: 'Azerbaijan',
  city: 'Baku',
  start_date: '2023-09-01',
  end_date: '2027-06-01',
  is_current: true,
  qualification: 'National diploma (Attestat)',
  grading_scale: '1–5',
  overall_average: 5,
  class_size: 33,
}

test('parseMonthText accepts the ways students actually type a month', () => {
  assert.equal(parseMonthText('09/2023'), '2023-09')
  assert.equal(parseMonthText('9/2023'), '2023-09')
  assert.equal(parseMonthText('Sep 2023'), '2023-09')
  assert.equal(parseMonthText('september 2023'), '2023-09')
  assert.equal(parseMonthText('2023-09'), '2023-09')
  assert.equal(parseMonthText('13/2023'), '')
  assert.equal(parseMonthText('School'), '')
  assert.equal(parseMonthText(''), '')
})

test('monthIso/mdateValue round-trip a month to the first day', () => {
  assert.equal(monthIso(2023, 9), '2023-09')
  assert.equal(dateValue('2023-09'), '2023-09-01')
  assert.equal(dateValue(''), null)
  assert.equal(monthValue('2023-09-14'), '2023-09')
})

test('currentGrade counts back from the expected graduation (grade 11 in 2026-27)', () => {
  assert.equal(currentGrade(SCHOOL, NOW), 11)
  assert.equal(currentGrade(SCHOOL, new Date('2024-10-01')), 9)
  assert.equal(currentGrade(SCHOOL, new Date('2025-10-01')), 10)
  assert.equal(currentGrade(SCHOOL, new Date('2028-10-01')), null) // already finished
  assert.equal(currentGrade({ ...SCHOOL, is_current: false }, NOW), null)
})

test('entryMeta: "Sep 2023 – Jun 2027 · Grade 11", and no grade when not attending', () => {
  assert.equal(entryMeta(SCHOOL, NOW), 'Sep 2023 – Jun 2027 · Grade 11')
  assert.equal(entryMeta({ ...SCHOOL, is_current: false }, NOW), 'Sep 2023 – Jun 2027')
  assert.equal(entryMeta({ start_date: '2023-09-01' }), 'Sep 2023')
  assert.equal(entryMeta({}), '')
})

test('entryChips: average with its maximum, then class size', () => {
  assert.deepEqual(entryChips(SCHOOL), ['Average 5.00 / 5', 'Class of 33'])
  assert.deepEqual(entryChips({ overall_average: 4.5, grading_scale: '4.0 GPA' }), ['Average 4.50 / 4'])
  assert.deepEqual(entryChips({}), [])
})

test('formatAverage keeps two decimals and ignores empty values', () => {
  assert.equal(formatAverage(5), '5.00')
  assert.equal(formatAverage('4.5'), '4.50')
  assert.equal(formatAverage(''), '')
  assert.equal(formatAverage(null), '')
  assert.equal(formatAverage('abc'), '')
})

test('gradingMaximum maps the scale to the suffix inside Overall average', () => {
  assert.equal(gradingMaximum('1–5'), 5)
  assert.equal(gradingMaximum('0–100'), 100)
  assert.equal(gradingMaximum('4.0 GPA'), 4)
  assert.equal(gradingMaximum('Other'), null)
  assert.equal(gradingMaximum(''), null)
})

test('filters: always four chips, Program groups pre-college + foundation year', () => {
  const entries = [SCHOOL, { entry_type: 'university' }, { entry_type: 'pre_college' }]
  assert.deepEqual(filterCounts(entries).map((chip) => [chip.key, chip.count]), [
    ['all', 3], ['secondary_school', 1], ['university', 1], ['programs', 1],
  ])
  assert.deepEqual(filterCounts([SCHOOL]).map((chip) => chip.count), [1, 1, 0, 0])
  assert.equal(filterEntries(entries, 'programs').length, 1)
  assert.equal(inFilter({ entry_type: 'foundation_year' }, 'programs'), true)
  assert.equal(inFilter(SCHOOL, 'all'), true)
  assert.equal(filterEntries(entries, 'university')[0].entry_type, 'university')
})

test('entryTitle falls back to a readable placeholder', () => {
  assert.equal(entryTitle(SCHOOL), SCHOOL.institution_name)
  assert.equal(entryTitle({}), 'New education entry')
})

test('draftFromEntry: dates become months, the average keeps two decimals', () => {
  const draft = draftFromEntry(SCHOOL)
  assert.equal(draft.start_date, '2023-09')
  assert.equal(draft.end_date, '2027-06')
  assert.equal(draft.overall_average, '5.00')
  assert.equal(draft.scale_maximum, 5)
  assert.equal(draft.city, 'Baku')
  assert.equal(emptyEntryDraft().institution_name, '')
  assert.equal(emptyEntryDraft('secondary_school').grading_scale, '1–5')
})

test('entryPayload: months → first day, blanks → null, secondary-only fields cleared', () => {
  const payload = entryPayload({ ...draftFromEntry(SCHOOL), ceeb_code: '  ', class_rank: '' })
  assert.equal(payload.start_date, '2023-09-01')
  assert.equal(payload.end_date, '2027-06-01')
  assert.equal(payload.overall_average, 5)
  assert.equal(payload.scale_maximum, 5)
  assert.equal(payload.ceeb_code, null)
  assert.equal(payload.class_rank, null)
  assert.equal(payload.qualification, 'National diploma (Attestat)')

  const university = entryPayload({ ...emptyEntryDraft('university'), institution_name: 'Some University', degree: 'BSc' })
  assert.equal(university.qualification, null)
  assert.equal(university.grading_scale, null)
  assert.equal(university.degree, 'BSc')

  const nameless = entryPayload({ ...emptyEntryDraft() })
  assert.equal(nameless.institution_name, 'Untitled institution')
  assert.equal(nameless.start_date, null)
})

test('school_does_not_rank always clears the rank', () => {
  const payload = entryPayload({ ...draftFromEntry(SCHOOL), class_rank: '3', school_does_not_rank: true })
  assert.equal(payload.class_rank, null)
  assert.equal(payload.school_does_not_rank, true)
})

test('patchFor sends only the edited fields', () => {
  const payload = entryPayload(SCHOOL)
  assert.deepEqual(Object.keys(patchFor(payload, ['city', 'grading_scale', 'nope'])).sort(), ['city', 'grading_scale'])
})

test('validateEducation: required fields, date order and rank bounds', () => {
  const errors = validateEducation(emptyEntryDraft())
  // A new secondary-school entry already defaults to the "1–5" scale.
  assert.deepEqual(Object.keys(errors).sort(), ['country', 'end_date', 'institution_name', 'qualification', 'start_date'])
  assert.equal(validateEducation({ ...emptyEntryDraft(), grading_scale: '' }).grading_scale, 'Choose the grading scale')

  assert.deepEqual(validateEducation(draftFromEntry(SCHOOL)), {})
  assert.equal(validateEducation({ ...draftFromEntry(SCHOOL), start_date: '2027-09' }).end_date,
    'Expected graduation is before the start date')
  assert.equal(validateEducation({ ...draftFromEntry(SCHOOL), class_rank: '40', school_does_not_rank: false }).class_rank,
    'Class rank is larger than the class size')
  assert.equal(validateEducation({ ...draftFromEntry(SCHOOL), class_rank: '40', school_does_not_rank: true }).class_rank, undefined)
  // University entries do not ask for a qualification or a grading scale.
  assert.deepEqual(validateEducation({
    ...emptyEntryDraft('university'), institution_name: 'U', country: 'Azerbaijan', start_date: '2020-09', end_date: '2024-06',
  }), {})
})

test('grade table ⇄ grade_rows: cells, empty cells and hidden rows', () => {
  const rows = [
    { id: 'a', subject: 'Mathematics', grade_level: 9, semester: 1, grade: '5', sort_order: 0 },
    { id: 'b', subject: 'Mathematics', grade_level: 10, semester: 1, grade: '5', sort_order: 1 },
    { id: 'c', subject: 'Physics', grade_level: 11, semester: 2, grade: '4', sort_order: 2 },
  ]
  const subjects = gradeSubjectsFromRows(rows)
  assert.deepEqual(subjects.map((subject) => subject.name), ['Mathematics', 'Physics'])
  assert.equal(cellGrade(subjects[0], 9), '5')
  assert.equal(cellGrade(subjects[0], 11), '')
  assert.equal(cellGrade(subjects[1], 11, 2), '4')

  subjects[0].cells['11:1'] = { grade: '5' }
  subjects[0].cells['10:1'].grade = ''
  const saved = gradeRowsFromSubjects(subjects)
  assert.deepEqual(saved.map((row) => [row.subject, row.grade_level, row.semester, row.grade, Boolean(row.id)]), [
    ['Mathematics', 9, 1, '5', true],
    ['Mathematics', 11, 1, '5', false],
    ['Physics', 11, 2, '4', true],
  ])
  assert.deepEqual(gradeRowsFromSubjects([{ name: '  ', cells: { '9:1': { grade: '5' } } }]), [])
})

test('gradeRowsFromSubjects keeps the semester-2 rows the table does not show', () => {
  const rows = [{ id: 'x', subject: 'English', grade_level: 9, semester: 2, grade: '5', sort_order: 0 }]
  const saved = gradeRowsFromSubjects(gradeSubjectsFromRows(rows))
  assert.deepEqual(saved.map((row) => [row.grade_level, row.semester, row.grade]), [[9, 2, '5']])
})

test('savedLabel: just now / seconds / minutes / hours', () => {
  const now = new Date('2026-11-23T10:00:00Z').getTime()
  assert.equal(savedLabel(null, now), '')
  assert.equal(savedLabel(new Date(now - 1000), now), 'Saved just now')
  assert.equal(savedLabel(new Date(now - 12000), now), 'Saved 12 s ago')
  assert.equal(savedLabel(new Date(now - 180000), now), 'Saved 3 min ago')
  assert.equal(savedLabel(new Date(now - 7200000), now), 'Saved 2 h ago')
})
