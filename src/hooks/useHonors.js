/** ============================================================================
 * useHonors — one hook for the Honors & Awards list (spec §3)
 * ============================================================================
 * Owns the list, loading/error state and every mutation. Optimistic with
 * rollback. Drag reorder goes through rpc('reorder_honors', …); the database
 * recomputes top5_order after any reorder or top-5 toggle.
 * ============================================================================ */

import { useCallback, useEffect, useRef, useState } from 'react'
import { rowFromDraft } from '../utils/honors.js'
import {
  createHonor, deleteHonor, duplicateHonor, listHonors, reorderHonors,
  restoreHonor, updateHonor,
} from '../Services/honorsApi'

const byRank = (items) => [...items].sort((a, b) => {
  const order = Number(a.sort_order || 0) - Number(b.sort_order || 0)
  return order !== 0 ? order : String(a.created_at || '').localeCompare(String(b.created_at || ''))
})

export function useHonors(userId) {
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
        const rows = await listHonors(userId)
        if (!cancelled) setItems(rows)
      } catch (cause) {
        if (!cancelled) setError(cause?.message || 'Could not load your honors.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [userId, attempt])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  const create = useCallback(async (draft) => {
    const nextOrder = itemsRef.current.reduce((max, item) => Math.max(max, Number(item.sort_order || 0)), -1) + 1
    const created = await createHonor(userId, draft, nextOrder)
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
      const saved = await updateHonor(userId, id, draft)
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
      await deleteHonor(userId, id)
      return { row, index }
    } catch (cause) {
      setItems(snapshot)
      throw cause
    }
  }, [userId])

  const restore = useCallback(async (row) => {
    const restored = await restoreHonor(userId, row)
    setItems((prev) => byRank([...prev, restored]))
    return restored
  }, [userId])

  const duplicate = useCallback(async (id) => {
    const snapshot = itemsRef.current
    const index = snapshot.findIndex((item) => item.id === id)
    if (index === -1) throw new Error('That honor no longer exists.')
    const source = snapshot[index]
    const copy = await duplicateHonor(userId, source, Number(source.sort_order || 0) + 1)
    const next = [...snapshot.slice(0, index + 1), copy, ...snapshot.slice(index + 1)]
    setItems(next.map((item, position) => ({ ...item, sort_order: position })))
    try {
      await reorderHonors(next.map((item) => item.id))
    } catch (cause) {
      // The copy was inserted, but its desired rank was not saved.
      setItems(byRank([...snapshot, copy]))
      throw cause
    }
    return copy
  }, [userId])

  const reorder = useCallback(async (ordered) => {
    const snapshot = itemsRef.current
    const ranked = ordered.map((item, index) => ({ ...item, sort_order: index }))
    setItems(ranked)
    try {
      await reorderHonors(ranked.map((item) => item.id))
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

  const setTop5 = useCallback(async (id, on) => {
    const snapshot = itemsRef.current
    const row = snapshot.find((item) => item.id === id)
    if (!row) return
    const optimistic = { ...row, is_top5_commonapp: on }
    setItems((prev) => prev.map((item) => (item.id === id ? optimistic : item)))
    try {
      await updateHonor(userId, id, { is_top5_commonapp: on })
      // top5_order is recomputed by the database; re-read to stay in sync.
      const rows = await listHonors(userId)
      setItems(rows)
    } catch (cause) {
      setItems(snapshot)
      throw cause
    }
  }, [userId])

  return { items, loading, error, retry, create, update, remove, restore, duplicate, reorder, moveToTop, setTop5 }
}

export default useHonors
