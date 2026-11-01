/**
 * ============================================================================
 * activityTypes.js — Common App "Activities and experiences" categories
 * ============================================================================
 * Section 7 of the spec: the dropdown must match Common App categories so a
 * student can copy entries 1:1 into the portal. Keys are stable DB values
 * (public.activities.activity_type); labels are what the user sees.
 *
 * filterChips — the unified list's filter row (Section 1, EXPERIENCE):
 *   All · Volunteering · Work & Internships · Research · Projects ·
 *   Clubs & Leadership · Sports · Arts · Family responsibilities · Other
 * ============================================================================
 */

export const ACTIVITY_TYPES = [
  { key: 'academic', label: 'Academic', emoji: '📚' },
  { key: 'art', label: 'Art', emoji: '🎨' },
  { key: 'athletics_club', label: 'Athletics: Club', emoji: '🎽' },
  { key: 'athletics_jv_varsity', label: 'Athletics: JV/Varsity', emoji: '🏅' },
  { key: 'career_oriented', label: 'Career-Oriented', emoji: '💼' },
  { key: 'community_service', label: 'Community Service (Volunteer)', emoji: '🤝' },
  { key: 'computer_technology', label: 'Computer/Technology', emoji: '💻' },
  { key: 'cultural', label: 'Cultural', emoji: '🌍' },
  { key: 'dance', label: 'Dance', emoji: '💃' },
  { key: 'debate_speech', label: 'Debate/Speech', emoji: '🎤' },
  { key: 'environmental', label: 'Environmental', emoji: '🌱' },
  { key: 'family_responsibilities', label: 'Family Responsibilities', emoji: '🏠' },
  { key: 'foreign_exchange', label: 'Foreign Exchange', emoji: '✈️' },
  { key: 'foreign_language', label: 'Foreign Language', emoji: '🗣️' },
  { key: 'internship', label: 'Internship', emoji: '🏢' },
  { key: 'journalism_publication', label: 'Journalism/Publication', emoji: '📰' },
  { key: 'music', label: 'Music', emoji: '🎵' },
  { key: 'religious', label: 'Religious', emoji: '🕌' },
  { key: 'research', label: 'Research', emoji: '🔬' },
  { key: 'robotics', label: 'Robotics', emoji: '🤖' },
  { key: 'school_spirit', label: 'School Spirit', emoji: '📣' },
  { key: 'science_math', label: 'Science/Math', emoji: '🧪' },
  { key: 'social_justice', label: 'Social Justice', emoji: '⚖️' },
  { key: 'student_government', label: 'Student Government/Politics', emoji: '🗳️' },
  { key: 'theater_drama', label: 'Theater/Drama', emoji: '🎭' },
  { key: 'work_paid', label: 'Work (Paid)', emoji: '🧰' },
  { key: 'other_club', label: 'Other Club/Activity', emoji: '⭐' },
]

export const ACTIVITY_TYPE_KEYS = ACTIVITY_TYPES.map((t) => t.key)

const activityTypeMap = new Map(ACTIVITY_TYPES.map((t) => [t.key, t]))

/** Label + emoji for a DB key; falls back to "Other". */
export function activityTypeLabel(key) {
  return activityTypeMap.get(key)?.label ?? 'Other Club/Activity'
}

export function activityTypeEmoji(key) {
  return activityTypeMap.get(key)?.emoji ?? '⭐'
}

/**
 * Filter chips → sets of activity_type keys.
 * "Volunteering" and "Work & Internships" preserve the two legacy list views
 * (current Volunteering / Internships & Jobs pages) over the ONE data model.
 */
export const ACTIVITY_FILTER_CHIPS = [
  { key: 'all', label: 'All', emoji: '🗂️', types: null },
  {
    key: 'volunteering',
    label: 'Volunteering',
    emoji: '🤝',
    types: ['community_service', 'environmental', 'social_justice', 'religious'],
  },
  {
    key: 'work',
    label: 'Work & Internships',
    emoji: '💼',
    types: ['work_paid', 'internship', 'career_oriented'],
  },
  { key: 'research', label: 'Research', emoji: '🔬', types: ['research'] },
  {
    key: 'projects',
    label: 'Projects',
    emoji: '🛠️',
    types: ['computer_technology', 'robotics', 'science_math'],
  },
  {
    key: 'clubs',
    label: 'Clubs & Leadership',
    emoji: '📣',
    types: [
      'academic', 'school_spirit', 'student_government', 'debate_speech',
      'journalism_publication', 'foreign_language', 'foreign_exchange', 'cultural',
      'other_club',
    ],
  },
  {
    key: 'sports',
    label: 'Sports',
    emoji: '🏅',
    types: ['athletics_club', 'athletics_jv_varsity'],
  },
  {
    key: 'arts',
    label: 'Arts',
    emoji: '🎨',
    types: ['art', 'music', 'dance', 'theater_drama'],
  },
  {
    key: 'family',
    label: 'Family responsibilities',
    emoji: '🏠',
    types: ['family_responsibilities'],
  },
]

/** Common App copy limits (Section 0, principle #4). */
export const COMMON_APP_LIMITS = {
  position: 50,
  organization: 100,
  description: 150,
  maxEntries: 10,
  honors: { title: 100, maxEntries: 5 },
}

/** UC activity copy limits. */
export const UC_LIMITS = {
  description: 350,
  maxEntries: 20,
}
