/**
 * ============================================================================
 * activityTypes.js — the nine fixed activity categories
 * ============================================================================
 * Keys are the stable DB values (public.activities.activity_type, CHECK-locked
 * by migration 006). Labels, emojis and tile tints are the UI contract used by
 * the Activities list, the filter chips and the side panel.
 * ============================================================================
 */

export const ACTIVITY_CATEGORIES = [
  { key: 'academic', label: 'Academic', emoji: '💻', tint: 'lilac', chipLabel: 'Academic' },
  { key: 'volunteering', label: 'Volunteering', emoji: '🤝', tint: 'butter', chipLabel: 'Volunteering' },
  { key: 'work', label: 'Work & Internships', emoji: '📡', tint: 'peach', chipLabel: 'Work & Internships' },
  { key: 'research', label: 'Research', emoji: '🔬', tint: 'mint', chipLabel: 'Research' },
  { key: 'sports', label: 'Sports', emoji: '🥋', tint: 'rose', chipLabel: 'Sports' },
  { key: 'arts', label: 'Arts', emoji: '🎬', tint: 'sky', chipLabel: 'Arts' },
  { key: 'clubs', label: 'Clubs & Leadership', emoji: '🏛️', tint: 'sand', chipLabel: 'Clubs' },
  { key: 'family', label: 'Family responsibilities', emoji: '🏠', tint: 'sand', chipLabel: 'Family' },
  { key: 'other', label: 'Other', emoji: '⭐', tint: 'slate', chipLabel: 'Other' },
]

export const ACTIVITY_CATEGORY_KEYS = ACTIVITY_CATEGORIES.map((c) => c.key)

const byKey = new Map(ACTIVITY_CATEGORIES.map((c) => [c.key, c]))

/** Category descriptor for a DB value; unknown values fall back to "Other". */
export function activityCategory(key) {
  return byKey.get(key) || byKey.get('other')
}

export function categoryLabel(key) {
  return activityCategory(key).label
}

/** "+ Add volunteering", "+ Add work or internship" … used under the cards. */
export const CATEGORY_ADD_LABELS = {
  academic: 'academic',
  volunteering: 'volunteering',
  work: 'work or internship',
  research: 'research',
  sports: 'sport',
  arts: 'arts activity',
  clubs: 'club or leadership role',
  family: 'family responsibility',
  other: 'other activity',
}

/**
 * Copy limits. Common App takes the first 10 activities (150-character
 * description); UC takes up to 20. The UI edits "What you did" (350 chars) and
 * "About the organization" (250 chars).
 */
export const ACTIVITY_LIMITS = {
  organizationName: 100,
  position: 50,
  organizationDescription: 250,
  longDescription: 350,
  researchQuestion: 250,
  recommended: 10,
  max: 20,
  hoursPerWeek: { min: 0.5, max: 40, step: 0.5 },
  weeksPerYear: { min: 1, max: 52 },
  gradeLevels: [9, 10, 11, 12],
}
