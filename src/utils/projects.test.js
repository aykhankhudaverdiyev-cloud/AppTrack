/**
 * Projects page — pure helper tests (tiles, pills, summary, tags, draft ↔ row,
 * validation).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  draftFromRow, emptyProjectDraft, isValidUrl, projectAddLabel, projectCategoryCounts,
  projectSummary, projectTags, projectTile, projectTypeLabel, requiredCompleted, roleLabel,
  rowFromDraft, sortProjects, startMonthLabel, statusMeta, validateProject, visibilityLabel,
} from './projects.js'

/* ── tiles ───────────────────────────────────────────────────────────────── */

test('tile: type default, AI wording gets the robot, research stays research', () => {
  assert.deepEqual(projectTile({ project_type: 'software_app', title: 'AppTrack' }), { emoji: '🗂️', tint: 'lilac' })
  assert.deepEqual(projectTile({ project_type: 'software_app', title: 'Multi-agent LLM experiment' }), { emoji: '🤖', tint: 'sky' })
  assert.deepEqual(projectTile({ project_type: 'software_app', title: 'Thing', tech_tags: ['Python', 'LLM APIs'] }), { emoji: '🤖', tint: 'sky' })
  assert.deepEqual(projectTile({ project_type: 'research_paper', title: 'LLM survey study' }), { emoji: '🔬', tint: 'mint' })
  assert.equal(projectTile({}).emoji, '⭐')
})

/* ── pills and labels ────────────────────────────────────────────────────── */

test('status: labels, tones and unknown fallback', () => {
  assert.deepEqual(statusMeta('live'), { key: 'live', label: 'Live', tone: 'green', dot: true })
  assert.equal(statusMeta('paused').tone, 'grey')
  assert.equal(statusMeta('nonsense').key, 'in_progress')
  assert.equal(roleLabel('team_lead'), 'Team lead')
  assert.equal(roleLabel(undefined), 'Solo')
  assert.equal(visibilityLabel('public'), 'Public')
  assert.equal(projectTypeLabel('research_paper'), 'Research')
  assert.equal(projectAddLabel('research_paper'), 'research project')
})

/* ── card content ────────────────────────────────────────────────────────── */

test('summary: stored summary wins, otherwise first sentence of what you built', () => {
  assert.equal(projectSummary({ short_description: 'Web app' }), 'Web app')
  assert.equal(projectSummary({ build_summary: 'Built an app. Then more.' }), 'Built an app.')
  assert.equal(projectSummary({ problem: 'No place to keep documents.' }), 'No place to keep documents.')
  assert.equal(projectSummary({}), '')
  const long = `${'x'.repeat(160)}. rest`
  assert.ok(projectSummary({ build_summary: long }).length <= 141)
})

test('tags: trimmed, capped at six with a +N marker', () => {
  assert.deepEqual(projectTags({ tech_tags: [' React ', 'Supabase', ''] }), ['React', 'Supabase'])
  assert.deepEqual(
    projectTags({ tech_tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] }),
    ['a', 'b', 'c', 'd', 'e', '+3'],
  )
})

test('chips: category counts', () => {
  assert.deepEqual(projectCategoryCounts([
    { project_type: 'software_app' }, { project_type: 'software_app' }, { project_type: 'research_paper' },
  ]), { software_app: 2, research_paper: 1 })
})

/* ── draft ↔ row ─────────────────────────────────────────────────────────── */

test('draft/row: months, tags and visibility round-trip', () => {
  const row = {
    project_type: 'software_app', title: 'AppTrack', role_type: 'team_lead',
    start_date: '2026-07-01', status: 'live', short_description: 'Web app',
    problem: 'Scattered files', build_summary: 'React app', result: 'Shipped',
    tech_tags: ['React', 'Supabase'], github_url: 'github.com/x/y',
    demo_url: null, related_activity_id: 'act-1', visibility: 'public',
  }
  const draft = draftFromRow(row)
  assert.equal(draft.start_month, '2026-07')
  assert.equal(draft.related_activity_id, 'act-1')
  const back = rowFromDraft(draft)
  assert.equal(back.start_date, '2026-07-01')
  assert.deepEqual(back.tech_tags, ['React', 'Supabase'])
  assert.equal(back.visibility, 'public')
  assert.equal(back.demo_url, null)
  assert.equal(startMonthLabel(row), '07/2026')
})

test('row: empty fields become null and tags are de-duplicated', () => {
  const back = rowFromDraft({ ...emptyProjectDraft(), tech_tags: ['React', 'React', '  '] })
  assert.deepEqual(back.tech_tags, ['React'])
  assert.equal(back.problem, null)
  assert.equal(back.start_date, null)
  assert.equal(back.related_activity_id, null)
  assert.equal(back.role_type, 'solo')
})

/* ── validation ──────────────────────────────────────────────────────────── */

test('validation: create needs a title, defaults are otherwise valid', () => {
  assert.deepEqual(validateProject(emptyProjectDraft(), 'create'), { title: 'Project title is required' })
  assert.deepEqual(validateProject(emptyProjectDraft(), 'edit'), {})
  assert.equal(requiredCompleted(emptyProjectDraft()), 0)
  assert.equal(requiredCompleted({ title: 'AppTrack' }), 1)
})

test('validation: limits, urls and fixed option sets', () => {
  assert.equal(validateProject({ problem: 'x'.repeat(301) }).problem, 'Keep it to 300 characters or fewer')
  assert.equal(validateProject({ build_summary: 'x'.repeat(501) }).build_summary, 'Keep it to 500 characters or fewer')
  assert.equal(validateProject({ result: 'x'.repeat(301) }).result, 'Keep it to 300 characters or fewer')
  assert.equal(validateProject({ github_url: 'not a url' }).github_url, 'Enter a valid URL')
  assert.equal(validateProject({ demo_url: 'https://apptrack.vercel.app' }).demo_url, undefined)
  assert.equal(validateProject({ status: 'done' }).status, 'Pick a status')
  assert.equal(validateProject({ role_type: 'team' }).role_type, 'Pick your role')
  assert.equal(validateProject({ start_month: '7/2026' }).start_month, 'Use MM/YYYY')
  assert.deepEqual(validateProject({ start_month: '2026-07' }), {})
})

test('urls: accepts bare domains and http(s), rejects spaces', () => {
  assert.equal(isValidUrl('github.com/a/b'), true)
  assert.equal(isValidUrl('https://example.com/x?y=1'), true)
  assert.equal(isValidUrl(''), true)
  assert.equal(isValidUrl('hello world'), false)
})

test('sort: creation order, not alphabetical', () => {
  const items = [{ id: 'b', created_at: '2026-01-02' }, { id: 'a', created_at: '2026-01-01' }]
  assert.deepEqual(sortProjects(items).map((item) => item.id), ['a', 'b'])
})
