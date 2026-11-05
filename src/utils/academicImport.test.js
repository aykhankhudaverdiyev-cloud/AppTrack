import process from 'node:process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

test('academic import retries safely after a partial failure and retains legacy data', async () => {
  process.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
  process.env.VITE_SUPABASE_ANON_KEY = 'test-key'
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { importLegacyAcademicLibrary } = await vite.ssrLoadModule('/src/Services/ProfileServiceV2.js')
    const { supabase } = await vite.ssrLoadModule('/src/lib/supabase.js')
    const db = {}
    let fail = true
    supabase.from = table => ({ upsert: async rows => {
      if (table === 'test_attempts' && fail) { fail = false; return { error: new Error('network') } }
      db[table] ||= new Map()
      for (const row of rows) if (!db[table].has(row.id)) db[table].set(row.id, row)
      return { error: null }
    } })
    const data = new Map([
      ['apptrack.education.u', JSON.stringify([{ id: 1, school: 'School', years: '2020–24' }])],
      ['apptrack.test_scores.u', JSON.stringify([{ id: 2, test: 'SAT', score: '1500', date: '2024-01-02' }])],
    ])
    const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }
    await assert.rejects(importLegacyAcademicLibrary('u', storage), /network/)
    assert.equal(data.get('apptrack.academic_migrated.u'), undefined)
    assert.equal(await importLegacyAcademicLibrary('u', storage), 2)
    assert.equal(db.education_entries.size, 1)
    assert.equal(db.test_attempts.size, 1)
    assert.equal(await importLegacyAcademicLibrary('u', storage), 0)
    assert.ok(data.has('apptrack.education.u'))
    assert.ok(data.has('apptrack.test_scores.u'))
  } finally {
    await vite.close()
  }
})
