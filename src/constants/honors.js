/** ============================================================================
 * honors.js — Honors & Awards vocabulary (labels, emojis, tints, limits)
 * ============================================================================
 * DB values are locked by migration 008 (honors.category / honors.result /
 * grade levels 9–12 / recognition levels school…international).
 * ============================================================================ */

export const HONOR_CATEGORIES = [
  { key: 'academic_olympiad', label: 'Academic olympiad', emoji: '🧠', tint: 'lilac' },
  { key: 'research',          label: 'Research',          emoji: '🔬', tint: 'mint' },
  { key: 'competition_hackathon', label: 'Competition / hackathon', emoji: '💻', tint: 'sky' },
  { key: 'scholarship',       label: 'Scholarship',       emoji: '🎓', tint: 'rose' },
  { key: 'arts',              label: 'Arts',              emoji: '🎨', tint: 'butter' },
  { key: 'sports',            label: 'Sports',            emoji: '🥋', tint: 'peach' },
  { key: 'leadership',        label: 'Leadership',        emoji: '🏛️', tint: 'sand' },
  { key: 'other',             label: 'Other',             emoji: '⭐', tint: 'slate' },
]

export const HONOR_LEVELS = [
  { key: 'school',        label: 'School' },
  { key: 'city',          label: 'City' },
  { key: 'regional',      label: 'Regional' },
  { key: 'national',      label: 'National' },
  { key: 'international', label: 'International' },
]

export const HONOR_RESULTS = [
  { key: 'gold_first',          label: 'Gold / 1st',  emoji: '🥇' },
  { key: 'silver_second',       label: 'Silver / 2nd', emoji: '🥈' },
  { key: 'bronze_third',        label: 'Bronze / 3rd', emoji: '🥉' },
  { key: 'finalist',            label: 'Finalist',    emoji: '🏁' },
  { key: 'semifinalist',        label: 'Semifinalist' },
  { key: 'honourable_mention',  label: 'Honourable mention' },
  { key: 'other',               label: 'Other' },
]

export const HONOR_GRADE_LEVELS = [9, 10, 11, 12]

export const HONOR_LIMITS = {
  title: 100,
  subject: 60,
  issuer: 150,
  participantsContext: 120,
  description: 350,
}

const byKey = (list, key) => list.find((item) => item.key === key)

export function honorCategory(key) {
  return byKey(HONOR_CATEGORIES, key) || byKey(HONOR_CATEGORIES, 'other')
}
export function honorCategoryLabel(key) {
  return honorCategory(key).label
}
export function honorResult(key) {
  return byKey(HONOR_RESULTS, key) || byKey(HONOR_RESULTS, 'other')
}
export function honorLevelLabel(key) {
  return byKey(HONOR_LEVELS, key)?.label || key
}

/** Rank-ordered level names (school < city < regional < national < international). */
const LEVEL_RANK = { school: 0, city: 1, regional: 2, national: 3, international: 4 }

/** Highest selected recognition level, or null. */
export function highestLevel(levels = []) {
  const valid = [...new Set(levels)].filter((key) => Object.hasOwn(LEVEL_RANK, key))
  if (!valid.length) return null
  return valid.sort((a, b) => LEVEL_RANK[a] - LEVEL_RANK[b]).pop()
}

/** Card emoji: result first (gold/silver/bronze/finalist), then category. */
export function honorEmoji(row = {}) {
  const result = honorResult(row.result)
  if (result.emoji) return result.emoji
  return honorCategory(row.category).emoji
}

/** Pastel tile background key per category. */
export function honorTint(key) {
  return honorCategory(key).tint
}
