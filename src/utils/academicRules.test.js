import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isValidSatSectionScore, scoreExpiryDate, computeAcademicCounts, isGraduateLevel } from './academicRules.js'
import { computeProfileCompletion } from './profileCompletion.js'

test('SAT scores permit empty values or 200–800 in tens', () => {
  for (const score of ['', null, 200, '800', 450]) assert.equal(isValidSatSectionScore(score), true)
  for (const score of [199, 801, 205, 'abc', 250.5]) assert.equal(isValidSatSectionScore(score), false)
})
test('expiry uses calendar years and clamps leap day', () => {
  assert.equal(scoreExpiryDate('IELTS', '2024-02-29'), '2026-02-28')
  assert.equal(scoreExpiryDate('GRE', '2024-01-05'), '2029-01-05')
  assert.equal(scoreExpiryDate('SAT', '2024-01-05'), null)
  assert.equal(scoreExpiryDate('IELTS', '2023-02-29'), null)
})
test('academic counts are empty by default and graduate counts are level-aware', () => {
  assert.equal(computeProfileCompletion(computeAcademicCounts()).percent, 0)
  assert.equal(isGraduateLevel('phd'), true)
  const library = { activities: [{ activity_type: 'research' }, { activity_type: 'community_service' }], projects: [{ project_type: 'research_paper' }, { project_type: 'software_app' }], publications: [{}] }
  assert.equal(computeAcademicCounts(library, 'bachelor').activitiesCount, 2)
  assert.equal(computeAcademicCounts(library, 'master').activitiesCount, 1)
  assert.equal(computeAcademicCounts(library, 'master').researchCount, 3)
})

test('legacy mappings preserve source details and respect schema limits', async () => {
  const { mapLegacyAcademicItem } = await import('./academicRules.js')
  const education = mapLegacyAcademicItem('education', { school: 'School', years: '2020–24', degree: 'Diploma' })
  assert.match(education.current_year_courses, /2020–24/)
  const score = mapLegacyAcademicItem('test_scores', { test: 'IELTS', score: '7.5', date: '2024-02-29' })
  assert.equal(score.overall_score, 7.5)
  assert.equal(score.expires_on, '2026-02-28')
  const unknown = mapLegacyAcademicItem('test_scores', { test: 'Custom exam', score: 'A+', date: 'not a date' })
  assert.equal(unknown.test_type, 'OTHER')
  assert.equal(unknown.overall_score, null)
  assert.match(unknown.notes, /A\+/)
  const honor = mapLegacyAcademicItem('honors', { title: 'X'.repeat(110), year: '2024' })
  assert.equal(honor.title.length, 100)
  assert.match(honor.description, /X{110}/)
  const work = mapLegacyAcademicItem('experience', { role: 'R'.repeat(60), company: 'Example', period: 'Summer 2023' })
  assert.equal(work.position.length, 50)
  assert.match(work.long_description, /Summer 2023/)
  // Legacy items must land in the nine fixed categories (migration 006).
  assert.equal(work.activity_type, 'work')
  assert.equal(mapLegacyAcademicItem('volunteering', { organization: 'X' }).activity_type, 'volunteering')
  assert.throws(() => mapLegacyAcademicItem('other', {}))
})
