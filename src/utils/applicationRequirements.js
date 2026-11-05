/**
 * ============================================================================
 * applicationRequirements.js — Phase 3 (spec §11)
 * ----------------------------------------------------------------------------
 * Pure, dependency-free rules for Applications:
 *   • option lists that mirror the DB CHECK constraints (never send an invalid
 *     value to Postgres);
 *   • ranked-program limits (HKU 3, NTU 5 — app-enforced);
 *   • the checklist GENERATOR: level + platform + country → stable req_keys,
 *     editable afterwards by the student;
 *   • checklist → progress_percent (weighted, waived items count as complete).
 *
 * The generator is intentionally conservative: it produces a sensible starting
 * checklist, never claims a requirement is compulsory when it is test-optional
 * or university-specific. Every item can be edited, waived or deleted.
 * ============================================================================
 */

export const DEGREE_LEVELS = [
  { key: 'bachelor', label: "Bachelor's (first year)" },
  { key: 'foundation', label: 'Foundation / pathway' },
  { key: 'transfer', label: 'Transfer' },
  { key: 'exchange', label: 'Exchange / semester abroad' },
  { key: 'dual_degree', label: 'Dual degree' },
  { key: 'master', label: "Master's" },
  { key: 'phd', label: 'PhD / doctorate' },
]

export const TERM_SEASONS = ['Fall', 'Spring', 'Winter', 'Summer']

export const PLATFORMS = [
  { key: 'common_app', label: 'Common App' },
  { key: 'uc_application', label: 'UC Application' },
  { key: 'coalition_scoir', label: 'Coalition / Scoir' },
  { key: 'ucas', label: 'UCAS (UK)' },
  { key: 'questbridge', label: 'QuestBridge' },
  { key: 'ouac', label: 'OUAC (Ontario)' },
  { key: 'university_portal', label: 'University portal' },
  { key: 'other', label: 'Other' },
]

export const ROUNDS = [
  { key: 'ed1', label: 'Early Decision I (binding)', binding: true },
  { key: 'ed2', label: 'Early Decision II (binding)', binding: true },
  { key: 'ea', label: 'Early Action', binding: false },
  { key: 'rea_scea', label: 'REA / SCEA (restrictive)', binding: false },
  { key: 'rd', label: 'Regular Decision', binding: false },
  { key: 'rolling', label: 'Rolling admission', binding: false },
  { key: 'priority', label: 'Priority deadline', binding: false },
  { key: 'round1', label: 'Round 1', binding: false },
  { key: 'round2', label: 'Round 2', binding: false },
  { key: 'round3', label: 'Round 3', binding: false },
  { key: 'uk_oct15', label: 'UCAS 15 October', binding: false },
  { key: 'uk_jan_equal', label: 'UCAS January equal consideration', binding: false },
]

export const FIT_OPTIONS = [
  { key: 'reach', label: 'Reach' },
  { key: 'target', label: 'Target' },
  { key: 'likely', label: 'Likely / safety' },
]

export const DEADLINE_KINDS = [
  { key: 'application', label: 'Application' },
  { key: 'supplements', label: 'Supplements' },
  { key: 'documents', label: 'Documents' },
  { key: 'financial_aid', label: 'Financial aid' },
  { key: 'scholarship', label: 'Scholarship' },
  { key: 'interview_request', label: 'Interview request' },
  { key: 'reply_deposit', label: 'Reply / deposit' },
]

export const INTERVIEW_TYPES = [
  { key: 'alumni', label: 'Alumni' },
  { key: 'faculty', label: 'Faculty' },
  { key: 'group', label: 'Group' },
  { key: 'admissions_officer', label: 'Admissions officer' },
  { key: 'recorded_video', label: 'Recorded video' },
  { key: 'other', label: 'Other' },
]

export const REQUIREMENT_STATUSES = [
  { key: 'not_started', label: 'Not started' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'done', label: 'Done' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'waived', label: 'Waived' },
]

