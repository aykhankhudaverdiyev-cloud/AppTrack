// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { UploadModal } from '../src/components/section/ProofBlock'
import { linkDocument, uploadDocument } from '../src/Services/documentsApi'

vi.mock('../src/store/studentsStore', () => ({ onDataChanged: () => () => {} }))
vi.mock('../src/Services/documentsApi', () => ({
  DOCUMENT_CATEGORIES: { transcript: 'Transcript' }, SECTION_CATEGORIES: { education: ['transcript'] },
  validateDocumentFile: () => '', findDuplicate: () => null, formatSize: () => '1 B',
  listDocuments: vi.fn(async () => []),
  uploadDocument: vi.fn(async (_id, { title }) => ({ id: title, title })),
  linkDocument: vi.fn(async () => {}),
}))
afterEach(() => { cleanup(); vi.clearAllMocks() })
function add(...files) { fireEvent.change(document.querySelector('input[type=file]'), { target: { files } }) }
const pdf = (name) => new File(['x'], name, { type: 'application/pdf' })
it('uploads and links multiple files independently', async () => {
  const linked = vi.fn(); render(<UploadModal open userId="test" section="education" itemId="item" existing={[]} onClose={() => {}} onLinked={linked} />)
  await waitFor(() => expect(screen.getByRole('button', { name: /Drop files here/ })).toBeEnabled())
  add(pdf('first.pdf'), pdf('second.pdf'))
  fireEvent.click(screen.getByRole('button', { name: 'Upload 2 files' }))
  await waitFor(() => expect(linked).toHaveBeenCalledOnce())
  expect(uploadDocument).toHaveBeenCalledTimes(2)
  expect(linkDocument).toHaveBeenCalledWith('test', 'education', 'item', 'first')
  expect(linkDocument).toHaveBeenCalledWith('test', 'education', 'item', 'second')
})
it('does not upload a file twice when attaching it failed', async () => {
  linkDocument.mockRejectedValueOnce(new Error('link failed'))
  render(<UploadModal open userId="test" section="education" itemId="item" existing={[]} onClose={() => {}} />)
  await waitFor(() => expect(screen.getByRole('button', { name: /Drop files here/ })).toBeEnabled())
  add(pdf('first.pdf'))
  fireEvent.click(screen.getByRole('button', { name: 'Upload 1 file' }))
  await screen.findByText('Upload failed. Please try again.')
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  fireEvent.click(screen.getByRole('button', { name: 'Upload 1 file' }))
  await waitFor(() => expect(linkDocument).toHaveBeenCalledTimes(2))
  expect(uploadDocument).toHaveBeenCalledTimes(1)
})
