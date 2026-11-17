/** ============================================================================
 * tests.js — Test Scores vocabulary and section presets
 * ============================================================================
 * DB values are locked by migration 008 (test_attempts.test_type / status).
 * Presets pre-fill sections and maxima for a NEW attempt only; the user can
 * edit anything and already-entered sections are never overwritten.
 * ============================================================================ */

export const TEST_TYPES = [
  'SAT', 'ACT', 'PSAT', 'AP', 'IB', 'ALEVEL', 'IELTS', 'TOEFL',
  'DUOLINGO', 'PTE', 'CAMBRIDGE_C1', 'CAMBRIDGE_C2', 'GRE', 'GMAT',
  'NATIONAL_EXAM', 'OTHER',
]

export const TEST_STATUSES = [
  { key: 'planned', label: 'Planned', tone: 'grey' },
  { key: 'registered', label: 'Registered', tone: 'blue' },
  { key: 'taken_waiting', label: 'Waiting for scores', tone: 'amber' },
  { key: 'released', label: 'Released', tone: 'green', dot: true },
]

export const TEST_TYPE_LABELS = {
  SAT: 'SAT',
  ACT: 'ACT',
  PSAT: 'PSAT',
  AP: 'AP',
  IB: 'IB',
  ALEVEL: 'A Level',
  IELTS: 'IELTS',
  TOEFL: 'TOEFL',
  DUOLINGO: 'Duolingo',
  PTE: 'PTE',
  CAMBRIDGE_C1: 'Cambridge C1',
  CAMBRIDGE_C2: 'Cambridge C2',
  GRE: 'GRE',
  GMAT: 'GMAT',
  NATIONAL_EXAM: 'National exam',
  OTHER: 'Other',
}

export const TEST_TYPE_LABEL = (key) => TEST_TYPE_LABELS[key] || key

/** SAT / PSAT / ACT / AP / IB / A Level / GRE / GMAT / National exam */
export const ADMISSION_TYPES = [
  'SAT', 'ACT', 'PSAT', 'AP', 'IB', 'ALEVEL', 'GRE', 'GMAT', 'NATIONAL_EXAM',
]
/** IELTS / TOEFL / Duolingo / PTE / Cambridge */
export const ENGLISH_TYPES = ['IELTS', 'TOEFL', 'DUOLINGO', 'PTE', 'CAMBRIDGE_C1', 'CAMBRIDGE_C2']

export const TEST_GROUPS = [
  { key: 'admission', label: 'Admission tests', types: ADMISSION_TYPES },
  { key: 'english', label: 'English', types: ENGLISH_TYPES },
  { key: 'other', label: 'Other', types: ['OTHER'] },
]

/** Emoji by group, used on cards. */
export function testEmoji(testType) {
  if (ENGLISH_TYPES.includes(testType)) return '🗣️'
  if (testType === 'AP' || testType === 'IB' || testType === 'ALEVEL') return '📚'
  if (ADMISSION_TYPES.includes(testType)) return '📝'
  return '⭐'
}

/** Pastel tile tint per group. */
export function testTint(testType) {
  if (ENGLISH_TYPES.includes(testType)) return 'sky'
  if (testType === 'AP' || testType === 'IB' || testType === 'ALEVEL') return 'lilac'
  if (ADMISSION_TYPES.includes(testType)) return 'butter'
  return 'slate'
}

/**
 * Section presets: [{ section, score_max }]. Overall rules:
 *   'sum'      → overall is the sum (read-only auto)
 *   'sum-auto' → prefilled sum, read-only
 *   'avg'      → rounded average (suggested)
 *   'ielts'    → average rounded to nearest 0.5 (suggested)
 *   'verbal-quant' → Verbal + Quant (suggested)
 *   null       → no overall
 */
export const TEST_PRESETS = {
  SAT: { overallMax: 1600, sections: [['Reading & Writing', 800], ['Math', 800]], overall: 'sum-auto' },
  PSAT: { overallMax: 1520, sections: [['Reading & Writing', 760], ['Math', 760]], overall: 'sum-auto' },
  ACT: { overallMax: 36, sections: [['English', 36], ['Math', 36], ['Reading', 36], ['Science', 36]], overall: 'avg' },
  AP: { overallMax: null, sections: [], overall: null },
  IB: { overallMax: 45, sections: [], overall: null },
  ALEVEL: { overallMax: null, sections: [], overall: null },
  IELTS: { overallMax: 9, sections: [['Listening', 9], ['Reading', 9], ['Writing', 9], ['Speaking', 9]], overall: 'ielts' },
  TOEFL: { overallMax: 120, sections: [['Reading', 30], ['Listening', 30], ['Speaking', 30], ['Writing', 30]], overall: 'sum' },
  DUOLINGO: { overallMax: 160, sections: [], overall: null },
  PTE: { overallMax: 90, sections: [['Listening', 90], ['Reading', 90], ['Speaking', 90], ['Writing', 90]], overall: null },
  CAMBRIDGE_C1: { overallMax: 230, sections: [['Reading', 230], ['Use of English', 230], ['Writing', 230], ['Listening', 230], ['Speaking', 230]], overall: null },
  CAMBRIDGE_C2: { overallMax: 230, sections: [['Reading', 230], ['Use of English', 230], ['Writing', 230], ['Listening', 230], ['Speaking', 230]], overall: null },
  GRE: { overallMax: 340, sections: [['Verbal', 170], ['Quantitative', 170], ['Analytical Writing', 6]], overall: 'verbal-quant' },
  GMAT: { overallMax: 805, sections: [['Quantitative', 90], ['Verbal', 90], ['Data Insights', 90]], overall: null },
  NATIONAL_EXAM: { overallMax: null, sections: [], overall: null },
  OTHER: { overallMax: null, sections: [], overall: null },
}

export function testPreset(testType) {
  return TEST_PRESETS[testType] || TEST_PRESETS.OTHER
}

/** Sections that need an exam name when the type is NATIONAL_EXAM / OTHER. */
export function needsExamName(testType) {
  return testType === 'NATIONAL_EXAM' || testType === 'OTHER'
}
