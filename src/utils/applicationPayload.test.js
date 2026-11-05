/**
 * Phase 3 form → applications payload tests — run: npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultApplicationForm, applicationFormToPayload, APPLICATION_OPTION_KEYS } from './applicationPayload.js'
import { zonedTimeToUtc } from './timezone.js'

test('empty form keeps every LEGACY column with its historical default', () => {
  const p = applicationFormToPayload(defaultApplicationForm(), null)
  assert.equal(p.id, undefined)
  for (const key of ['university', 'program', 'major', 'term', 'deadline', 'status',
    'decision', 'recommendation', 'notes', 'visibility']) {
    assert.ok(key in p, `missing legacy key ${key}`)
  }
  assert.equal(p.status, 'Not Started')
  assert.equal(p.decision, 'Pending')
  assert.equal(p.recommendation, 'Pending')
  assert.equal(p.visibility, 'private')
  assert.equal(p.deadline, null)
  // never a password field
  assert.ok(!Object.keys(p).some((k) => /password/i.test(k)))
})

test('term is derived from season + year, but manual legacy text still works', () => {
  const f = { ...defaultApplicationForm(), termSeason: 'Fall', termYear: 2027 }
  assert.equal(applicationFormToPayload(f, 'a1').term, 'Fall 2027')
  const legacy = { ...defaultApplicationForm(), term: 'Michaelmas 2026' }
  assert.equal(applicationFormToPayload(legacy, 'a1').term, 'Michaelmas 2026')
  const both = { ...f, term: 'Manual override' }
  assert.equal(applicationFormToPayload(both, 'a1').term, 'Fall 2027')
})

test('numeric / text / bool fields are DB-safe (no undefined, NaN or "")', () => {
  const f = {
    ...defaultApplicationForm(),
    feeAmount: '', acceptanceRate: 'not-a-number', aidAmount: 12500.5,
    fitReason: '', notes: 'hello', isBinding: true, portalActivated: false,
  }
  const p = applicationFormToPayload(f, 'a1')
  assert.equal(p.feeAmount, null)
  assert.equal(p.acceptanceRate, null)
  assert.equal(p.aidAmount, 12500.5)
  assert.equal(p.fitReason, null)
  assert.equal(p.notes, 'hello')
  assert.equal(p.isBinding, true)
  assert.equal(p.portalActivated, false)
  for (const [k, v] of Object.entries(p)) {
    assert.ok(v !== undefined, `${k} is undefined`)
    assert.ok(!(typeof v === 'number' && Number.isNaN(v)), `${k} is NaN`)
  }
})

test('UI-only state never reaches the database', () => {
  const f = { ...defaultApplicationForm(), country: 'HK', progressPercent: 80,
    documents: { transcript: [] }, student_id: 'x', updatedAt: 'yesterday' }
  const p = applicationFormToPayload(f, 'a1')
  for (const key of ['country', 'progressPercent', 'documents', 'student_id', 'updatedAt']) {
    assert.ok(!(key in p), `${key} leaked into the payload`)
  }
})

test('reply deadline is converted from the ORIGINAL zone to an exact UTC instant', () => {
  const f = {
    ...defaultApplicationForm(),
    replyDeadlineDate: '2027-01-15', replyDeadlineTime: '23:59',
    replyDeadlineTz: 'America/New_York',
  }
  const p = applicationFormToPayload(f, 'a1')
  assert.equal(p.replyDeadlineAt, zonedTimeToUtc('2027-01-15', '23:59', 'America/New_York').toISOString())
  assert.equal(p.replyDeadlineTz, 'America/New_York')
  const empty = applicationFormToPayload(defaultApplicationForm(), 'a1')
  assert.equal(empty.replyDeadlineAt, null)
  assert.equal(empty.replyDeadlineTz, null)
})

test('decision / committed dates are stored as midday UTC instants (no day shift)', () => {
  const f = { ...defaultApplicationForm(), decisionAtDate: '2027-03-01', committedAtDate: '2027-05-01' }
  const p = applicationFormToPayload(f, 'a1')
  assert.equal(p.decisionAt, '2027-03-01T12:00:00.000Z')
  assert.equal(p.committedAt, '2027-05-01T12:00:00.000Z')
})

test('option lists cover every value the DB CHECK constraints allow', () => {
  assert.deepEqual(APPLICATION_OPTION_KEYS.degreeLevels, [
    'bachelor', 'foundation', 'transfer', 'exchange', 'dual_degree', 'master', 'phd',
  ])
  assert.deepEqual(APPLICATION_OPTION_KEYS.termSeasons, ['Fall', 'Spring', 'Winter', 'Summer'])
  assert.ok(APPLICATION_OPTION_KEYS.rounds.includes('uk_jan_equal'))
  assert.ok(APPLICATION_OPTION_KEYS.requirementStatuses.includes('waived'))
  assert.ok(APPLICATION_OPTION_KEYS.deadlineKinds.includes('reply_deposit'))
  assert.ok(APPLICATION_OPTION_KEYS.aidPolicies.includes('need_blind'))
})