export const AID_POLICIES = [
  { key: 'need_blind', label: 'Need-blind' },
  { key: 'need_aware', label: 'Need-aware' },
  { key: 'merit_only', label: 'Merit only' },
  { key: 'none_international', label: 'No aid for internationals' },
  { key: 'unknown', label: 'Unknown' },
]

export const AID_PERIODS = [
  { key: 'per_year', label: 'Per year' },
  { key: 'total', label: 'Total (whole degree)' },
]

export const CURRENCIES = ['USD', 'GBP', 'EUR', 'AZN', 'TRY', 'HKD', 'SGD', 'TWD', 'CAD', 'AUD', 'KRW', 'JPY']

/** Countries in the universities seed + a few common destinations. */
export const COUNTRIES = [
  { key: 'AZ', label: 'Azerbaijan' },
  { key: 'TR', label: 'Türkiye' },
  { key: 'US', label: 'United States' },
  { key: 'GB', label: 'United Kingdom' },
  { key: 'CA', label: 'Canada' },
  { key: 'HK', label: 'Hong Kong' },
  { key: 'SG', label: 'Singapore' },
  { key: 'TW', label: 'Taiwan' },
  { key: 'KR', label: 'South Korea' },
  { key: 'JP', label: 'Japan' },
  { key: 'CN', label: 'China' },
  { key: 'DE', label: 'Germany' },
  { key: 'NL', label: 'Netherlands' },
  { key: 'FR', label: 'France' },
  { key: 'IT', label: 'Italy' },
  { key: 'ES', label: 'Spain' },
  { key: 'SE', label: 'Sweden' },
  { key: 'CH', label: 'Switzerland' },
  { key: 'IE', label: 'Ireland' },
  { key: 'AU', label: 'Australia' },
  { key: 'AE', label: 'United Arab Emirates' },
  { key: 'OTHER', label: 'Other / not listed' },
]

export const labelOf = (options, key, fallback = '—') =>
  options.find((o) => o.key === key)?.label || (key ? key.replace(/_/g, ' ') : fallback)

export const statusLabel = (key) => labelOf(REQUIREMENT_STATUSES, key, 'Not started')

/**
 * HKU up to 3, NTU up to 5 ranked programmes (spec §11, app-enforced).
 * NTU covers both Nanyang Technological University (SG) and National Taiwan
 * University (TW) — both use ranked programme choices in their portals.
 */
export function getProgramChoiceLimit(universityName = '') {
  const name = String(universityName).toLowerCase()
  if (/university of hong kong|\bhku\b/.test(name)) {
    return { limit: 3, rule: 'HKU allows up to 3 ranked programme choices.' }
  }
  if (/nanyang technological|national taiwan university|\bntu\b/.test(name)) {
    return { limit: 5, rule: 'NTU allows up to 5 ranked programme choices.' }
  }
  return { limit: 10, rule: 'Up to 10 ranked programme choices.' }
}

const ESSAY_META = {
  commonApp: { essayType: 'common_app_personal', note: '650 words maximum · 250 words minimum' },
  supplement: { essayType: 'supplement', note: 'University-specific prompts; check each word limit' },
  ucPiq: { essayType: 'uc_piq', note: 'Answer 4 of 8 questions · 350 words each' },
  ucas: { essayType: 'ucas_personal_statement', note: '4,000 characters including spaces' },
  personal: { essayType: 'personal_statement', note: 'Check the university word limit' },
  sop: { essayType: 'statement_of_purpose', note: 'Usually 800–1,000 words' },
  research: { essayType: 'research_statement', note: 'Research interests + fit with faculty' },
  scholarship: { essayType: 'scholarship', note: 'Scholarship essay' },
}

/** Core items that every application has, regardless of level or platform. */
const BASE_ITEMS = [
  ['application_form', 'Complete the application form', { note: 'Account, biographic details and programme selection' }],
  ['transcript', 'Official transcript', { note: 'Current and previous institutions' }],
  ['application_fee', 'Application fee or fee waiver', { note: 'Record the amount and waiver outcome in Portal & fee' }],
  ['passport_copy', 'Passport / ID copy', { note: 'Name must match the name on the application', optional: true }],
]

