/**
 * ============================================================================
 * projects.js — pure helpers for the Projects page
 * ============================================================================
 * No React, no Supabase: everything here is unit-tested with `node --test`.
 * Dates reuse the month helpers from activities.js so both sections store
 * MM/YYYY as the 1st of the month.
 * ============================================================================
 */

import {
  PROJECT_ADD_LABELS, PROJECT_LIMITS, PROJECT_ROLES, PROJECT_STATUSES,
  PROJECT_TYPES, PROJECT_VISIBILITIES,
} from '../constants/projectTypes.js'
import { dateToMonth, formatMonthInput, monthToDate, parseLocation } from './activities.js'

const trim = (value) => (value == null ? '' : String(value)).trim()

/* ── categories ─────────────────────────────────────────────────────────── */

export function projectTypeMeta(key) {
  return PROJECT_TYPES.find((type) => type.key === key) || PROJECT_TYPES[PROJECT_TYPES.length - 1]
}

export function projectTypeLabel(key) {
  return projectTypeMeta(key).label
}

export function projectAddLabel(key) {
  return PROJECT_ADD_LABELS[key] || 'project'
}

/**
 * Emoji tile for a card. The type decides the default; AI/ML wording gets the
 * robot so two software projects are still visually distinct.
 */
const AI_PATTERN = /\b(llm|gpt|ai|ml|machine learning|model|agent|neural)\b/i

export function projectTile(project = {}) {
  const meta = projectTypeMeta(project.project_type)
  const words = `${project.title || ''} ${(project.tech_tags || []).join(' ')}`
  if (meta.key !== 'research_paper' && AI_PATTERN.test(words)) return { emoji: '🤖', tint: 'sky' }
  return { emoji: meta.emoji, tint: meta.tint }
}

/* ── pills, roles, visibility ───────────────────────────────────────────── */

export function statusMeta(status) {
  return PROJECT_STATUSES.find((item) => item.key === status) || PROJECT_STATUSES[0]
}

export function roleLabel(role) {
  return PROJECT_ROLES.find((item) => item.key === role)?.label || 'Solo'
}

export function visibilityLabel(value) {
  return PROJECT_VISIBILITIES.find((item) => item.key === value)?.label || 'Private'
}

export function hasLinkedActivity(project = {}) {
  return Boolean(project.related_activity_id)
}

/* ── card content ───────────────────────────────────────────────────────── */

/** One-line summary: the stored summary, else the first sentence of "What you built". */
export function projectSummary(project = {}) {
  const summary = trim(project.short_description)
  if (summary) return summary
  const build = trim(project.build_summary || project.problem)
  if (!build) return ''
  const firstSentence = build.split(/(?<=\.)\s/)[0]
  return firstSentence.length > 140 ? `${firstSentence.slice(0, 137)}…` : firstSentence
}

/** Tech chips for the card (max 6, with a "+N" marker). */
export function projectTags(project = {}, max = 6) {
  const tags = (project.tech_tags || []).map(trim).filter(Boolean)
  if (tags.length <= max) return tags
  return [...tags.slice(0, max - 1), `+${tags.length - max + 1}`]
}

/** Distinct categories present, for the filter chips. */
export function projectCategoryCounts(projects = []) {
  const counts = {}
  for (const project of projects) counts[project.project_type] = (counts[project.project_type] || 0) + 1
  return counts
}

/* ── draft ↔ row ────────────────────────────────────────────────────────── */

export function emptyProjectDraft(projectType = 'software_app') {
  return {
    project_type: projectType,
    title: '',
    role_type: 'solo',
    start_month: '',
    status: 'in_progress',
    short_description: '',
    problem: '',
    build_summary: '',
    result: '',
    tech_tags: [],
    github_url: '',
    demo_url: '',
    related_activity_id: '',
    visibility: 'private',
  }
}

export function draftFromRow(row = {}) {
  return {
    ...emptyProjectDraft(row.project_type || 'software_app'),
    project_type: row.project_type || 'software_app',
    title: row.title || '',
    role_type: row.role_type || 'solo',
    start_month: dateToMonth(row.start_date),
    status: row.status || 'in_progress',
    short_description: row.short_description || '',
    problem: row.problem || '',
    build_summary: row.build_summary || '',
    result: row.result || '',
    tech_tags: [...(row.tech_tags || [])],
    github_url: row.github_url || '',
    demo_url: row.demo_url || '',
    related_activity_id: row.related_activity_id || '',
    visibility: row.visibility || 'private',
  }
}

