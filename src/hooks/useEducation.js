/** ============================================================================
 * useEducation — one hook for the Education page list
 * ============================================================================
 * Owns the list, the loading/error state and every mutation. Mutations are
 * optimistic with rollback, except create (which needs the database id).
 * The selected entry and the filter live in the URL (?type=…&id=…), owned by
 * the page, not by this hook.
 * ============================================================================ */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createEntry, deleteEntry, duplicateEntry, listEducation, updateEntry,
} from '../Services/educationApi'

export function useEducation(userId) {
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
        const rows = await listEducation(userId)
        if (!cancelled) setItems(rows)
      } catch (cause) {
        if (!cancelled) setError(cause?.message || 'Could not load your education.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [userId, attempt])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  /** Refresh from the database (e.g. after grade rows were synced directly). */
  const reload = useCallback(() => { setAttempt((value) => value + 1) }, [])

  const nextOrder = useCallback(() => itemsRef.current
    .reduce((max, item) => Math.max(max, Number(item.sort_order || 0)), -1) + 1, [])

  const create = useCallback(async (fields) => {
    const created = await createEntry(userId, { ...fields, sort_order: nextOrder() })
    const row = { ...created, grades: [] }
    setItems((prev) => [...prev, row])
    return row
  }, [userId, nextOrder])

  const update = useCallback(async (id, fields) => {
    const snapshot = itemsRef.current
    const before = snapshot.find((item) => item.id === id)
    if (!before) return null
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...fields } : item)))
    try {
      const saved = await updateEntry(userId, id, fields)
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...saved } : item)))
      return saved
    } catch (cause) {
      setItems(snapshot)
      throw cause
    }
  }, [userId])

  /** Keep a patched row (grades saved through syncGradeRows) in the list. */
  const patch = useCallback((id, fields) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...fields } : item)))
  }, [])

  const remove = useCallback(async (id) => {
    const snapshot = itemsRef.current
    setItems((prev) => prev.filter((item) => item.id !== id))
    try {
      await deleteEntry(userId, id)
    } catch (cause) {
      setItems(snapshot)
      throw cause
    }
  }, [userId])

  const duplicate = useCallback(async (entry) => {
    const copy = await duplicateEntry(userId, entry, nextOrder())
    const row = { ...copy, grades: entry.grades || [] }
    setItems((prev) => [...prev, row])
    return row
  }, [userId, nextOrder])

  return { items, loading, error, retry, reload, create, update, patch, remove, duplicate }
}
