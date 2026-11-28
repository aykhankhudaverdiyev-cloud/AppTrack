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
