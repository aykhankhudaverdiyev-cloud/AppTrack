// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { getPublicStudents } from '../src/store/studentsStore'
const calls = vi.hoisted(() => [])
const data = vi.hoisted(() => ({
  profiles: [{ id: 'owner', full_name: 'Student', profile_visibility: 'public' }],
  applications: [{ id: 'public-app', student_id: 'owner', visibility: 'public', university: 'MIT' }, { id: 'private-app', student_id: 'owner', visibility: 'private' }],
  document_links: [
    { id: 'p', application_id: 'public-app', label: 'transcript', visibility: 'public', document_files: { id: 'f1', title: 'Public' } },
    { id: 'q', application_id: 'public-app', label: 'transcript', visibility: 'private', document_files: { id: 'f2', title: 'Private' } },
    { id: 'r', application_id: 'private-app', label: 'transcript', visibility: 'public', document_files: { id: 'f3', title: 'Hidden application' } },
  ], licenses: [], license_media: [],
}))
vi.mock('../src/lib/supabase', () => ({ supabase: { from(table) {
  const filters = []
  return { select(value) { calls.push([table, value]); return this }, eq(key, value) { filters.push([key, value]); return this },
    async order() { return { data: data[table].filter((row) => filters.every(([key, value]) => row[key] === value)), error: null } } }
} } }))
vi.mock('../src/lib/storage', () => ({ normalizeDocuments: vi.fn(), uploadStorageFile: vi.fn(), removeStorageFile: vi.fn(), createSignedFileUrl: vi.fn() }))
it('public reader includes only public links on public applications via document_files', async () => {
  const [student] = await getPublicStudents()
  expect(student.applications).toHaveLength(1)
  expect(student.applications[0].documents.transcript.map((file) => file.title)).toEqual(['Public'])
  expect(calls.find(([table]) => table === 'document_links')[1]).toContain('document_files')
  expect(calls.some(([table]) => table === 'application_documents')).toBe(false)
})
