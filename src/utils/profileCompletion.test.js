/**
 * Acceptance criterion (spec §2/§20): "Profile completion is correct on an
 * empty profile" — must be 0, not 86%.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeProfileCompletion } from './profileCompletion.js'

const fullBachelorProfile = {
  givenName: 'Aykhan', familyName: 'K.', passportName: 'Aykhan K.',
  gender: 'male', phone: '+994501234567', photoUrl: 'x',
  applyingLevel: 'bachelor_first_year', startTerm: 'Fall 2027', intendedMajor1: 'CS',
}

test('empty profile → 0% (the old bug showed 86%)', () => {
  const r = computeProfileCompletion({ level: null, profile: {} })
  assert.equal(r.percent, 0)
  assert.ok(r.missingItems.length >= 12)
})

test('bachelor weights sum to 100', () => {
  const r = computeProfileCompletion({ level: 'bachelor_first_year', profile: fullBachelorProfile })
  const total = r.sections.reduce((s, x) => s + x.weight, 0)
  assert.equal(total, 100)
})

test('master weights sum to 100 and differ from bachelor', () => {
  const r = computeProfileCompletion({ level: 'master', profile: fullBachelorProfile })
  const total = r.sections.reduce((s, x) => s + x.weight, 0)
  assert.equal(total, 100)
  const research = r.sections.find((s) => s.key === 'research')
  assert.equal(research.weight, 20)
  const honors = r.sections.find((s) => s.key === 'honors')
  assert.equal(honors, undefined) // bachelor-only section
})

test('fully completed bachelor → 100%', () => {
  const r = computeProfileCompletion({
    level: 'bachelor_first_year',
    profile: fullBachelorProfile,
    educationCount: 1,
    testsCount: 2,
    honorsCount: 3,
    activitiesCount: 4,
    recommendersCount: 1,
  })
  assert.equal(r.percent, 100)
  assert.deepEqual(r.missingItems, [])
})

test('fully completed master (publications instead of honors) → 100%', () => {
  const r = computeProfileCompletion({
    level: 'phd',
    profile: { ...fullBachelorProfile, gradCurrentDegree: 'BSc', researchInterests: 'ML' },
    educationCount: 1,
    testsCount: 1,
    activitiesCount: 1,
    researchCount: 1,
    recommendersCount: 2,
  })
  assert.equal(r.percent, 100)
})

test('partial profile: only Profile section filled → its weight share', () => {
  const r = computeProfileCompletion({
    level: 'bachelor_first_year',
    profile: fullBachelorProfile,
  })
  // profile weight 20, all 9 fields present → 20%
  assert.equal(r.percent, 20)
  assert.equal(r.sections.find((s) => s.key === 'profile').filled, 100)
})

test('missing items carry dashboard tab keys for click-through', () => {
  const r = computeProfileCompletion({ level: 'bachelor_first_year', profile: {} })
  const tabs = new Set(r.missingItems.map((m) => m.tab))
  for (const t of ['profile', 'education', 'test_scores', 'honors', 'activities', 'recommendations']) {
    assert.ok(tabs.has(t), `missing tab ${t}`)
  }
})

test('grad missing fields include grad-only items', () => {
  const r = computeProfileCompletion({ level: 'master', profile: {} })
  const labels = r.missingItems.map((m) => m.label)
  assert.ok(labels.includes('Current degree'))
  assert.ok(labels.includes('Research interests'))
})
