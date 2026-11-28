// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import ProofBlock from '../src/components/section/ProofBlock'
const docs = [{ id: 'a', title: 'Transcript', category: 'transcript', mime_type: 'application/pdf', size_bytes: 1024, created_at: '2026-11-28' }, { id: 'b', title: 'Photo', category: 'transcript', mime_type: 'image/png' }]
vi.mock('../src/Services/documentsApi', () => ({
  DOCUMENT_CATEGORIES: { transcript: 'Transcript' }, SECTION_CATEGORIES: { education: ['transcript'] },
  cachedDocuments: () => docs, listDocuments: vi.fn(async () => docs), listItemDocuments: vi.fn(async () => []),
  formatSize: () => '1 KB', findDuplicate: () => null, validateDocumentFile: () => '',
  linkDocument: vi.fn(), unlinkDocument: vi.fn(), uploadDocument: vi.fn(), openDocument: vi.fn(),
  documentUsage: vi.fn(), deleteDocumentEverywhere: vi.fn(), usageSentence: vi.fn(),
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