/**
 * Generate the checklist. `meta.generated` marks rows that may be replaced by
 * a later regenerate; custom rows (added by the student) are never removed.
 * @param {object} ctx
 * @param {string} [ctx.degreeLevel]
 * @param {string} [ctx.platform]
 * @param {string} [ctx.country] ISO-2 code
 * @param {string} [ctx.universityName]
 * @param {boolean} [ctx.financialAid]
 * @returns {Array<{req_key,label,status,meta,sort_order}>}
 */
export function generateRequirements(ctx = {}) {
  const {
    degreeLevel = '', platform = '', country = '', universityName = '', financialAid = false,
  } = ctx
  const level = degreeLevel || 'bachelor'
  const grad = level === 'master' || level === 'phd'
  const isPhd = level === 'phd'
  const c = String(country).toUpperCase()
  const us = c === 'US'
  const uk = c === 'GB'
  const eastAsia = ['HK', 'SG', 'TW', 'KR', 'JP', 'CN'].includes(c)
  const needsEnglishTest = ['US', 'GB', 'CA', 'IE', 'AU', 'HK', 'SG'].includes(c)
  const items = []
  const seen = new Set()

  const push = (req_key, label, meta = {}) => {
    if (!req_key || seen.has(req_key)) return
    seen.add(req_key)
    items.push({ req_key, label, meta: { generated: true, ...meta } })
  }

  BASE_ITEMS.forEach(([key, label, meta]) => push(key, label, meta))

  if (!grad) {
    // ── Undergraduate platform-specific essays / forms ───────────────────
    if (platform === 'common_app') {
      push('essay_common_app', 'Common App personal essay', ESSAY_META.commonApp)
      push('activities_common_app', 'Activities list (up to 10)', { note: '150 characters per description' })
      push('honors_common_app', 'Honors & awards (up to 5)', { note: 'Common App allows 5 honors' })
      push('supplements', 'University-specific supplements', ESSAY_META.supplement)
      push('rec_teacher_1', 'Teacher recommendation 1')
      push('rec_teacher_2', 'Teacher recommendation 2', { optional: true })
      push('rec_counselor', 'Counselor / school recommendation')
      push('school_report', 'School report & transcript')
    } else if (platform === 'uc_application') {
      push('uc_piq', 'UC Personal Insight Questions', ESSAY_META.ucPiq)
      push('uc_activities', 'UC activities & awards (up to 20)', { note: '20 entries across 6 categories' })
      push('uc_transcript', 'UC academic record / transcript')
      push('test_scores', 'SAT / ACT scores', { optional: true, note: 'UC is test-free — scores are not considered for admission' })
    } else if (platform === 'ucas') {
      push('ucas_personal_statement', 'UCAS personal statement', ESSAY_META.ucas)
      push('ucas_reference', 'UCAS reference', { note: 'One reference from a teacher or counselor' })
      push('predicted_grades', 'Predicted grades')
    } else if (platform === 'coalition_scoir') {
      push('essay_coalition', 'Coalition / Scoir essay', ESSAY_META.personal)
      push('activities_coalition', 'Activities list')
      push('rec_teacher_1', 'Teacher recommendation 1')
    } else if (platform === 'questbridge') {
      push('questbridge_match', 'National College Match application')
      push('essay_questbridge', 'QuestBridge essays', ESSAY_META.personal)
      push('rec_teacher_1', 'Teacher recommendation 1')
      push('financial_aid_docs', 'Financial aid documents', { note: 'Income documentation is required for the Match' })
    } else if (platform === 'ouac') {
      push('ouac_application', 'OUAC application')
      push('supplementary_application', 'Supplementary application / essays', { essayType: 'supplement', optional: true })
      push('rec_teacher_1', 'Teacher recommendation', { optional: true })
    } else {
      push('essay_personal_statement', 'Personal statement / admissions essay', ESSAY_META.personal)
      push('rec_teacher_1', 'Teacher recommendation 1')
      push('rec_teacher_2', 'Teacher recommendation 2', { optional: true })
    }

    if (level === 'transfer') push('course_descriptions', 'Course descriptions / syllabus list')
    if (level === 'foundation' || level === 'exchange') {
      push('english_test', 'English proficiency test', { optional: true, note: 'IELTS / TOEFL / Duolingo' })
    }
    if (uk && platform !== 'ucas') push('predicted_grades', 'Predicted grades')
    if (eastAsia) push('program_choices', 'Ranked programme choices', { note: getProgramChoiceLimit(universityName).rule })
    if (eastAsia) push('interview_prep', 'Admission interview preparation', { optional: true })
  } else {
    // ── Graduate (Master / PhD) ──────────────────────────────────────────
    push('essay_sop', 'Statement of purpose', ESSAY_META.sop)
    push('cv_resume', 'CV / résumé')
    push('rec_1', 'Recommendation letter 1')
    push('rec_2', 'Recommendation letter 2')
    push('rec_3', 'Recommendation letter 3', { optional: !isPhd })
    if (isPhd) {
      push('essay_research_statement', 'Research statement', ESSAY_META.research)
      push('writing_sample', 'Writing sample / publication', { essayType: 'writing_sample', optional: true })
      push('supervisor_contact', 'Contact potential supervisors', { note: 'Phase 6 adds the supervisor contact log' })
    }
    push('gre', 'GRE / GMAT', { optional: true, note: 'Many programmes are now test-optional — check the department' })
    push('portfolio', 'Portfolio', { optional: true, note: 'Only for creative / design programmes' })
  }

  // ── Shared / country rules ─────────────────────────────────────────────
  if (needsEnglishTest && level !== 'exchange') {
    push('english_test', 'English proficiency test', { optional: !grad, note: 'IELTS / TOEFL / Duolingo — waived for some curricula' })
  }
  if (us && !grad && platform !== 'uc_application') {
    push('test_scores', 'SAT / ACT scores', { optional: true, note: 'Most US universities are test-optional' })
  }
  if (c && c !== 'AZ' && c !== 'OTHER') {
    push('translated_transcript', 'Certified translation of documents', { optional: true, note: 'Only if the original is not in English' })
  }
  if (financialAid) {
    if (us) {
      push('css_profile', 'CSS Profile')
      push('fafsa', 'FAFSA / US financial aid forms', { optional: true, note: 'For US citizens / eligible non-citizens' })
    } else {
      push('financial_aid_docs', 'Financial aid / scholarship documents')
    }
    push('scholarship_essay', 'Scholarship essay', { ...ESSAY_META.scholarship, optional: true })
  }

  return items.map((item, index) => ({
    ...item,
    status: 'not_started',
    sort_order: index,
  }))
}

const STATUS_WEIGHT = {
  not_started: 0,
  in_progress: 0.5,
  done: 1,
  submitted: 1,
  waived: 1,
}

/** Checklist → 0–100 cached in applications.progress_percent. */
export function computeRequirementProgress(requirements = []) {
  const list = Array.isArray(requirements) ? requirements : []
  if (!list.length) return 0
  const total = list.reduce((sum, r) => sum + (STATUS_WEIGHT[r.status] ?? 0), 0)
  return Math.max(0, Math.min(100, Math.round((total / list.length) * 100)))
}

/** Essays that can satisfy an essay requirement, by essay_type. */
export function essayStatusToRequirementStatus(essayStatus) {
  if (essayStatus === 'submitted' || essayStatus === 'final') return 'submitted'
  if (essayStatus === 'draft' || essayStatus === 'revising' || essayStatus === 'counselor_review') return 'in_progress'
  return 'not_started'
}
