// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { supabase } from '../src/lib/supabase'
import { createActivity } from '../src/Services/activitiesApi'
import { createProject } from '../src/Services/projectsApi'
import { createHonor } from '../src/Services/honorsApi'
import { createTest } from '../src/Services/testsApi'
import { emptyDraft } from '../src/utils/activities'
import { emptyProjectDraft } from '../src/utils/projects'
import { emptyHonorDraft } from '../src/utils/honors'
import { emptyTestDraft } from '../src/utils/tests'
vi.mock('../src/lib/supabase', () => ({ supabase: { from: vi.fn() } }))
const insert = vi.fn()
beforeEach(() => {
  insert.mockClear().mockImplementation((row) => ({ select: () => ({ single: async () => ({ data: row, error: null }) }) }))
  supabase.from.mockImplementation(() => ({ insert }))
})
it.each([
  ['activity', createActivity, emptyDraft()],
  ['project', createProject, emptyProjectDraft()],
  ['honor', createHonor, emptyHonorDraft('other')],
  ['test', createTest, emptyTestDraft('SAT')],
])('preserves the client UUID in the %s insert', async (_section, create, draft) => {
  const id = '12345678-1234-4234-8234-123456789abc'
  const result = await create('user', { ...draft, id })
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ id, user_id: 'user' }))
  expect(result.id).toBe(id)
})
