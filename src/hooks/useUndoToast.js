/** ============================================================================
 * useUndoToast — toast with an Undo (or custom action) for 6 seconds.
 * Used for delete / create actions across sections.
 * ============================================================================ */
import { useCallback, useRef, useState } from 'react'

export function useUndoToast() {
  const [toast, setToast] = useState(null)
  const timer = useRef(null)

  const showToast = useCallback((message, action) => {
    clearTimeout(timer.current)
    setToast({ message, action })
    timer.current = setTimeout(() => setToast(null), 6000)
  }, [])

  const hideToast = useCallback(() => {
    clearTimeout(timer.current)
    setToast(null)
  }, [])

  return { toast, showToast, hideToast }
}

export default useUndoToast
