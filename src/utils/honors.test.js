import { test } from 'node:test'
import assert from 'node:assert/strict'
import { highestLevel, honorCategoryLabel, honorResult, honorEmoji } from '../constants/honors.js'
import {
  computeHonorStatus, buildHonorMeta, gradesLabel, receivedDateLabel,
  draftFromRow, rowFromDraft, validateHonor,
  requiredCompleted, mapDbError,
} from './honors.js'

test('computeHonorStatus: empty expected → Draft', () => {
  assert.deepEqual(computeHonorStatus({}), { key: 'draft', label: 'Draft', missing: null, filled: 0, total: 4 })
})

test('computeHonorStatus: partial → Missing: <first label>', () => {
  const status = computeHonorStatus({ description: 'Trained hard.' })
  assert.equal(status.key, 'missing')
  assert.equal(status.label, 'Missing: Date')
})

test('computeHonorStatus: all expected → Complete', () => {
  const row = { received_month: 6, received_year: 2025, result: 'silver_second', issuer: 'Ministry', description: 'Won silver.' }
  assert.deepEqual(computeHonorStatus(row), { key: 'complete', label: '✓ Complete', missing: null, filled: 4, total: 4 })
})

test('computeHonorStatus: selectivity/subject/certificate never trigger Missing', () => {
  const row = { received_month: 6, received_year: 2025, result: 'gold_first', issuer: 'X', description: 'D', subject: 'Math' }
  assert.equal(computeHonorStatus(row).key, 'complete')
})

test('buildHonorMeta skips empty parts', () => {
  assert.equal(buildHonorMeta({ grade_levels: [9], levels: ['national'], received_month: 6, received_year: 2025 }), 'Grade 9 · National · Jun 2025')
  assert.equal(buildHonorMeta({ grade_levels: [9, 10], levels: ['national'] }), 'Grades 9, 10 · National')
  assert.equal(buildHonorMeta({}), '')
})

test('receivedDateLabel', () => {
  assert.equal(receivedDateLabel({ received_month: 6, received_year: 2025 }), 'Jun 2025')
  assert.equal(receivedDateLabel({}), '')
})

test('highestLevel picks the top level', () => {
  assert.equal(highestLevel(['city', 'national', 'school']), 'national')
  assert.equal(highestLevel([]), null)
})

test('honorEmoji: result first, then category', () => {
  assert.equal(honorEmoji({ result: 'gold_first' }), '🥇')
  assert.equal(honorEmoji({ result: 'finalist', category: 'research' }), '🏁')
  assert.equal(honorEmoji({ category: 'academic_olympiad' }), '🧠')
  assert.equal(honorEmoji({ category: 'unknown' }), '⭐')
})

test('rowFromDraft splits YYYY-MM into month/year columns', () => {
  const row = rowFromDraft({ title: 'X', category: 'academic_olympiad', grade_levels: [9], levels: ['national'], received_month: '2025-06', description: 'D' })
  assert.equal(row.received_month, 6)
  assert.equal(row.received_year, 2025)
})

test('draftFromRow rebuilds YYYY-MM', () => {
  const draft = draftFromRow({ received_month: 6, received_year: 2025, grade_levels: [10, 9], levels: ['national'] })
  assert.equal(draft.received_month, '2025-06')
  assert.deepEqual(draft.grade_levels, [9, 10])
})

test('validateHonor create mode requires title/category/levels/grades', () => {
  const errors = validateHonor({}, 'create', { touched: { title: true, category: true, grade_levels: true, levels: true } })
  assert.equal(errors.title, 'Honor title is required')
  assert.equal(errors.category, 'Pick a category')
  assert.equal(errors.grade_levels, 'Pick at least one grade level')
  assert.equal(errors.levels, 'Pick at least one level of recognition')
})

test('validateHonor edit mode is silent on an untouched draft', () => {
  assert.deepEqual(validateHonor({}, 'edit'), {})
  assert.deepEqual(validateHonor({}, 'edit', { touched: { title: true } }), { title: 'Honor title is required' })
})

test('validateHonor length limits and URL', () => {
  const errors = validateHonor({ title: 'X'.repeat(101), verification_url: 'ftp://x' }, 'create', { touched: { title: true, verification_url: true } })
  assert.equal(errors.title, 'Keep it to 100 characters or fewer')
  assert.equal(errors.verification_url, 'Link must start with http:// or https://')
})

test('requiredCompleted counts the four create fields', () => {
  assert.equal(requiredCompleted({}), 0)
  assert.equal(requiredCompleted({ title: 'T', category: 'c', grade_levels: [9], levels: ['national'] }), 4)
})

test('mapDbError friendly messages', () => {
  assert.equal(mapDbError({ message: 'violates check constraint "honors_title_check"' }).field, 'title')
  assert.equal(mapDbError({ message: 'new row for relation "honors" violates check constraint "honors_top5_limit" TOP5_LIMIT' }).message, 'You can include up to 5 honors. Turn one off first.')
  assert.equal(mapDbError({ message: 'DOCUMENT_OWNER_MISMATCH' }).message, 'This file could not be linked. Please choose it again.')
})
