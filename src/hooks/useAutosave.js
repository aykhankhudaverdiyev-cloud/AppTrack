/**
 * ============================================================================
 * useAutosave / useUnsavedGuard — draft autosave + close warning (principle #8)
 * ============================================================================
 * Forms save drafts automatically (debounced). If there are unsaved changes,
 * closing the tab triggers the browser warning.
 *
 * const { saving, savedAt, error, markDirty, flush } = useAutosave(payload, saveFn)
 * useUnsavedGuard(isDirty)
 * ============================================================================
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export function useAutosave(payload, saveFn, { delay = 1200, enabled = true } = {}) {
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [error, setError] = useState(null)
  const [isDirty, setIsDirty] = useState(false)
  const timerRef = useRef(null)
  const latestRef = useRef(payload)
  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const revisionRef = useRef(0)
  const saveFnRef = useRef(saveFn)
  useEffect(() => { saveFnRef.current = saveFn }, [saveFn])

  // Keep the latest payload available to the debounced flush without
  // re-creating the callback (write happens in an effect, not during render).
  useEffect(() => {
    latestRef.current = payload
  }, [payload])

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (!dirtyRef.current || savingRef.current) return
    savingRef.current = true
    const revision = revisionRef.current
    setSaving(true)
    setError(null)
    try {
      await saveFnRef.current(latestRef.current)
      if (revisionRef.current === revision) { dirtyRef.current = false; setIsDirty(false) }
      setSavedAt(new Date())
    } catch (e) {
      setError(e)
    } finally {
      savingRef.current = false
      setSaving(false)
      if (dirtyRef.current && revisionRef.current !== revision) {
        timerRef.current = setTimeout(() => flush(), delay)
      }
    }
  }, [delay])

  const markDirty = useCallback(() => {
    dirtyRef.current = true
    setIsDirty(true)
    revisionRef.current += 1
  }, [])

  // Debounced autosave on every payload change.
  // NOTE: dirty is set explicitly via markDirty() by the consumer on real user
  // edits — otherwise mounting a form would trigger a save-on-load.
  useEffect(() => {
    if (!enabled) return undefined
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      flush()
    }, delay)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [payload, delay, enabled, flush])

  return { saving, savedAt, error, isDirty, markDirty, flush }
}

/**
 * Browser-level guard: warns before closing/reloading with unsaved changes.
 */
export function useUnsavedGuard(isDirty) {
  useEffect(() => {
    if (!isDirty) return undefined
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = '' // required for Chrome
      return ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])
}
