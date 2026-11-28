// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter } from 'react-router-dom'
import EducationSection from '../src/components/academic/EducationSection'
import { linkDocument, documentUsage, deleteDocumentEverywhere } from '../src/Services/documentsApi'

vi.mock('../src/lib/supabase', () => ({ supabase: {} }))
const create = vi.fn(async (fields) => ({ ...fields, entry_type: 'university' }))
vi.mock('../src/hooks/useEducation', () => ({ useEducation: () => ({ items: [], loading: false, create, reload: vi.fn() }) }))
vi.mock('../src/Services/documentsApi', () => ({ linkDocument: vi.fn(), documentUsage: vi.fn(), deleteDocumentEverywhere: vi.fn() }))
vi.mock('../src/components/academic/EducationPanel', () => ({ default: (props) => <div>
  <button onClick={() => props.onPendingChange([{ id: 'picked', title: 'Picked' }])}>Pick</button>
  <button onClick={() => { props.onPendingChange([...props.pendingFiles, { id: 'upload', title: 'Upload' }]); props.onUploaded([{ id: 'upload', title: 'Upload' }]) }}>Upload mock</button>
  <button onClick={() => props.onCreate({ id: 'client-id' }, [], props.pendingFiles)}>Create mock</button>
  <button onClick={props.onRequestDiscard}>Close mock</button>
</div> }))
afterEach(() => { cleanup(); vi.clearAllMocks() })
function start() { render(<MemoryRouter><EducationSection userId="test" /></MemoryRouter>); fireEvent.click(screen.getAllByRole('button', { name: 'Add education' })[0]) }
it('links picked and uploaded files after creating the client-id entry', async () => {
  start(); fireEvent.click(screen.getByText('Pick')); fireEvent.click(screen.getByText('Upload mock')); fireEvent.click(screen.getByText('Create mock'))
  await waitFor(() => expect(linkDocument).toHaveBeenCalledTimes(2))
  expect(create).toHaveBeenCalledWith({ id: 'client-id' })
  expect(linkDocument).toHaveBeenCalledWith('test', 'education', 'client-id', 'picked')
  expect(linkDocument).toHaveBeenCalledWith('test', 'education', 'client-id', 'upload')
})
it('discards only unused new uploads, never picked files', async () => {
  documentUsage.mockResolvedValue({ total: 0 }); deleteDocumentEverywhere.mockResolvedValue([])
  start(); fireEvent.click(screen.getByText('Pick')); fireEvent.click(screen.getByText('Upload mock')); fireEvent.click(screen.getByText('Close mock'))
  fireEvent.click(screen.getByText('Discard and delete unused uploads'))
  await waitFor(() => expect(deleteDocumentEverywhere).toHaveBeenCalledWith('upload'))
  expect(deleteDocumentEverywhere).toHaveBeenCalledTimes(1)
  expect(create).not.toHaveBeenCalled()
})
