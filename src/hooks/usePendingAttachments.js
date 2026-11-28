import { useCallback, useState } from 'react'
import { deleteDocumentEverywhere, documentUsage, linkDocument } from '../Services/documentsApi'
import { notifyDocumentsChanged } from '../Services/documentEvents'

// Kept at section level so a failed link can be retried after the create panel closes.
export function usePendingAttachments(userId, section) {
  const [id, setId] = useState(() => crypto.randomUUID())
  const [files, setFiles] = useState([])
  const [uploads, setUploads] = useState([])
  const [failed, setFailed] = useState({})
  const [discardAction, setDiscardAction] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const uploaded = useCallback((docs) => setUploads((previous) => [...previous, ...docs]), [])
  const deleted = useCallback((doc) => setUploads((previous) => previous.filter((file) => file.id !== doc.id)), [])
  const requestDiscard = useCallback((action) => setDiscardAction(() => action), [])
  const finish = useCallback(() => { setFiles([]); setUploads([]); setId(crypto.randomUUID()); setError('') }, [])
  const attach = useCallback(async (itemId) => {
    const results = await Promise.allSettled(files.map((file) => linkDocument(userId, section, itemId, file.id, { notify: false })))
    const unsuccessful = files.filter((_, index) => results[index].status === 'rejected')
    if (results.some((result) => result.status === 'fulfilled')) notifyDocumentsChanged()
    if (unsuccessful.length) setFailed((previous) => ({ ...previous, [itemId]: unsuccessful }))
    finish()
    return unsuccessful
  }, [files, userId, section, finish])
  const retry = useCallback(async (itemId, file) => {
    try {
      await linkDocument(userId, section, itemId, file.id)
      setFailed((previous) => ({ ...previous, [itemId]: (previous[itemId] || []).filter((doc) => doc.id !== file.id) }))
    } catch { setError('Could not attach this file. Please try again.'); throw new Error('Could not attach this file.') }
  }, [section, userId])
  const discard = useCallback(async (removeUploads) => {
    if (busy || !discardAction) return
    setBusy(true); setError('')
    try {
      if (removeUploads) for (const file of uploads) {
        const usage = await documentUsage(file.id)
        if (!usage.total) await deleteDocumentEverywhere(file.id)
        setUploads((previous) => previous.filter((doc) => doc.id !== file.id))
        if (!usage.total) setFiles((previous) => previous.filter((doc) => doc.id !== file.id))
      }
      // Remove the persisted text draft when navigating away from the panel.
      try { sessionStorage.removeItem(`apptrack:create:${({ activity: 'activities', project: 'projects', honor: 'honors', test: 'tests' }[section])}:${userId}`) } catch { /* Storage may be unavailable. */ }
      finish(); setDiscardAction(null); discardAction()
    } catch { setError('Could not delete all uploaded files. Try again or keep the remaining files.') }
    finally { setBusy(false) }
  }, [busy, discardAction, uploads, userId, section, finish])
  return { id, files, setFiles, uploads, uploaded, deleted, failed, retry, attach, requestDiscard, discardAction, setDiscardAction, discard, busy, error }
}
