// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { saveApplicationRequirements } from '../src/Services/ProfileServiceV2'
const state = vi.hoisted(() => ({ calls: [] }))
vi.mock('../src/lib/supabase', () => ({ supabase: { from(table) {
  const query = {
    update(row) { state.calls.push({ table, update: row }); return this },
    delete() { state.calls.push({ table, delete: true }); return this },
    eq() { return this },
    in(key, values) { state.calls.push({ table, key, values }); return Promise.resolve({ error: null }) },
    upsert(rows, options) { state.calls.push({ table, rows, options }); return Promise.resolve({ error: null }) },
    then(resolve) { resolve({ error: null }) },
  }
  return query
} } }))
it('upserts by application and requirement key without deleting unseen rows', async () => {
  await saveApplicationRequirements('student', 'app', [{ id: 'local-id', reqKey: 'transcript', label: 'Transcript', status: 'done' }])
  const upsert = state.calls.find((call) => call.rows)
  expect(upsert.options).toEqual({ onConflict: 'application_id,req_key' })
  expect(upsert.rows[0]).toMatchObject({ user_id: 'student', application_id: 'app', req_key: 'transcript', status: 'done' })
  expect(upsert.rows[0]).not.toHaveProperty('id')
  expect(state.calls.some((call) => call.delete)).toBe(false)
})
