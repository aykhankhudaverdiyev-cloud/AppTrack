/**
 * ============================================================================
 * projectTypes.js — Projects page vocabulary (labels, tiles, pills, limits)
 * ============================================================================
 * `key` values are the DB values of public.projects (CHECK-locked by
 * migration 007). `label` is the short chip / tag text, `full` is the dropdown
 * option text.
 * ============================================================================
 */

export const PROJECT_TYPES = [
  { key: 'software_app', label: 'Software', full: 'Software / app', emoji: '🗂️', tint: 'lilac' },
  { key: 'research_paper', label: 'Research', full: 'Research project / paper', emoji: '🔬', tint: 'mint' },
  { key: 'data_analysis', label: 'Data', full: 'Data analysis', emoji: '📊', tint: 'sky' },
  { key: 'hardware_engineering', label: 'Hardware', full: 'Hardware / engineering', emoji: '🔧', tint: 'sand' },
  { key: 'competition_project', label: 'Competition', full: 'Competition project', emoji: '🏆', tint: 'butter' },
  { key: 'creative_work', label: 'Creative', full: 'Creative work', emoji: '🎨', tint: 'rose' },
  { key: 'other', label: 'Other', full: 'Other', emoji: '⭐', tint: 'slate' },
]

export const PROJECT_TYPE_KEYS = PROJECT_TYPES.map((type) => type.key)

export const PROJECT_ROLES = [
  { key: 'solo', label: 'Solo' },
  { key: 'team_lead', label: 'Team lead' },
  { key: 'team_member', label: 'Team member' },
]

export const PROJECT_STATUSES = [
  { key: 'in_progress', label: 'In progress', tone: 'amber' },
  { key: 'live', label: 'Live', tone: 'green', dot: true },
  { key: 'paused', label: 'Paused', tone: 'grey' },
]

export const PROJECT_VISIBILITIES = [
  { key: 'private', label: 'Private' },
  { key: 'public', label: 'Public' },
]

export const PROJECT_LIMITS = {
  title: 120,
  summary: 200,
  problem: 300,
  buildSummary: 500,
  result: 300,
  tags: 12,
  tagLength: 30,
}

/** "+ Add software project" etc. — the link under the cards. */
export const PROJECT_ADD_LABELS = {
  software_app: 'software project',
  research_paper: 'research project',
  data_analysis: 'data project',
  hardware_engineering: 'hardware project',
  competition_project: 'competition project',
  creative_work: 'creative project',
  other: 'project',
}
