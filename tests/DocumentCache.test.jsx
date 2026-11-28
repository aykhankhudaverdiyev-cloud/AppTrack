// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { supabase } from '../src/lib/supabase'
import { removeStorageFile } from '../src/lib/storage'
import { listDocuments, uploadDocument, deleteDocumentEverywhere } from '../src/Services/documentsApi'
import { onDocumentsChanged } from '../src/Services/documentEvents'
vi.mock('../src/lib/supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn(), storage: { from: vi.fn() } } }))
vi.mock('../src/lib/storage', () => ({ createSignedFileUrl: vi.fn(), removeStorageFile: vi.fn() }))
it('shares a library request and updates its cache on upload and delete without waiting for storage cleanup', async () => {
  const rows = [{ id: 'old', title: 'Old' }]
  let reads = 0
  supabase.from.mockImplementation(() => ({
    select: () => ({ eq: () => ({ order: async () => { reads++; return { data: rows } } }) }),
    insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'new', title: 'New' } }) }) }),
  }))
  supabase.storage.from.mockReturnValue({ upload: vi.fn(async () => ({ error: null })) })
  supabase.rpc.mockResolvedValue({ data: ['path'] })
  removeStorageFile.mockImplementation(() => new Promise(() => {}))
  const notify = vi.fn(); const unsubscribe = onDocumentsChanged(notify)
  await Promise.all([listDocuments('cache-test'), listDocuments('cache-test')])
  expect(reads).toBe(1)
  await uploadDocument('cache-test', { file: new File(['a'], 'new.pdf', { type: 'application/pdf' }), title: 'New', category: 'transcript' }, undefined, { notify: false })
  expect((await listDocuments('cache-test')).map((doc) => doc.id)).toEqual(['new', 'old'])
  expect(notify).not.toHaveBeenCalled()
  await deleteDocumentEverywhere('new')
  expect(removeStorageFile).toHaveBeenCalledWith('path')
  expect((await listDocuments('cache-test')).map((doc) => doc.id)).toEqual(['old'])
  expect(notify).toHaveBeenCalledTimes(1)
  unsubscribe()
})
