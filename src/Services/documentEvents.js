// Document-only changes should not invalidate unrelated dashboard data.
const listeners = new Set()
export function onDocumentsChanged(callback) {
  listeners.add(callback)
  return () => listeners.delete(callback)
}
export function notifyDocumentsChanged() {
  for (const callback of listeners) callback()
}
