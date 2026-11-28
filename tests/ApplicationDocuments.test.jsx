// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { linkDocument, unlinkDocument, listItemDocuments, documentUsage } from '../src/Services/documentsApi'

const db = vi.hoisted(() => ({ calls: [], duplicate: null }))
vi.mock('../src/lib/supabase', () => ({ supabase: {
  from(table) {
    const query = {
      filters: [],
      insert(row) { db.calls.push({ operation: 'insert', table, row }); return Promise.resolve({ error: db.duplicate ? { code: '23505' } : null }) },
      delete() { db.calls.push({ operation: 'delete', table, filters: this.filters }); return this },
      select() { return this },
      eq(key, value) { this.filters.push([key, value]); return this },
      maybeSingle() { return Promise.resolve({ data: { label: db.duplicate }, error: null }) },
      order() { return Promise.resolve({ data: table === 'document_links' ? [
        { id: 'l1', document_id: 'd1', visibility: 'private' }, { id: 'l2', document_id: 'd2', visibility: 'public' },
      ] : [], error: null }) },
      in() { return Promise.resolve({ data: table === 'document_files' ? [{ id: 'd1', title: 'One' }, { id: 'd2', title: 'Two' }]
        : table === 'applications' ? [{ id: 'app', university: 'MIT' }]
          : [{ application_id: 'app', req_key: 'transcript', label: 'Official transcript' }], error: null }) },
      then(resolve) { resolve({ data: null, error: null }) },
    }
    return query
  },
  rpc: async () => ({ data: [{ section: 'application', item_id: 'app', title: 'transcript' }], error: null }),
} }))
vi.mock('../src/lib/storage', () => ({ createSignedFileUrl: vi.fn(), removeStorageFile: vi.fn() }))
beforeEach(() => { db.calls = []; db.duplicate = null })
it('stores requirement labels and defaults visibility to private without setting file status', async () => {
  await linkDocument('student', 'application', 'app', 'd1', { label: 'transcript' })
  expect(db.calls[0]).toEqual({ operation: 'insert', table: 'document_links', row: { user_id: 'student', application_id: 'app', document_id: 'd1', label: 'transcript', visibility: 'private' } })
})
it('refuses silently moving a file already used for another requirement', async () => {
  db.duplicate = 'recommendation'
  await expect(linkDocument('student', 'application', 'app', 'd1', { label: 'transcript' })).rejects.toThrow('another requirement')
})
it('lists several files and unlinks only the requested application requirement', async () => {
  const files = await listItemDocuments('application', 'app', 'transcript')
  expect(files).toHaveLength(2)
  expect(files[1]).toMatchObject({ id: 'd2', visibility: 'public', link_id: 'l2' })
  await unlinkDocument('application', 'app', 'd1', 'transcript')
  expect(db.calls[0].filters).toEqual([['application_id', 'app'], ['document_id', 'd1'], ['label', 'transcript']])
})
it('enriches application usage with university and requirement label', async () => {
  const usage = await documentUsage('d1')
  expect(usage.items[0].title).toBe('MIT · Official transcript')
})
