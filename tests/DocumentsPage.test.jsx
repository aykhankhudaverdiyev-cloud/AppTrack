// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import DocumentsPage from '../src/components/DocumentsPage'
import { listDocuments, listAllLinks, uploadDocument, documentUsage, deleteDocumentEverywhere } from '../src/Services/documentsApi'

vi.mock('../src/store/studentsStore', () => ({ onDataChanged: () => () => {} }))
vi.mock('../src/Services/documentsApi', () => ({
  DOCUMENT_CATEGORIES: { transcript: 'Transcript' }, SECTION_CATEGORIES: { library: ['transcript'] },
  validateDocumentFile: () => '', findDuplicate: () => null,
  uploadDocument: vi.fn(async (_userId, { title }) => ({ id: 'new', title })),
  listDocuments: vi.fn(async () => [{ id: 'doc', title: 'Transcript', category: 'transcript', size_bytes: 100 }]),
  listAllLinks: vi.fn(async () => ({})),
  deleteDocumentEverywhere: vi.fn(), documentUsage: vi.fn(), formatSize: () => '100 B',
  openDocument: vi.fn(), usageSentence: vi.fn(),
}))
afterEach(cleanup)
it('renders only one All filter', async () => {
  render(<DocumentsPage userId="test" />)
  await screen.findByText('Not attached anywhere')
  expect(screen.getAllByRole('button', { name: /All 1/i })).toHaveLength(1)
})

it('hides search and filters when the library is empty', async () => {
  listDocuments.mockResolvedValueOnce([])
  render(<DocumentsPage userId="test" />)
  await screen.findByText('No documents yet')
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'Filter by category' })).not.toBeInTheDocument()
})

it('uploads a file from the library using the shared modal', async () => {
  const { container } = render(<DocumentsPage userId="test" />)
  await screen.findByText('Not attached anywhere')
  fireEvent.click(screen.getByRole('button', { name: 'Upload files' }))
  const file = new File(['data'], 'report.pdf', { type: 'application/pdf' })
  fireEvent.change(container.ownerDocument.querySelector('input[type="file"]'), { target: { files: [file] } })
  expect(screen.getByLabelText('Title for report.pdf')).toHaveValue('report')
  fireEvent.click(screen.getByRole('button', { name: 'Upload 1 file' }))
  await waitFor(() => expect(uploadDocument).toHaveBeenCalledWith('test', expect.objectContaining({ title: 'report', file }), expect.any(Function), { notify: false }))
})

it('shows newest first without a sort control', async () => {
  listDocuments.mockResolvedValueOnce([
    { id: '1', title: 'Older', category: 'transcript', created_at: '2025-01-01' },
    { id: '2', title: 'Newer', category: 'transcript', created_at: '2026-01-01' },
  ])
  render(<DocumentsPage userId="test" />)
  await screen.findByText('Older')
  expect(screen.queryByRole('combobox', { name: 'Sort documents' })).not.toBeInTheDocument()
  expect(screen.getAllByRole('listitem').map((row) => row.querySelector('strong').textContent)).toEqual(['Newer', 'Older'])
})

it('checks usage before deletion and focuses Cancel', async () => {
  let resolveUsage
  documentUsage.mockImplementationOnce(() => new Promise(resolve => { resolveUsage = resolve }))
  render(<DocumentsPage userId="test" />)
  await screen.findByText('Not attached anywhere')
  fireEvent.click(screen.getByLabelText('More actions for Transcript'))
  fireEvent.click(screen.getByRole('button', { name: 'Delete file…' }))
  expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  expect(screen.queryByText('Checking where this file is used…')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Delete file' })).toBeDisabled()
  resolveUsage({ total: 1, items: [{ section: 'education', title: 'School' }] })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Delete file' })).toBeEnabled())
  expect(deleteDocumentEverywhere).not.toHaveBeenCalled()
})

it('shows a usage chip that opens its linked entry', async () => {
  listAllLinks.mockResolvedValueOnce({ 'education:school': { key: 'education:school', section: 'education', itemTitle: 'Lyceum', documents: [{ id: 'doc' }] } })
  const open = vi.fn()
  render(<DocumentsPage userId="test" onOpenItem={open} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Education · Lyceum' }))
  expect(open).toHaveBeenCalledWith(expect.objectContaining({ section: 'education', item_id: 'school' }))
})
it('restores a deleted row and offers retry if the RPC fails', async () => {
  documentUsage.mockResolvedValueOnce({ total: 0, items: [] })
  deleteDocumentEverywhere.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([])
  render(<DocumentsPage userId="test" />)
  await screen.findByText('Not attached anywhere')
  fireEvent.click(screen.getByLabelText('More actions for Transcript'))
  fireEvent.click(screen.getByRole('button', { name: 'Delete file…' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Delete file' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Delete file' }))
  await screen.findByText('Could not delete the file.')
  expect(screen.getByText('Transcript', { selector: 'strong' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(deleteDocumentEverywhere).toHaveBeenCalledTimes(2))
})
