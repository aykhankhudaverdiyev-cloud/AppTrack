/** ============================================================================
 * useTests — one hook for the Test Scores list (spec §4)
 * ============================================================================
 * Optimistic with rollback. Best-attempt toggling goes through one DB call
 * (rpc('set_best_test_attempt', …)); sections are saved atomically with
 * rpc('save_test_sections', …).
 * ============================================================================ */

import { useCallback, useEffect, useRef, useState } from 'react'
import { rowFromDraft, testSortKey } from '../utils/tests.js'
import {
  createTest, deleteTest, duplicateTest, listTests, restoreTest, saveSections as saveSectionsApi, setBestTest, updateTest,
} from '../Services/testsApi'

export function useTests(userId) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const itemsRef = useRef(items)

  useEffect(() => { itemsRef.current = items }, [items])

  useEffect(() => {
    if (!userId) return undefined
    let cancelled = false
    Promise.resolve().then(async () => {
      if (cancelled) return
      setLoading(true)
      setError('')
      try {
        const rows = await listTests(userId)
        if (!cancelled) setItems(rows)
      } catch (cause) {
        if (!cancelled) setError(cause?.message || 'Could not load your test scores.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [userId, attempt])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  const sorted = useCallback(() => [...itemsRef.current].sort((a, b) => testSortKey(a).localeCompare(testSortKey(b))), [])

  const create = useCallback(async (draft) => {
    const created = await createTest(userId, draft)
    setItems(sorted().concat([created]).sort((a, b) => testSortKey(a).localeCompare(testSortKey(b))))
    return created
  }, [userId, sorted])

  const update = useCallback(async (id, draft) => {
    const snapshot = itemsRef.current
    const before = snapshot.find((item) => item.id === id)
    if (!before) return null
    const optimistic = { ...before, ...rowFromDraft(draft) }
    setItems((prev) => prev.map((item) => (item.id === id ? optimistic : item)))
    try {
      const saved = await updateTest(userId, id, draft)
      setItems((prev) => prev.map((item) => (item.id === id ? saved : item)))
      return saved
    } catch (cause) {
      setItems(snapshot)
      throw cause
    }
  }, [userId])

  const remove = useCallback(async (id) => {
    const snapshot = itemsRef.current
    const row = snapshot.find((item) => item.id === id)
    setItems((prev) => prev.filter((item) => item.id !== id))
    try {
      await deleteTest(userId, id)
      return { row }
    } catch (cause) {
      setItems(snapshot)
      throw cause
    }
  }, [userId])

  const restore = useCallback(async (row) => {
    const restored = await restoreTest(userId, row)
    setItems((prev) => [...prev, restored].sort((a, b) => testSortKey(a).localeCompare(testSortKey(b))))
    return restored
  }, [userId])

  const duplicate = useCallback(async (id) => {
    const source = itemsRef.current.find((item) => item.id === id)
    if (!source) throw new Error('That test no longer exists.')
    const copy = await duplicateTest(userId, source)
    setItems((prev) => [...prev, copy].sort((a, b) => testSortKey(a).localeCompare(testSortKey(b))))
    return copy
  }, [userId])

  const saveSections = useCallback(async (id, sections) => {
    await saveSectionsApi(id, sections)
  }, [])

  const setBest = useCallback(async (id, on) => {
    const snapshot = itemsRef.current
    const row = snapshot.find((item) => item.id === id)
    if (!row) return
    const optimistic = { ...row, is_best: on }
    setItems((prev) => prev.map((item) => (item.id === id ? optimistic : item)))
    try {
      await setBestTest(id, on)
      const rows = await listTests(userId)
      setItems(rows)
    } catch (cause) {
      setItems(snapshot)
      throw cause
    }
  }, [userId])

  return { items, loading, error, retry, sorted, create, update, remove, restore, duplicate, setBest, saveSections }
}

export default useTests
