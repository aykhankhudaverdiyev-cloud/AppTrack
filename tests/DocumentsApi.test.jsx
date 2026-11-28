// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { usageSentence, findDuplicate } from '../src/Services/documentsApi'
vi.mock('../src/lib/supabase', () => ({ supabase: {} }))
vi.mock('../src/lib/storage', () => ({ createSignedFileUrl: vi.fn(), removeStorageFile: vi.fn() }))
vi.mock('../src/store/studentsStore', () => ({ notifyDataChanged: vi.fn() }))
it('names every place a file is attached', () => {
  const text = usageSentence({ total: 2, items: [{ section: 'education', title: 'Lyceum' }, { section: 'application', title: 'MIT' }] })
  expect(text).toContain('Education · Lyceum')
  expect(text).toContain('Applications · MIT')
  expect(text).toContain('2 places')
})

it('identifies duplicates only when both the filename and byte size match', () => {
  const docs = [{ id: 'existing', title: 'Report', size_bytes: 12 }, { id: 'unknown', title: 'Report', size_bytes: null }]
  expect(findDuplicate(docs, { name: 'report.pdf', size: 12 })?.id).toBe('existing')
  expect(findDuplicate(docs, { name: 'report.pdf', size: 13 })).toBeNull()
})
