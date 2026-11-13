/** Academic library rules; values match the Phase 0 database constraints. */

export const EDUCATION_TYPES = ['secondary_school', 'university', 'pre_college', 'foundation_year']
export const CREDENTIAL_EVALUATION_STATUSES = ['not_needed', 'in_progress', 'completed']
export const TEST_TYPES = ['SAT', 'ACT', 'PSAT', 'AP', 'IB', 'ALEVEL', 'IELTS', 'TOEFL', 'DUOLINGO', 'PTE', 'CAMBRIDGE_C1', 'CAMBRIDGE_C2', 'GRE', 'GMAT', 'NATIONAL_EXAM', 'OTHER']
export const TEST_STATUSES = ['planned', 'registered', 'taken_waiting', 'released']
export const SCORE_REQUIREMENTS = ['required', 'optional', 'test_blind']
export const HONOR_LEVELS = ['school', 'state_regional', 'national', 'international']
export const HONOR_CATEGORIES = ['academic_olympiad', 'research', 'competition_hackathon', 'scholarship', 'arts', 'sports', 'leadership', 'other']
export const HONOR_RESULTS = ['gold_first', 'silver_second', 'bronze_third', 'finalist', 'semifinalist', 'honourable_mention', 'other']
export const ACTIVITY_TIMINGS = ['school_year', 'school_break', 'all_year']
export const PARTICIPATION_MODES = ['online', 'in_person', 'hybrid']
export const EMPLOYMENT_TYPES = ['internship', 'part_time', 'full_time']
export const RESEARCH_OUTPUT_STATUSES = ['in_progress', 'under_review', 'submitted', 'accepted', 'published']
export const PROJECT_TYPES = ['software_app', 'hardware_engineering', 'research_paper', 'data_analysis', 'competition_project', 'creative_work', 'other']
// Projects have their own page now; these stay in sync with migration 007.
export const PROJECT_ROLES = ['solo', 'team_lead', 'team_member']
export const PROJECT_STATUSES = ['in_progress', 'live', 'paused']
export const PROJECT_VISIBILITIES = ['private', 'public']
export const PUBLICATION_TYPES = ['journal', 'conference', 'preprint', 'poster', 'thesis']
export const PUBLICATION_STATUSES = ['in_preparation', 'submitted', 'under_review', 'accepted', 'published']

export function isGraduateLevel(level) {
  return level === 'master' || level === 'phd'
}

/** Empty section scores are allowed; a supplied SAT score must meet the rule. */
export function isValidSatSectionScore(value) {
  if (value === '' || value == null) return true
  const score = Number(value)
  return Number.isInteger(score) && score >= 200 && score <= 800 && score % 10 === 0
}

/** Return a calendar date, clamping leap day to February 28 where necessary. */
export function scoreExpiryDate(type, date) {
  const years = ['IELTS', 'TOEFL', 'DUOLINGO', 'PTE'].includes(type) ? 2 :
    ['GRE', 'GMAT'].includes(type) ? 5 : 0
  if (!years || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return null
  const [year, month, day] = date.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null
  const targetYear = year + years
  const lastDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate()
  return `${String(targetYear).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}

/** Graduate experience counts work/research activities; research counts publications,
 * research-paper projects and research activities. Undergraduate activity counts
 * all unified activities. Recommenders remain in the existing Phase 5/6 list. */
export function computeAcademicCounts(library = {}, level = null) {
  const { education_entries = [], test_attempts = [], honors = [], activities = [], projects = [], publications = [] } = library
  const graduate = isGraduateLevel(level)
  return {
    educationCount: education_entries.length,
    testsCount: test_attempts.length,
    honorsCount: honors.length,
    activitiesCount: graduate ? activities.filter((a) => ['work_paid', 'internship', 'career_oriented', 'research'].includes(a.activity_type)).length : activities.length,
    researchCount: publications.length + projects.filter((p) => p.project_type === 'research_paper').length + activities.filter((a) => a.activity_type === 'research').length,
  }
}

/** Convert legacy items without discarding their original text. The old storage
 * remains untouched after import, so users retain a complete local backup. */
export function mapLegacyAcademicItem(kind, item) {
  const text = (value) => value == null ? '' : String(value).trim()
  const backup = `Imported details: ${JSON.stringify(item)}`
  switch (kind) {
    case 'education':
      return { entry_type: 'secondary_school', institution_name: text(item.school) || 'Imported school', degree: text(item.degree) || null, current_year_courses: [text(item.years), backup].filter(Boolean).join('\n') }
    case 'test_scores': {
      const name = text(item.test).toUpperCase()
      const score = text(item.score)
      const num = score && Number.isFinite(Number(score)) ? Number(score) : null
      const date = text(item.date)
      const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date
      const testType = TEST_TYPES.includes(name) ? name : 'OTHER'
      return { test_type: testType, status: num === null ? 'planned' : 'released', overall_score: num, test_date: validDate ? date : null, expires_on: validDate ? scoreExpiryDate(testType, date) : null, notes: backup }
    }
    case 'honors': {
      const year = text(item.year)
      return { title: (text(item.title) || 'Imported award').slice(0, 100), issuer: text(item.issuer) || null, received_year: /^\d{4}$/.test(year) ? Number(year) : null, description: backup }
    }
    case 'volunteering':
      return { activity_type: 'volunteering', position: text(item.role).slice(0, 50) || null, organization_name: text(item.organization).slice(0, 100) || null, long_description: backup }
    case 'experience':
      return { activity_type: 'work', position: text(item.role).slice(0, 50) || null, organization_name: text(item.company).slice(0, 100) || null, long_description: backup }
    case 'projects':
      return { title: text(item.name) || 'Imported project', short_description: [text(item.description), backup].filter(Boolean).join('\n'), link: text(item.url) || null }
    default:
      throw new Error(`Unknown legacy academic section: ${kind}`)
  }
}
