// @vitest-environment jsdom
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import ActivityPanel from '../src/components/activities/ActivityPanel'
import ProjectPanel from '../src/components/projects/ProjectPanel'
import HonorPanel from '../src/components/honors/HonorPanel'
import TestPanel from '../src/components/tests/TestPanel'
import EducationPanel from '../src/components/academic/EducationPanel'
import { emptyDraft as activityDraft, rowFromDraft as activityRow } from '../src/utils/activities'
import { emptyProjectDraft, rowFromDraft as projectRow } from '../src/utils/projects'
import { emptyHonorDraft, rowFromDraft as honorRow } from '../src/utils/honors'
import { emptyTestDraft, rowFromDraft as testRow } from '../src/utils/tests'

vi.mock('../src/lib/supabase', () => ({ supabase: {} }))
beforeAll(() => { Element.prototype.scrollIntoView = () => {} })
afterEach(() => { cleanup(); sessionStorage.clear() })
const now = new Date()
const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}-01`
function pickMonth(label) {
  fireEvent.click(screen.getByRole('button', { name: `Choose ${label.toLowerCase()}` }))
  fireEvent.click(screen.getByRole('button', { name: 'This month' }))
}
function recover(section, draft) { sessionStorage.setItem(`apptrack:create:${section}:test`, JSON.stringify(draft)) }

it('creates an activity with the selected start date and clears its required error', async () => {
  recover('activities', { ...activityDraft(), organization_name: 'Club', position: 'Member', grade_levels: [9], hours_per_week: '2', weeks_per_year: '20' })
  const create = vi.fn(); render(<ActivityPanel mode="create" userId="test" onCreate={create} />)
  fireEvent.click(screen.getByRole('button', { name: 'Create activity' }))
  expect(screen.getByText('Add the start date')).toBeInTheDocument()
  pickMonth('Start date'); expect(screen.queryByText('Add the start date')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Create activity' }))
  await waitFor(() => expect(create).toHaveBeenCalledOnce())
  expect(activityRow(create.mock.calls[0][0]).start_date).toBe(month)
})
it('creates a project with a selected start date', async () => {
  recover('projects', { ...emptyProjectDraft(), title: 'Test project' })
  const create = vi.fn(); render(<ProjectPanel mode="create" userId="test" onCreate={create} />)
  pickMonth('Start date'); fireEvent.click(screen.getByRole('button', { name: 'Create project' }))
  await waitFor(() => expect(create).toHaveBeenCalledOnce())
  expect(projectRow(create.mock.calls[0][0]).start_date).toBe(month)
})
it('creates an honor with a numeric received month and year', async () => {
  recover('honors', { ...emptyHonorDraft('other'), title: 'Award', grade_levels: [9], levels: ['school'], description: 'Description' })
  const create = vi.fn(); render(<HonorPanel mode="create" userId="test" onCreate={create} />)
  pickMonth('Date received'); fireEvent.click(screen.getByRole('button', { name: 'Create honor' }))
  await waitFor(() => expect(create).toHaveBeenCalledOnce())
  expect(honorRow(create.mock.calls[0][0])).toMatchObject({ received_month: now.getMonth()+1, received_year: now.getFullYear() })
})
it('creates a test with the selected day', async () => {
  recover('tests', { draft: { ...emptyTestDraft('SAT'), status: 'planned' }, sections: [] })
  const create = vi.fn(); render(<TestPanel mode="create" userId="test" onCreate={create} />)
  fireEvent.click(screen.getByRole('button', { name: 'Choose test date' })); fireEvent.click(screen.getByRole('button', { name: 'Today' }))
  fireEvent.click(screen.getByRole('button', { name: 'Create test' }))
  await waitFor(() => expect(create).toHaveBeenCalledOnce())
  expect(testRow(create.mock.calls[0][0]).test_date).toBe(`${month.slice(0,8)}${String(now.getDate()).padStart(2,'0')}`)
})
it('creates an education entry with the selected start date', async () => {
  const create = vi.fn(); render(<EducationPanel mode="create" onCreate={create} />)
  fireEvent.click(screen.getByRole('radio', { name: /university/i }))
  fireEvent.change(screen.getByLabelText(/Institution name/i), { target: { value: 'School' } })
  fireEvent.change(screen.getByLabelText(/Country/), { target: { value: 'Azerbaijan' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create entry' }))
  expect(screen.getByText('Add the start date')).toBeInTheDocument()
  pickMonth('Start date'); expect(screen.queryByText('Add the start date')).not.toBeInTheDocument()
  pickMonth('Expected graduation')
  fireEvent.click(screen.getByRole('button', { name: 'Create entry' }))
  await waitFor(() => expect(create).toHaveBeenCalledOnce())
  expect(create.mock.calls[0][0].start_date).toBe(month)
})

it('saves the new education country immediately on change', async () => {
  const update = vi.fn().mockResolvedValue(undefined)
  render(<EducationPanel mode="edit" row={{ id: 'test-entry', entry_type: 'secondary_school', institution_name: 'School', country: 'Azerbaijan', start_date: '2020-01-01', end_date: '2025-01-01', qualification: 'Other', grading_scale: '1–5' }} onUpdate={update} />)
  fireEvent.change(screen.getByLabelText(/Country/), { target: { value: 'Canada' } })
  await waitFor(() => expect(update).toHaveBeenCalledWith('test-entry', expect.objectContaining({ country: 'Canada' })))
  expect(update.mock.calls[0][1].country).toBe('Canada')
})

it('saves a new qualification instead of the old value', async () => {
  const update = vi.fn().mockResolvedValue(undefined)
  render(<EducationPanel mode="edit" row={{ id: 'test-entry', entry_type: 'secondary_school', institution_name: 'School', country: 'Azerbaijan', start_date: '2020-01-01', end_date: '2025-01-01', grading_scale: '1–5' }} onUpdate={update} />)
  const select = screen.getByLabelText(/Qualification/)
  const choice = [...select.options].find(option => option.value)
  fireEvent.change(select, { target: { value: choice.value } })
  await waitFor(() => expect(update).toHaveBeenCalledWith('test-entry', expect.objectContaining({ qualification: choice.value })))
  expect(update.mock.calls[0][1].qualification).toBe(choice.value)
})

it('saves a new activity date in edit mode', async () => {
  const save = vi.fn().mockResolvedValue(undefined)
  render(<ActivityPanel mode="edit" row={{ ...activityRow({ ...activityDraft(), organization_name: 'Club', position: 'Member', grade_levels: [9], hours_per_week: '2', weeks_per_year: '20', start_month: '2020-01' }), id: 'activity' }} onSave={save} />)
  expect(screen.getByText('Proof')).toBeInTheDocument()
  pickMonth('Start date')
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ start_month: month })))
})

it('saves a new project date in edit mode', async () => {
  const save = vi.fn().mockResolvedValue(undefined)
  render(<ProjectPanel mode="edit" row={{ ...projectRow({ ...emptyProjectDraft(), title: 'Project', start_month: '2020-01' }), id: 'project' }} onSave={save} />)
  pickMonth('Start date')
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ start_month: month })))
})

it('saves a new honor date in edit mode', async () => {
  const save = vi.fn().mockResolvedValue(undefined)
  render(<HonorPanel mode="edit" row={{ ...honorRow({ ...emptyHonorDraft('other'), title: 'Award', grade_levels: [9], levels: ['school'], received_month: '2020-01' }), id: 'honor' }} onSave={save} />)
  pickMonth('Date received')
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ received_month: month })))
})

it('saves a new test date in edit mode', async () => {
  const save = vi.fn().mockResolvedValue(undefined)
  render(<TestPanel mode="edit" row={{ ...testRow({ ...emptyTestDraft('SAT'), status: 'planned', test_date: '2020-01-01' }), id: 'test', sections: [] }} onSave={save} />)
  fireEvent.click(screen.getByRole('button', { name: 'Choose test date' }))
  fireEvent.click(screen.getByRole('button', { name: 'Today' }))
  const today = `${month.slice(0, 8)}${String(now.getDate()).padStart(2, '0')}`
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ test_date: today }), expect.any(Array)))
})
