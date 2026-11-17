import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatDate, formatMonthInput, parseMonthInput, dateToMonth, monthToDate } from './dates.js'

test('formatDate month precision → "Jun 2025"', () => {
  assert.equal(formatDate('2025-06', 'month'), 'Jun 2025')
  assert.equal(formatDate('2025-12', 'month'), 'Dec 2025')
})

test('formatDate day precision → "11 Apr 2026"', () => {
  assert.equal(formatDate('2026-04-11', 'day'), '11 Apr 2026')
  assert.equal(formatDate('2026-01-05', 'day'), '5 Jan 2026')
})

test('formatDate never shows numeric dates', () => {
  assert.ok(!/\d{2}\/\d{4}/.test(formatDate('2025-06', 'month')))
  assert.ok(!/\d{1,2}\/\d{1,2}\/\d{4}/.test(formatDate('2026-04-11', 'day')))
})

test('formatDate falls back to the raw value when unparseable', () => {
  assert.equal(formatDate('', 'month'), '')
  assert.equal(formatDate('not-a-date', 'month'), 'not-a-date')
})

test('formatMonthInput for input placeholders', () => {
  assert.equal(formatMonthInput('2025-06'), '06/2025')
  assert.equal(formatMonthInput(''), '')
})

test('parseMonthInput round-trips MM/YYYY', () => {
  assert.equal(parseMonthInput('06/2025'), '2025-06')
  assert.equal(parseMonthInput('6/2025'), '2025-06')
  assert.equal(parseMonthInput('13/2025'), '')
  assert.equal(parseMonthInput(''), '')
})

test('dateToMonth / monthToDate conversions', () => {
  assert.equal(dateToMonth('2025-06-01'), '2025-06')
  assert.equal(dateToMonth('2025-06'), '2025-06')
  assert.equal(monthToDate('2025-06'), '2025-06-01')
  assert.equal(monthToDate('not-a-month'), null)
})
