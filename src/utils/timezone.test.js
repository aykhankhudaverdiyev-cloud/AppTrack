/**
 * Timezone utility tests — run:  npm test
 * Acceptance criteria (Section 20):
 *   "Deadlines show correct local time for Asia/Baku when the source is
 *    Asia/Hong_Kong or America/New_York."
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  getTimeZoneOffsetMs,
  zonedTimeToUtc,
  getZonedParts,
  zoneOffsetLabel,
  countdownParts,
  formatCountdown,
  describeDeadline,
  suggestReminderTimes,
  getStudentTimeZone,
} from './timezone.js'

const BAKU = 'Asia/Baku'
const HK = 'Asia/Hong_Kong'
const NY = 'America/New_York'

test('HKU 12:00 Hong Kong = 08:00 same day in Baku', () => {
  const due = zonedTimeToUtc('2027-01-05', '12:00', HK)
  const p = getZonedParts(due, BAKU)
  assert.equal(p.day, 5)
  assert.equal(p.month, 1)
  assert.equal(p.hour, 8)
  assert.equal(p.minute, 0)
})

test('NTU 16:00 Taiwan = 12:00 same day in Baku', () => {
  const due = zonedTimeToUtc('2027-03-01', '16:00', 'Asia/Taipei')
  const p = getZonedParts(due, BAKU)
  assert.equal(p.day, 1)
  assert.equal(p.hour, 12)
  assert.equal(p.minute, 0)
})

test('US 23:59 New York (winter) = 08:59 NEXT day in Baku (+9h)', () => {
  const due = zonedTimeToUtc('2027-01-15', '23:59', NY)
  const local = getZonedParts(due, BAKU)
  assert.equal(local.day, 16)
  assert.equal(local.hour, 8)
  assert.equal(local.minute, 59)
})

test('US 23:59 New York (summer DST) = 07:59 NEXT day in Baku (+8h)', () => {
  const due = zonedTimeToUtc('2027-07-15', '23:59', NY)
  const local = getZonedParts(due, BAKU)
  assert.equal(local.day, 16)
  assert.equal(local.hour, 7)
  assert.equal(local.minute, 59)
})

test('round-trip: wall clock in original zone survives UTC conversion', () => {
  for (const tz of [HK, NY, BAKU, 'Europe/London', 'Asia/Tokyo']) {
    const due = zonedTimeToUtc('2027-06-10', '09:30', tz)
    const p = getZonedParts(due, tz)
    assert.equal(`${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`, '2027-06-10')
    assert.equal(p.hour, 9)
    assert.equal(p.minute, 30)
  }
})

test('Baku is UTC+4 (no DST)', () => {
  const winter = getTimeZoneOffsetMs(BAKU, new Date('2027-01-01T12:00:00Z'))
  const summer = getTimeZoneOffsetMs(BAKU, new Date('2027-07-01T12:00:00Z'))
  assert.equal(winter, 4 * 3600000)
  assert.equal(summer, 4 * 3600000)
  assert.equal(zoneOffsetLabel(BAKU, new Date()), 'GMT+4')
})

test('zone labels: HK GMT+8, NY winter GMT-5', () => {
  assert.equal(zoneOffsetLabel(HK, new Date('2027-01-05T04:00:00Z')), 'GMT+8')
  assert.equal(zoneOffsetLabel(NY, new Date('2027-01-15T04:59:00Z')), 'GMT-5')
})

test('countdown parts', () => {
  const now = new Date('2027-01-01T00:00:00Z')
  const target = new Date('2027-01-04T02:30:00Z')
  const c = countdownParts(target, now)
  assert.deepEqual(
    { d: c.days, h: c.hours, m: c.minutes, past: c.isPast },
    { d: 3, h: 2, m: 30, past: false }
  )
})

test('countdown text: past deadline', () => {
  const now = new Date('2027-01-05T00:00:00Z')
  assert.equal(formatCountdown(new Date('2027-01-04T00:00:00Z'), now), 'deadline passed')
})

test('describeDeadline flags US next-morning shift as urgent-ready data', () => {
  const due = zonedTimeToUtc('2027-01-15', '23:59', NY)
  const d = describeDeadline({ dueAt: due, originalTimeZone: NY }, BAKU, new Date('2027-01-01T00:00:00Z'))
  assert.equal(d.dayShift, 1)
  assert.equal(d.isPast, false)
  // original text shows NY wall time
  assert.match(d.originalText, /23:59/)
  // local text shows Baku time
  assert.match(d.localText, /08:59/)
})

test('suggestReminderTimes yields 30/14/7/3/1/0-day marks, skipping past ones', () => {
  const due = new Date('2027-06-20T12:00:00Z')
  const now = new Date('2027-06-12T00:00:00Z')
  const times = suggestReminderTimes(due, now)
  // 7, 3, 1, 0 days remain (30/14 are in the past)
  assert.equal(times.length, 4)
  assert.deepEqual(times[0], new Date('2027-06-13T12:00:00Z'))
})

test('getStudentTimeZone falls back sanely', () => {
  assert.equal(getStudentTimeZone('Asia/Tokyo'), 'Asia/Tokyo')
  const tz = getStudentTimeZone()
  assert.ok(typeof tz === 'string' && tz.length > 0)
})
