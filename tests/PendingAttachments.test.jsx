// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { usePendingAttachments } from '../src/hooks/usePendingAttachments'
import { linkDocument, documentUsage, deleteDocumentEverywhere } from '../src/Services/documentsApi'
import { onDocumentsChanged } from '../src/Services/documentEvents'
vi.mock('../src/Services/documentsApi', () => ({ linkDocument: vi.fn(), documentUsage: vi.fn(), deleteDocumentEverywhere: vi.fn() }))
beforeEach(() => { linkDocument.mockReset().mockResolvedValue(); documentUsage.mockReset().mockResolvedValue({ total: 0 }); deleteDocumentEverywhere.mockReset().mockResolvedValue([]) })
afterEach(() => { cleanup(); sessionStorage.clear() })
describe.each(['activity', 'project', 'honor', 'test'])('%s create attachments', (section) => {
  it('links pending uploads and picks only after create, retaining failures for retry', async () => {
    const notify = vi.fn(); const unsubscribe = onDocumentsChanged(notify)
    const { result } = renderHook(() => usePendingAttachments('user', section))
    const id = result.current.id
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    act(() => { result.current.setFiles([{ id: 'picked' }, { id: 'uploaded' }]); result.current.uploaded([{ id: 'uploaded' }]) })
    expect(linkDocument).not.toHaveBeenCalled()
    linkDocument.mockRejectedValueOnce(new Error('offline'))
    await act(async () => { await result.current.attach(id) })
    expect(linkDocument).toHaveBeenCalledWith('user', section, id, 'picked', { notify: false })
    expect(linkDocument).toHaveBeenCalledWith('user', section, id, 'uploaded', { notify: false })
    expect(result.current.failed[id]).toEqual([{ id: 'picked' }])
    expect(notify).toHaveBeenCalledTimes(1)
    await act(async () => { await result.current.retry(id, { id: 'picked' }) })
    expect(result.current.failed[id]).toEqual([])
    expect(result.current.id).not.toBe(id)
    unsubscribe()
  })
  it('only deletes unused new uploads when discarding, leaving chosen documents intact', async () => {
    const action = vi.fn()
    const { result } = renderHook(() => usePendingAttachments('user', section))
    act(() => { result.current.setFiles([{ id: 'picked' }, { id: 'new' }, { id: 'used' }]); result.current.uploaded([{ id: 'new' }, { id: 'used' }]); result.current.requestDiscard(action) })
    documentUsage.mockImplementation(async (id) => ({ total: id === 'used' ? 1 : 0 }))
    await act(async () => { await result.current.discard(true) })
    expect(deleteDocumentEverywhere).toHaveBeenCalledOnce()
    expect(deleteDocumentEverywhere).toHaveBeenCalledWith('new')
    expect(action).toHaveBeenCalledOnce()
    expect(result.current.files).toEqual([])
  })
})
