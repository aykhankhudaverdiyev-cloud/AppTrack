/**
 * ============================================================================
 * useProjects — the Projects page list (create / update / delete / undo)
 * ============================================================================
 * Optimistic with rollback: the UI never waits for a round trip, and a failed
 * write restores exactly what was on screen before.
 * ============================================================================
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createProject, deleteProject, duplicateProject, listProjects, restoreProject, updateProject,
} from '../Services/projectsApi'
import { rowFromDraft, sortProjects } from '../utils/projects'

export function useProjects(userId) {
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
        const rows = await listProjects(userId)
        if (!cancelled) setItems(rows)
      } catch (cause) {
        if (!cancelled) setError(cause?.message || 'Could not load your projects.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [userId, attempt])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  const create = useCallback(async (draft) => {
    const created = await createProject(userId, draft)
    setItems((prev) => sortProjects([...prev, created]))
    return created
  }, [userId])

  const update = useCallback(async (id, draft) => {
    const snapshot = itemsRef.current
    const before = snapshot.find((item) => item.id === id)
    if (!before) return null
    const optimistic = { ...before, ...rowFromDraft(draft) }
    setItems((prev) => prev.map((item) => (item.id === id ? optimistic : item)))
    try {
      const saved = await updateProject(userId, id, draft)
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
      await deleteProject(userId, id)
      return { row }
    } catch (cause) {
      setItems(snapshot)
      throw cause
    }
  }, [userId])

  const restore = useCallback(async (row) => {
    const restored = await restoreProject(userId, row)
    setItems((prev) => sortProjects([...prev, restored]))
    return restored
  }, [userId])

  const duplicate = useCallback(async (id) => {
    const source = itemsRef.current.find((item) => item.id === id)
    if (!source) throw new Error('That project no longer exists.')
    const copy = await duplicateProject(userId, source)
    setItems((prev) => sortProjects([...prev, copy]))
    return copy
  }, [userId])

  return { items, loading, error, retry, create, update, remove, restore, duplicate }
}

export default useProjects
