// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import DocumentGroup from '../src/components/DocumentGroup'
const db = vi.hoisted(() => ({ upsert: vi.fn(async () => ({ error: null })) }))
vi.mock('../src/lib/supabase', () => ({ supabase: { from: () => ({
  select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }),
  upsert: db.upsert,
}) } }))
it('saves requirement status even when there are no attached files', async () => {
  render(<DocumentGroup studentId="test-user" application={{ id: 'test-app', documents: {} }} category={{ key: 'transcript', label: 'Transcript' }} />)
  const select = await screen.findByRole('combobox', { name: 'Transcript status' })
  await waitFor(() => expect(select).toBeEnabled())
  fireEvent.change(select, { target: { value: 'submitted' } })
  await waitFor(() => expect(db.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'test-user', application_id: 'test-app', req_key: 'transcript', status: 'submitted' }), { onConflict: 'application_id,req_key' }))
})
