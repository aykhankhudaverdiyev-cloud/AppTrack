// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import ProofBlock from '../src/components/section/ProofBlock'
import { listItemDocuments, unlinkDocument, setDocumentLinkVisibility } from '../src/Services/documentsApi'
vi.mock('../src/Services/documentsApi', () => ({
  DOCUMENT_CATEGORIES: { transcript: 'Transcript' }, SECTION_CATEGORIES: { application: ['transcript'] },
  cachedDocuments: () => [], cachedDocumentUsage: () => null, primeDocumentUsage: vi.fn(async () => {}),
  listDocuments: vi.fn(async () => []), listItemDocuments: vi.fn(async () => [
    { id: 'one', link_id: 'link-one', title: 'First', visibility: 'private', category: 'transcript' },
    { id: 'two', link_id: 'link-two', title: 'Second', visibility: 'public', category: 'transcript' },
  ]),
  setDocumentLinkVisibility: vi.fn(async () => {}), unlinkDocument: vi.fn(async () => {}),
  formatSize: () => '', findDuplicate: () => null, validateDocumentFile: () => '',
  linkDocument: vi.fn(), uploadDocument: vi.fn(), openDocument: vi.fn(),
  documentUsage: vi.fn(), deleteDocumentEverywhere: vi.fn(), usageSentence: vi.fn(),
}))
afterEach(() => { cleanup(); vi.clearAllMocks() })
it('shows multiple requirement files with link-specific removal and visibility', async () => {
  render(<ProofBlock section="application" itemId="app" userId="student" label="transcript" allowVisibility />)
  await screen.findByText('First')
  expect(screen.getByText('Second')).toBeInTheDocument()
  expect(listItemDocuments).toHaveBeenCalledWith('application', 'app', 'transcript')
  fireEvent.click(screen.getByRole('button', { name: 'Make public First' }))
  await waitFor(() => expect(setDocumentLinkVisibility).toHaveBeenCalledWith('student', 'link-one', 'public'))
  fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0])
  await waitFor(() => expect(unlinkDocument).toHaveBeenCalledWith('application', 'app', 'one', 'transcript'))
})
