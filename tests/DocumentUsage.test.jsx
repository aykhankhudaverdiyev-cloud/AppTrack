// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { listAllLinks, cachedDocumentUsage } from '../src/Services/documentsApi'

const fake = vi.hoisted(() => ({
  item_documents: [{ section: 'education', item_id: 'school', document_id: 'file' }, { section: 'activity', item_id: 'activity', document_id: 'file' }],
  document_links: [{ application_id: 'app', document_id: 'file', label: 'transcript' }],
  document_files: [{ id: 'file', title: 'Transcript' }],
  education_entries: [{ id: 'school', institution_name: 'Lyceum' }],
  activities: [{ id: 'activity', position: 'Volunteer' }],
  applications: [{ id: 'app', university: 'MIT' }],
}))
vi.mock('../src/lib/supabase', () => ({ supabase: { from: (table) => ({ select: () => ({
  eq: async () => ({ data: fake[table] || [], error: null }),
  in: async () => ({ data: fake[table] || [], error: null }),
}) }) } }))
vi.mock('../src/lib/storage', () => ({ createSignedFileUrl: vi.fn(), removeStorageFile: vi.fn() }))
vi.mock('../src/store/studentsStore', () => ({ notifyDataChanged: vi.fn() }))

it('lists school, activity and application uses from mocked data', async () => {
  const links = await listAllLinks('test-user')
  expect(links['education:school']).toMatchObject({ itemTitle: 'Lyceum', documents: [{ id: 'file' }] })
  expect(links['activity:activity']).toMatchObject({ itemTitle: 'Volunteer', documents: [{ id: 'file' }] })
  expect(links['application:app:transcript']).toMatchObject({ itemTitle: 'MIT · transcript', documents: [{ id: 'file' }] })
  expect(cachedDocumentUsage('test-user', 'file').total).toBe(3)
  expect(cachedDocumentUsage('unknown-user', 'file')).toBeNull()
})
