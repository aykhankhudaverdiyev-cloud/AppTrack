// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import ProofBlock from '../src/components/section/ProofBlock'
const docs = [{ id: 'a', title: 'Transcript', category: 'transcript', mime_type: 'application/pdf', size_bytes: 1024, created_at: '2026-11-28' }, { id: 'b', title: 'Photo', category: 'transcript', mime_type: 'image/png' }]
vi.mock('../src/Services/documentsApi', () => ({
  DOCUMENT_CATEGORIES: { transcript: 'Transcript' }, SECTION_CATEGORIES: { education: ['transcript'] },
  cachedDocuments: () => docs, cachedDocumentUsage: vi.fn(() => null), primeDocumentUsage: vi.fn(async () => {}), listDocuments: vi.fn(async () => docs), listItemDocuments: vi.fn(async () => []),
  formatSize: () => '1 KB', findDuplicate: () => null, validateDocumentFile: () => '',
  linkDocument: vi.fn(), unlinkDocument: vi.fn(), uploadDocument: vi.fn(), openDocument: vi.fn(),
  documentUsage: vi.fn(), deleteDocumentEverywhere: vi.fn(), usageSentence: vi.fn((usage) => usage.total ? 'Education · School' : 'Not used'),
}))
afterEach(cleanup)
it('opens cached documents, toggles whole rows, and disables linked files', async () => {
  const pending = vi.fn()
  render(<ProofBlock section="education" userId="test" itemId="draft" pendingFiles={[docs[1]]} onPendingChange={pending} />)
  fireEvent.click(screen.getByRole('button', { name: 'Choose from Documents' }))
  expect(screen.getByRole('checkbox', { name: 'Photo' })).toBeDisabled()
  expect(screen.getByText('Linked')).toBeInTheDocument()
  fireEvent.click(screen.getByText('Transcript', { selector: '.document-modal__title' }))
  expect(screen.getByRole('checkbox', { name: 'Transcript' })).toBeChecked()
  expect(screen.getByText('1 selected')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Attach 1 file' }))
  await waitFor(() => expect(pending).toHaveBeenCalledWith([docs[1], docs[0]]))
})
it('shows cached usage immediately while a fresh usage check is pending', async () => {
  const api = await import('../src/Services/documentsApi')
  api.cachedDocumentUsage.mockReturnValueOnce({ total: 1, items: [{ section: 'education', title: 'School' }] })
  api.documentUsage.mockImplementationOnce(() => new Promise(() => {}))
  render(<ProofBlock section="education" userId="test" itemId="draft" pendingFiles={[docs[0]]} onPendingChange={() => {}} />)
  fireEvent.click(screen.getByLabelText('More actions for Transcript'))
  fireEvent.click(screen.getByRole('button', { name: 'Delete file…' }))
  expect(screen.getByText(/Education · School/)).toBeInTheDocument()
  expect(screen.queryByText('Checking where this file is used…')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Delete file' })).toBeDisabled()
})