const nullable = (value, max) => {
  const text = trim(value)
  return text ? text.slice(0, max) : null
}

/** Draft → the exact column set projectsApi may write. */
export function rowFromDraft(draft = {}) {
  return {
    project_type: draft.project_type || 'software_app',
    title: trim(draft.title).slice(0, PROJECT_LIMITS.title),
    role_type: draft.role_type || 'solo',
    start_date: monthToDate(draft.start_month),
    status: draft.status || 'in_progress',
    short_description: nullable(draft.short_description, PROJECT_LIMITS.summary),
    problem: nullable(draft.problem, PROJECT_LIMITS.problem),
    build_summary: nullable(draft.build_summary, PROJECT_LIMITS.buildSummary),
    result: nullable(draft.result, PROJECT_LIMITS.result),
    tech_tags: [...new Set((draft.tech_tags || []).map((tag) => trim(tag).slice(0, PROJECT_LIMITS.tagLength)).filter(Boolean))].slice(0, PROJECT_LIMITS.tags),
    github_url: nullable(draft.github_url, 400),
    demo_url: nullable(draft.demo_url, 400),
    related_activity_id: draft.related_activity_id || null,
    visibility: draft.visibility || 'private',
  }
}

/* ── validation ─────────────────────────────────────────────────────────── */

const URL_PATTERN = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/[^\s]*)?$/i

export function isValidUrl(value) {
  const text = trim(value)
  return text === '' || URL_PATTERN.test(text)
}

export function validateProject(draft = {}, mode = 'edit') {
  const errors = {}
  const title = trim(draft.title)

  if (mode === 'create' && !title) errors.title = 'Project title is required'
  else if (title.length > PROJECT_LIMITS.title) errors.title = `Keep it to ${PROJECT_LIMITS.title} characters or fewer`

  if (trim(draft.problem).length > PROJECT_LIMITS.problem) errors.problem = `Keep it to ${PROJECT_LIMITS.problem} characters or fewer`
  if (trim(draft.build_summary).length > PROJECT_LIMITS.buildSummary) errors.build_summary = `Keep it to ${PROJECT_LIMITS.buildSummary} characters or fewer`
  if (trim(draft.result).length > PROJECT_LIMITS.result) errors.result = `Keep it to ${PROJECT_LIMITS.result} characters or fewer`
  if (trim(draft.short_description).length > PROJECT_LIMITS.summary) errors.short_description = `Keep it to ${PROJECT_LIMITS.summary} characters or fewer`

  if (!isValidUrl(draft.github_url)) errors.github_url = 'Enter a valid URL'
  if (!isValidUrl(draft.demo_url)) errors.demo_url = 'Enter a valid URL'

  const start = trim(draft.start_month)
  if (start && !/^\d{4}-(0[1-9]|1[0-2])$/.test(start)) errors.start_month = 'Use MM/YYYY'

  const given = (value) => value !== undefined && value !== null && value !== ''
  if (given(draft.project_type) && !PROJECT_TYPES.some((type) => type.key === draft.project_type)) errors.project_type = 'Pick a project type'
  if (given(draft.role_type) && !PROJECT_ROLES.some((role) => role.key === draft.role_type)) errors.role_type = 'Pick your role'
  if (given(draft.status) && !PROJECT_STATUSES.some((status) => status.key === draft.status)) errors.status = 'Pick a status'
  if (given(draft.visibility) && !PROJECT_VISIBILITIES.some((option) => option.key === draft.visibility)) errors.visibility = 'Pick a visibility'

  return errors
}

export function requiredCompleted(draft = {}) {
  return trim(draft.title) ? 1 : 0
}

/* ── misc ───────────────────────────────────────────────────────────────── */

/** Location is not part of the Projects page; kept here so helpers stay pure. */
export const projectLocation = parseLocation

/** "07/2026" for the card / panel, '' when unset. */
export function startMonthLabel(project = {}) {
  return formatMonthInput(dateToMonth(project.start_date) || trim(project.start_month))
}

/** Card sort: newest first is wrong for a portfolio — keep creation order. */
export function sortProjects(projects = []) {
  return [...projects].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))
}
