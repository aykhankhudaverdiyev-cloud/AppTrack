import { test } from 'node:test'
import assert from 'node:assert/strict'
import { testEmoji, testTint } from '../constants/tests.js'
import {
  testSortKey, testDateLabel, testMeta, testScoreText, suggestOverall,
  roundToHalf, defaultExpiry, applyPreset, draftFromRow, rowFromDraft,
  validateTestAttempt, requiredCompleted, mapDbError, testGroupCounts,
  toNumberOrNull,
} from './tests.js'

test('testSortKey: released first (date desc), planned last (date asc)', () => {
  const releasedJan = { test_type: 'SAT', status: 'released', test_date: '2026-01-10' }
  const releasedFeb = { test_type: 'SAT', status: 'released', test_date: '2026-02-10' }
  const waiting = { test_type: 'IELTS', status: 'taken_waiting', test_date: '2026-03-10' }
  const plannedDec = { test_type: 'SAT', status: 'planned', test_date: '2026-12-10' }
  const plannedJan = { test_type: 'SAT', status: 'planned', test_date: '2026-01-10' }
  const order = [releasedJan, releasedFeb, waiting, plannedDec, plannedJan].sort((a, b) => testSortKey(a).localeCompare(testSortKey(b)))
  assert.deepEqual(order.map((t) => t.test_date), ['2026-02-10', '2026-01-10', '2026-03-10', '2026-01-10', '2026-12-10'])
})

test('testDateLabel → "11 Apr 2026"', () => {
  assert.equal(testDateLabel({ test_date: '2026-04-11' }), '11 Apr 2026')
  assert.equal(testDateLabel({}), '')
})

test('testMeta: Attempt n / Expires for English tests', () => {
  assert.equal(testMeta({ test_type: 'SAT', test_date: '2026-04-11', attempt_number: 1 }), '11 Apr 2026 · Attempt 1')
  assert.equal(testMeta({ test_type: 'IELTS', test_date: '2026-04-11', expires_on: '2028-04-11' }), '11 Apr 2026 · Expires 11 Apr 2028')
})

test('testScoreText: SAT overall vs AP joined scores', () => {
  assert.deepEqual(testScoreText({ overall_score: '1560', overall_max: '1600' }), { big: '1560', grey: '/ 1600' })
  assert.deepEqual(testScoreText({ test_type: 'AP', sections: [{ score: '5' }, { score: '5' }] }), { big: '5 · 5', grey: '2 exams' })
})

test('roundToHalf IELTS rule', () => {
  assert.equal(roundToHalf(7.25), 7.5)
  assert.equal(roundToHalf(7.75), 8)
  assert.equal(roundToHalf(7.4), 7.5)
})

test('suggestOverall: IELTS average to half, SAT sum, AP null', () => {
  assert.equal(suggestOverall('IELTS', [{ score: '7.5' }, { score: '8.5' }, { score: '6.5' }, { score: '7' }]), 7.5)
  assert.equal(suggestOverall('SAT', [{ score: '800' }, { score: '800' }]), 1600)
  assert.equal(suggestOverall('AP', []), null)
  assert.equal(suggestOverall('SAT', []), null)
})

test('defaultExpiry: English tests +2 years, others null', () => {
  assert.equal(defaultExpiry('IELTS', '2026-04-11'), '2028-04-11')
  assert.equal(defaultExpiry('IELTS', '2024-02-29'), '2026-02-28')
  assert.equal(defaultExpiry('SAT', '2026-04-11'), null)
  assert.equal(defaultExpiry('IELTS', ''), null)
})

test('applyPreset: IELTS pre-fills 4 sections, never overwrites entered ones', () => {
  const fresh = applyPreset('IELTS', [])
  assert.equal(fresh.length, 4)
  assert.equal(fresh[0].section, 'Listening')
  assert.equal(fresh[0].score_max, '9')
  const entered = [{ id: 'x', section: 'Listening', score: '8', score_max: '9', sort_order: 0 }]
  assert.deepEqual(applyPreset('IELTS', entered), entered)
})

