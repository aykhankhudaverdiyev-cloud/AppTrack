/**
 * ============================================================================
 * useActivities — one hook for the Activities list (spec §8)
 * ============================================================================
 * Owns the list, the loading/error state and every mutation. All mutations are
 * optimistic with rollback: the UI never waits for the round trip, and a failed
 * write restores exactly what was on screen before.
 * ============================================================================
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createActivity, deleteActivity, duplicateActivity, listActivities, reorderActivities,
  restoreActivity, updateActivity,
} from '../Services/activitiesApi'
import { rowFromDraft } from '../utils/activities'

const byRank = (items) => [...items].sort((a, b) => {
  const order = Number(a.sort_order || 0) - Number(b.sort_order || 0)
  return order !== 0 ? order : String(a.created_at || '').localeCompare(String(b.created_at || ''))
})

export function useActivities(userId) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const itemsRef = useRef(items)

  useEffect(() => { itemsRef.current = items }, [items])

  useEffect(() => {
    if (!userId) return undefined
    let cancelled = false
    // Kick off in a microtask so the effect body itself never sets state.
    Promise.resolve().then(async () => {
      if (cancelled) return
      setLoading(true)
      setError('')
      try {
        const rows = await listActivities(userId)
        if (!cancelled) setItems(rows)
      } catch (cause) {
        if (!cancelled) setError(cause?.message || 'Could not load your activities.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [userId, attempt])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  const create = useCallback(async (draft) => {
    const nextOrder = itemsRef.current.reduce((max, item) => Math.max(max, Number(item.sort_order || 0)), -1) + 1
    const created = await createActivity(userId, draft, nextOrder)
    setItems((prev) => byRank([...prev, created]))
    return created
  }, [userId])

  const update = useCallback(async (id, draft) => {
    const snapshot = itemsRef.current
    const before = snapshot.find((item) => item.id === id)
    if (!before) return null
    const optimistic = { ...before, ...rowFromDraft(draft) }
    setItems((prev) => prev.map((item) => (item.id === id ? optimistic : item)))
    try {
      const saved = await updateActivity(userId, id, draft)
      setItems((prev) => prev.map((item) => (item.id === id ? saved : item)))
      return saved
    } catch (cause) {
      setItems(snapshot)
      throw cause
    }
  }, [userId])

  const remove = useCallback(async (id) => {
    const snapshot = itemsRef.current
    const index = snapshot.findIndex((item) => item.id === id)
    const row = snapshot[index]
    setItems((prev) => prev.filter((item) => item.id !== id))
    try {
      await deleteActivity(userId, id)
      return { row, index }
    } catch (cause) {
      setItems(snapshot)
      throw cause
    }
  }, [userId])

  const restore = useCallback(async (row) => {
    const restored = await restoreActivity(userId, row)
    setItems((prev) => byRank([...prev, restored]))
    return restored
  }, [userId])

  const duplicate = useCallback(async (id) => {
    const snapshot = itemsRef.current
    const index = snapshot.findIndex((item) => item.id === id)
    if (index === -1) throw new Error('That activity no longer exists.')
    const source = snapshot[index]
    const copy = await duplicateActivity(userId, source, Number(source.sort_order || 0) + 1)
    const next = [...snapshot.slice(0, index + 1), copy, ...snapshot.slice(index + 1)]
    setItems(next.map((item, position) => ({ ...item, sort_order: position })))
    try {
      await reorderActivities(next.map((item) => item.id))
    } catch {
      // The copy exists; only the rank normalisation failed. Keep the local
      // order and let the next reorder fix the numbering.
    }
    return copy
  }, [userId])

  const reorder = useCallback(async (ordered) => {
    const snapshot = itemsRef.current
    const ranked = ordered.map((item, index) => ({ ...item, sort_order: index }))
    setItems(ranked)
    try {
      await reorderActivities(ranked.map((item) => item.id))
    } catch (cause) {
      setItems(snapshot)
      throw cause
    }
  }, [])

  const moveToTop = useCallback(async (id) => {
    const snapshot = itemsRef.current
    const row = snapshot.find((item) => item.id === id)
    if (!row) return
    await reorder([row, ...snapshot.filter((item) => item.id !== id)])
  }, [reorder])

  return { items, loading, error, retry, create, update, remove, restore, duplicate, reorder, moveToTop }
}

export default useActivities
