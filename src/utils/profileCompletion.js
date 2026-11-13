/**
 * ============================================================================
 * profileCompletion.js — weighted, level-aware completion (spec §2)
 * ============================================================================
 * WHY: the old bar counted 7 profile fields and showed 86% while Education,
 * Test Scores and Honors were empty — misleading. Completion must reflect the
 * sections that actually matter for admissions, weighted differently per level:
 *
 *   Bachelor/Transfer/Exchange: Profile 20 · Education 25 · Tests 15 ·
 *                               Honors 10 · Activities 20 · Recommenders 10
 *   Master/PhD:                 Profile 15 · Education 25 · Tests 10 ·
 *                               Research/Publications 20 · Experience 15 ·
 *                               Recommenders 15
 *
 * Clicking the bar needs the list of missing items — computeProfileCompletion
 * returns a flat `missingItems` array with labels + dashboard tab keys.
 * ============================================================================
 */

const GRAD_LEVELS = new Set(['master', 'phd'])

/** Profile fields required from every student (fractional scoring). */
const CORE_PROFILE_FIELDS = [
  { key: 'givenName', label: 'Given name', tab: 'profile' },
  { key: 'familyName', label: 'Family name', tab: 'profile' },
  { key: 'passportName', label: 'Name exactly as in passport', tab: 'profile' },
  { key: 'gender', label: 'Gender', tab: 'profile' },
  { key: 'phone', label: 'Phone number', tab: 'profile' },
  { key: 'photoUrl', label: 'Profile photo', tab: 'profile' },
  { key: 'applyingLevel', label: 'Applying for (level)', tab: 'profile' },
  { key: 'startTerm', label: 'Intended start term', tab: 'profile' },
  { key: 'intendedMajor1', label: 'Intended major', tab: 'profile' },
]

/** Extra required fields for graduate applicants. */
const GRAD_PROFILE_FIELDS = [
  { key: 'gradCurrentDegree', label: 'Current degree', tab: 'profile' },
  { key: 'researchInterests', label: 'Research interests', tab: 'profile' },
]

function weightsFor(level) {
  if (GRAD_LEVELS.has(level)) {
    return {
      profile: 15,
      education: 25,
      tests: 10,
      research: 20,
      experience: 15,
      recommenders: 15,
    }
  }
  return {
    profile: 20,
    education: 25,
    tests: 15,
    honors: 10,
    activities: 20,
    recommenders: 10,
  }
}

/**
 * @param {object} summary
 *   level           string|null   profiles.applying_level
 *   profile         object        camelCase profile fields (see field lists)
 *   educationCount  number        education entries (DB in later phase; localStorage today)
 *   testsCount      number        test attempts
 *   honorsCount     number        honors entries (bachelor only)
 *   activitiesCount number        activities (bachelor "activities", grad "experience")
 *   researchCount   number        publications + research-type items (grad only)
 *   recommendersCount number      recommenders added
 * @returns {{percent:number, sections:Array, missingItems:Array}}
 */
export function computeProfileCompletion(summary) {
  const {
    level = null,
    profile = {},
    educationCount = 0,
    testsCount = 0,
    honorsCount = 0,
    activitiesCount = 0,
    researchCount = 0,
    recommendersCount = 0,
  } = summary

  const weights = weightsFor(level)
  const sections = []
  const missingItems = []

  // ---- Profile (fractional over required fields) ----
  const fields = [...CORE_PROFILE_FIELDS, ...(GRAD_LEVELS.has(level) ? GRAD_PROFILE_FIELDS : [])]
  const missingFields = fields.filter((f) => !profile[f.key])
  const profileFilledPct = Math.round(((fields.length - missingFields.length) / fields.length) * 100)
  sections.push({
    key: 'profile',
    label: 'Profile',
    weight: weights.profile,
    filled: profileFilledPct,
    earned: (weights.profile * profileFilledPct) / 100,
    missingCount: missingFields.length,
  })
  for (const f of missingFields) missingItems.push({ label: f.label, tab: f.tab })

  // ---- Education ----
  const educationOk = educationCount > 0
  sections.push(section('education', 'Education', weights.education, educationOk))
  if (!educationOk) missingItems.push({ label: 'Add at least one school or university', tab: 'education' })

  // ---- Tests ----
  const testsOk = testsCount > 0
  sections.push(section('tests', 'Test Scores', weights.tests, testsOk))
  if (!testsOk) missingItems.push({ label: 'Add a test score (SAT, IELTS, ...)', tab: 'test_scores' })

  // ---- Level-specific middle sections ----
  if (GRAD_LEVELS.has(level)) {
    const researchOk = researchCount > 0
    sections.push(section('research', 'Research & Publications', weights.research, researchOk))
    if (!researchOk) missingItems.push({ label: 'Add a publication or research output', tab: 'projects' })

    const experienceOk = activitiesCount > 0
    sections.push(section('experience', 'Work & Research Experience', weights.experience, experienceOk))
    if (!experienceOk) missingItems.push({ label: 'Add work or research experience', tab: 'activities' })
  } else {
    const honorsOk = honorsCount > 0
    sections.push(section('honors', 'Honors & Awards', weights.honors, honorsOk))
    if (!honorsOk) missingItems.push({ label: 'Add an honor or award', tab: 'honors' })

    const activitiesOk = activitiesCount > 0
    sections.push(section('activities', 'Activities & Experiences', weights.activities, activitiesOk))
    if (!activitiesOk) missingItems.push({ label: 'Add an activity or experience', tab: 'activities' })
  }

  // ---- Recommenders ----
  const recommendersOk = recommendersCount > 0
  sections.push(section('recommenders', 'Recommenders', weights.recommenders, recommendersOk))
  if (!recommendersOk) missingItems.push({ label: 'Add a recommender', tab: 'recommendations' })

  const totalWeight = sections.reduce((s, x) => s + x.weight, 0)
  const earned = sections.reduce((s, x) => s + x.earned, 0)
  const percent = Math.round((earned / totalWeight) * 100)

  return { percent, sections, missingItems }
}

function section(key, label, weight, ok) {
  return { key, label, weight, filled: ok ? 100 : 0, earned: ok ? weight : 0, missingCount: ok ? 0 : 1 }
}