test('draftFromRow / rowFromDraft round-trip dates', () => {
  const draft = draftFromRow({ test_type: 'IELTS', test_date: '2026-04-11', overall_score: 7.5, sections: [] })
  assert.equal(draft.test_date, '2026-04-11')
  assert.equal(draft.overall_score, '7.5')
  const row = rowFromDraft({ test_type: 'IELTS', test_date: '2026-04-11', attempt_number: '2' })
  assert.equal(row.test_date, '2026-04-11')
  assert.equal(row.attempt_number, 2)
})

test('validateTestAttempt create mode requires type + status', () => {
  const errors = validateTestAttempt({}, 'create', { touched: { test_type: true, status: true } })
  assert.equal(errors.test_type, 'Pick a test type')
  assert.equal(errors.status, 'Pick a status')
})

test('validateTestAttempt edit mode silent until touched', () => {
  assert.deepEqual(validateTestAttempt({}, 'edit'), {})
  assert.equal(validateTestAttempt({}, 'edit', { touched: { test_type: true } }).test_type, 'Pick a test type')
})

test('validateTestAttempt: exam name required for National/Other', () => {
  const errors = validateTestAttempt({ test_type: 'NATIONAL_EXAM', status: 'released' }, 'create', { touched: { test_type: true, status: true, national_exam_name: true } })
  assert.equal(errors.national_exam_name, 'Exam name is required')
})

test('validateTestAttempt: expiry after test date', () => {
  const errors = validateTestAttempt({ test_type: 'IELTS', status: 'released', test_date: '2026-04-11', expires_on: '2026-04-10' }, 'edit', { touched: { expires_on: true } })
  assert.equal(errors.expires_on, 'Expires on must be after the test date')
})

test('requiredCompleted and mapDbError', () => {
  assert.equal(requiredCompleted({ test_type: 'SAT', status: 'released' }), 2)
  assert.equal(mapDbError({ message: 'ATTEMPT_OWNER_MISMATCH' }).message, 'This file could not be linked. Please choose it again.')
})

test('testEmoji / testTint and group counts', () => {
  assert.equal(testEmoji('IELTS'), '🗣️')
  assert.equal(testEmoji('AP'), '📚')
  assert.equal(testEmoji('SAT'), '📝')
  assert.equal(testTint('OTHER'), 'slate')
  const counts = testGroupCounts([{ test_type: 'SAT' }, { test_type: 'IELTS' }, { test_type: 'OTHER' }])
  assert.deepEqual(counts, { admission: 1, english: 1, other: 1 })
})

test('toNumberOrNull: empty and invalid → null', () => {
  assert.equal(toNumberOrNull(''), null)
  assert.equal(toNumberOrNull(null), null)
  assert.equal(toNumberOrNull(undefined), null)
  assert.equal(toNumberOrNull('abc'), null)
  assert.equal(toNumberOrNull(' '), null)
})

test('toNumberOrNull: valid numbers', () => {
  assert.equal(toNumberOrNull('800'), 800)
  assert.equal(toNumberOrNull('7.5'), 7.5)
  assert.equal(toNumberOrNull(1560), 1560)
  assert.equal(toNumberOrNull('0'), 0)
})

test('mapDbError: DOCUMENT_OWNER_MISMATCH → friendly message', () => {
  assert.equal(
    mapDbError({ message: 'DOCUMENT_OWNER_MISMATCH' }).message,
    'This file could not be linked. Please choose it again.'
  )
})

test('mapDbError: ATTEMPT_OWNER_MISMATCH → friendly message', () => {
  assert.equal(
    mapDbError({ message: 'ATTEMPT_OWNER_MISMATCH' }).message,
    'This file could not be linked. Please choose it again.'
  )
})

test('mapDbError: check constraint → field error', () => {
  assert.equal(mapDbError({ message: 'violates check constraint \"test_attempts_score_check\"' }).field, 'overall_score')
  assert.equal(mapDbError({ message: 'violates check constraint \"test_attempts_expiry_check\"' }).field, 'expires_on')
})
