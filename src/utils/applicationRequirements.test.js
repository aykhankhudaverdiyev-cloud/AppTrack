/**
 * Phase 3 checklist/rules tests — run: npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  generateRequirements,
  computeRequirementProgress,
  getProgramChoiceLimit,
  essayStatusToRequirementStatus,
  ROUNDS,
  PLATFORMS,
  DEGREE_LEVELS,
} from './applicationRequirements.js'

const keys = (ctx) => generateRequirements(ctx).map((r) => r.req_key)

test('every generated requirement is unique, labelled and starts not_started', () => {
  const rows = generateRequirements({
    degreeLevel: 'bachelor', platform: 'common_app', country: 'US', financialAid: true,
  })
  assert.ok(rows.length > 8)
  assert.equal(new Set(rows.map((r) => r.req_key)).size, rows.length)
  for (const row of rows) {
    assert.ok(row.label.length > 2)
    assert.equal(row.status, 'not_started')
    assert.equal(row.meta.generated, true)
    assert.equal(typeof row.sort_order, 'number')
  }
})

test('Common App bachelor (US, aid) generates the expected platform items', () => {
  const k = keys({ degreeLevel: 'bachelor', platform: 'common_app', country: 'US', financialAid: true })
  for (const expected of [
    'essay_common_app', 'activities_common_app', 'honors_common_app', 'supplements',
    'rec_teacher_1', 'rec_counselor', 'school_report', 'css_profile', 'fafsa', 'transcript',
  ]) {
    assert.ok(k.includes(expected), `missing ${expected}`)
  }
  assert.ok(!k.includes('ucas_personal_statement'))
  assert.ok(!k.includes('uc_piq'))
})

test('UCAS bachelor (UK) generates UCAS items, not Common App essays', () => {
  const k = keys({ degreeLevel: 'bachelor', platform: 'ucas', country: 'GB' })
  for (const expected of ['ucas_personal_statement', 'ucas_reference', 'predicted_grades', 'english_test']) {
    assert.ok(k.includes(expected), `missing ${expected}`)
  }
  assert.ok(!k.includes('essay_common_app'))
  assert.ok(!k.includes('rec_counselor'))
})

test('UC application keeps the test-optional note and its PIQ essays', () => {
  const rows = generateRequirements({ degreeLevel: 'bachelor', platform: 'uc_application', country: 'US' })
  assert.ok(keys({ degreeLevel: 'bachelor', platform: 'uc_application', country: 'US' }).includes('uc_piq'))
  const scores = rows.find((r) => r.req_key === 'test_scores')
  assert.equal(scores.meta.optional, true)
  assert.match(scores.meta.note, /test-free/i)
})

test('PhD adds research items, three recommendations and supervisor contact', () => {
  const k = keys({ degreeLevel: 'phd', platform: 'university_portal', country: 'US' })
  for (const expected of [
    'essay_sop', 'cv_resume', 'rec_1', 'rec_2', 'rec_3',
    'essay_research_statement', 'writing_sample', 'supervisor_contact',
  ]) {
    assert.ok(k.includes(expected), `missing ${expected}`)
  }
  assert.ok(!k.includes('activities_common_app'))
})

test('Master checklist differs from PhD', () => {
  const master = keys({ degreeLevel: 'master', platform: 'university_portal', country: 'GB' })
  assert.ok(master.includes('essay_sop'))
  assert.ok(!master.includes('essay_research_statement'))
  assert.ok(!master.includes('supervisor_contact'))
})

test('country rules: HK gets ranked programme choices and translations, AZ does not', () => {
  const hk = keys({ degreeLevel: 'bachelor', platform: 'university_portal', country: 'HK' })
  assert.ok(hk.includes('program_choices'))
  assert.ok(hk.includes('translated_transcript'))
  const az = keys({ degreeLevel: 'bachelor', platform: 'university_portal', country: 'AZ' })
  assert.ok(!az.includes('translated_transcript'))
  assert.ok(!az.includes('english_test'))
})

test('financial aid items only appear when aid is requested', () => {
  assert.ok(!keys({ degreeLevel: 'bachelor', platform: 'common_app', country: 'US' }).includes('css_profile'))
  assert.ok(keys({ degreeLevel: 'bachelor', platform: 'common_app', country: 'US', financialAid: true }).includes('css_profile'))
})

test('essay requirements carry an essayType so they can be linked to Essays', () => {
  const rows = generateRequirements({ degreeLevel: 'bachelor', platform: 'common_app', country: 'US' })
  assert.equal(rows.find((r) => r.req_key === 'essay_common_app').meta.essayType, 'common_app_personal')
  assert.equal(rows.find((r) => r.req_key === 'supplements').meta.essayType, 'supplement')
})

test('progress: empty = 0, half done = 50, waived does not penalise', () => {
  assert.equal(computeRequirementProgress([]), 0)
  assert.equal(computeRequirementProgress([{ status: 'done' }, { status: 'not_started' }]), 50)
  assert.equal(computeRequirementProgress([{ status: 'in_progress' }, { status: 'not_started' }]), 25)
  assert.equal(computeRequirementProgress([
    { status: 'done' }, { status: 'submitted' }, { status: 'waived' },
  ]), 100)
  assert.equal(computeRequirementProgress([{ status: 'not_started' }, { status: 'in_progress' }]), 25)
})

test('ranked programme limits: HKU 3, NTU (SG/TW) 5, others 10', () => {
  assert.equal(getProgramChoiceLimit('The University of Hong Kong').limit, 3)
  assert.equal(getProgramChoiceLimit('Nanyang Technological University').limit, 5)
  assert.equal(getProgramChoiceLimit('National Taiwan University').limit, 5)
  assert.equal(getProgramChoiceLimit('Massachusetts Institute of Technology').limit, 10)
})

test('essay status maps to a checklist status', () => {
  assert.equal(essayStatusToRequirementStatus('brainstorm'), 'not_started')
  assert.equal(essayStatusToRequirementStatus('counselor_review'), 'in_progress')
  assert.equal(essayStatusToRequirementStatus('final'), 'submitted')
  assert.equal(essayStatusToRequirementStatus('submitted'), 'submitted')
})

test('option lists match the DB CHECK constraints', () => {
  const degreeKeys = DEGREE_LEVELS.map((o) => o.key)
  assert.deepEqual(degreeKeys, [
    'bachelor', 'foundation', 'transfer', 'exchange', 'dual_degree', 'master', 'phd',
  ])
  assert.equal(PLATFORMS.length, 8)
  assert.equal(ROUNDS.find((r) => r.key === 'ed1').binding, true)
  assert.equal(ROUNDS.find((r) => r.key === 'rea_scea').binding, false)
  assert.equal(new Set(ROUNDS.map((r) => r.key)).size, ROUNDS.length)
})
