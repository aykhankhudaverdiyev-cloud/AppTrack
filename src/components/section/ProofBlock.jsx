/** ============================================================================
 * ProofBlock — the "PROOF" section every panel shares
 * ============================================================================
 * One component, one upload modal, the same rows on every section:
 *   • the list of files attached to this item (title · size · date)
 *   • "Upload" and "Choose from Documents"
 *   • per file: View · Remove link · ⋯ (View file / Delete file…)
 *
 * Everything lives in public.item_documents, so the Documents page shows the
 * same rows and deleting a file in one place updates every other section.
 *
 * The upload modal takes several files at once: drag & drop, per-file title,
 * category, progress, Cancel, Retry, and a duplicate check ("You already
 * uploaded this file." + Use existing). Links are created for every file that
 * finishes, then the list refreshes without a page reload.
 * ============================================================================ */

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { onDocumentsChanged, notifyDocumentsChanged } from '../../Services/documentEvents'
import FilterChips from './FilterChips'
import FileIcon from './FileIcon'
import { formatDate } from '../../utils/dates'
import { InlineError } from '../forms/PanelValidation'
import ConfirmDialog from '../forms/ConfirmDialog'
import {
  DOCUMENT_CATEGORIES, SECTION_CATEGORIES, deleteDocumentEverywhere, documentUsage,
  findDuplicate, formatSize, linkDocument, listDocuments, listItemDocuments, cachedDocuments, cachedDocumentUsage, primeDocumentUsage,
  openDocument, unlinkDocument, uploadDocument, usageSentence, validateDocumentFile, setDocumentLinkVisibility,
} from '../../Services/documentsApi'
import './section.css'

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.docx,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/** <dialog> in every modern browser; a plain open attribute as a fallback. */
function openDialog(element) {
  if (!element) return
  if (typeof element.showModal === 'function') element.showModal()
  else element.setAttribute('open', '')
}


/* ---------------------------------------------------------------------------
 * Upload modal
 * ------------------------------------------------------------------------- */

export function UploadModal({ open, section, itemId, userId, existing, onClose, onLinked, onUploading, onUploadFinished, libraryOnly = false, deferLink = false, label }) {
  const dialog = useRef(null)
  const input = useRef(null)
  const id = useId()
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef(null)
  const [error, setError] = useState('')
  const [library, setLibrary] = useState(null)

  const categories = SECTION_CATEGORIES[section] || ['other']
  useEffect(() => () => clearTimeout(closeTimer.current), [])

  useEffect(() => {
    if (!open) return undefined
    const element = dialog.current
    const opener = document.activeElement
    openDialog(element)
    return () => { element?.close?.(); opener?.focus?.() }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    if (libraryOnly) return undefined
    let active = true
    listDocuments(userId).then((rows) => { if (active) setLibrary(rows) })
      .catch(() => { if (active) setError('Could not check your document library. Please close and try again.') })
    return () => { active = false }
  }, [open, userId, libraryOnly])

  const addFiles = (fileList) => {
    const next = [...fileList].map((file) => {
      const invalid = validateDocumentFile(file)
      const duplicate = invalid ? null : findDuplicate(libraryOnly ? existing : library || [], file)
      return {
        key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        title: file.name.replace(/\.[^.]+$/, '').slice(0, 200),
        category: categories[0] || 'other',
        status: invalid ? 'error' : duplicate ? 'duplicate' : 'ready',
        message: invalid || (duplicate ? 'You already uploaded this file.' : ''),
        duplicate,
        progress: 0,
      }
    })
    setItems((previous) => [...previous, ...next])
    setError('')
    if (input.current) input.current.value = ''
  }

  const patchItem = (key, patch) => setItems((previous) => previous
    .map((item) => (item.key === key ? { ...item, ...patch } : item)))

  const applyExisting = async (item) => {
    if (!item.duplicate) return
    try {
      if (!libraryOnly && !deferLink) await linkDocument(userId, section, itemId, item.duplicate.id, { label })
      onLinked?.([item.duplicate], { uploaded: false })
      setItems((previous) => previous.filter((entry) => entry.key !== item.key))
    } catch (error) {
      patchItem(item.key, { message: error?.message || 'Could not attach this file. Try again.' })
    }
  }

  const uploadAll = async () => {
    const ready = items.filter((item) => item.status === 'ready')
    if (!ready.length || busy) return
    setBusy(true)
    setError('')
    const linked = []
    onUploading?.(ready.map((item) => ({ id: item.key, title: item.title, mime_type: item.file.type, size_bytes: item.file.size, category: item.category })))
    let changed = false
    let next = 0
    const worker = async () => {
      while (next < ready.length) {
        const item = ready[next++]
        patchItem(item.key, { status: 'uploading', progress: 1 })
        try {
          const doc = item.uploaded || await uploadDocument(userId,
            { file: item.file, title: item.title, category: item.category },
            (percent) => patchItem(item.key, { progress: Math.max(1, percent) }), { notify: false })
          changed = true
          patchItem(item.key, { uploaded: doc })
          if (!libraryOnly && !deferLink) await linkDocument(userId, section, itemId, doc.id, { notify: false, ...(label ? { label } : {}) })
          patchItem(item.key, { status: 'done', progress: 100 })
          linked.push(doc)
        } catch (cause) {
          patchItem(item.key, { status: 'failed', progress: 0,
            message: cause?.message?.includes('10 MB') || cause?.message?.includes('another requirement') ? cause.message : 'Upload failed. Please try again.' })
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, ready.length) }, () => worker()))
    if (changed) notifyDocumentsChanged()
    onUploadFinished?.(ready.map((item) => item.key))
    setBusy(false)
    if (linked.length) onLinked?.(linked, { uploaded: true })
    if (linked.length === ready.length) finishClose()
  }

  const finishClose = () => { setClosing(true); closeTimer.current = setTimeout(() => { setItems([]); setLibrary(null); setClosing(false); onClose?.() }, 150) }
  const close = () => { if (!busy && !closing) finishClose() }
  const pending = items.filter((item) => item.status === 'ready' || item.status === 'failed')

  if (!open) return null

  return createPortal(
    <dialog ref={dialog} className={`document-modal${closing ? ' document-modal--closing' : ''}`} aria-labelledby={`${id}-title`}
      onCancel={(event) => { event.preventDefault(); close() }}
      onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); event.preventDefault(); close() } }}
      onClick={(event) => { if (event.target === event.currentTarget) close() }}>
      <div className="document-modal__box">
        <header className="document-modal__head">
          <h3 id={`${id}-title`}>Upload files</h3>
          <button type="button" className="document-modal__close" aria-label="Close upload" disabled={busy} onClick={() => close()}>×</button>
        </header>

        <div className="document-modal__body">
          <button type="button" className="document-modal__drop" disabled={!libraryOnly && library === null} onClick={() => input.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); if (libraryOnly || library !== null) addFiles(event.dataTransfer.files || []) }}>
            Drop files here or browse
            <span>PDF, JPG, PNG, DOCX · up to 10 MB each · you can pick several</span>
          </button>
          <input ref={input} hidden multiple type="file" accept={ACCEPT}
            onChange={(event) => addFiles(event.target.files || [])} />

          {items.length > 0 && (
            <ul className="upload-list">
              {items.map((item) => (
                <li key={item.key} className={`upload-row upload-row--${item.status}`}>
                  <FileIcon doc={item.file} />
                  <div className="upload-row__main">
                    <input
                      className="upload-row__title" value={item.title} maxLength={200}
                      aria-label={`Title for ${item.file.name}`}
                      disabled={item.status === 'uploading' || item.status === 'done'}
                      onChange={(event) => patchItem(item.key, { title: event.target.value })}
                    />
                    <div className="upload-row__meta">
                      <span>{formatSize(item.file.size)}</span>
                      <select
                        className="upload-row__category" value={item.category}
                        aria-label={`Category for ${item.file.name}`}
                        disabled={item.status === 'uploading' || item.status === 'done'}
                        onChange={(event) => patchItem(item.key, { category: event.target.value })}>
                        {Object.entries(DOCUMENT_CATEGORIES)
                          .filter(([key]) => categories.includes(key) || item.category === key)
                          .map(([key, label]) => <option key={key} value={key}>{section === 'activity' ? ({ award_certificate: 'Certificate', portfolio: 'Photos / portfolio', other: 'Other (letter, article, link screenshot)' }[key] || label) : label}</option>)}
                      </select>
                      {item.status === 'done' && <span className="upload-row__status">Uploaded ✓</span>}
                      {item.status === 'uploading' && <span className="upload-row__status"><span className="file-spinner" aria-hidden="true" /> Uploading… {item.progress}%</span>}
                    </div>
                    {item.message && <p className="upload-row__message" role="status">{item.message}</p>}
                    {(item.status === 'uploading' || item.status === 'done') && (
                      <div className="upload-row__track" aria-hidden="true">
                        <span style={{ width: `${item.progress}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="upload-row__actions">
                    {item.status === 'duplicate' && item.duplicate && (
                      <button type="button" className="document-modal__use" onClick={() => applyExisting(item)}>Use existing</button>
                    )}
                    {item.status === 'failed' && (
                      <button type="button" className="document-modal__use"
                        onClick={() => patchItem(item.key, { status: 'ready', message: '' })}>Retry</button>
                    )}
                    {item.status !== 'uploading' && item.status !== 'done' && (
                      <button type="button" className="document-modal__close" aria-label={`Remove ${item.file.name}`}
                        onClick={() => setItems((previous) => previous.filter((entry) => entry.key !== item.key))}>×</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <InlineError message={error} />
        </div>

        <footer className="document-modal__foot">
          <button type="button" className="edu-btn edu-btn--ghost" onClick={close} disabled={busy}>Cancel</button>
          <button type="button" className="edu-btn edu-btn--primary" disabled={busy || !pending.length} onClick={uploadAll}>
            {busy ? 'Uploading…' : `Upload ${pending.length} file${pending.length === 1 ? '' : 's'}`}
          </button>
        </footer>
      </div>
    </dialog>, document.body,
  )
}

/* ---------------------------------------------------------------------------
 * "Choose from Documents" modal
 * ------------------------------------------------------------------------- */

function ChooseModal({ open, userId, linked = [], onClose, onChoose, onUploadNew }) {
  const dialog = useRef(null)
  const id = useId()
  const [documents, setDocuments] = useState(() => cachedDocuments(userId))
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [selected, setSelected] = useState([])
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef(null)
  useEffect(() => () => clearTimeout(closeTimer.current), [])

  useEffect(() => {
    if (!open) return undefined
    const element = dialog.current
    const opener = document.activeElement
    openDialog(element)
    let active = true
    listDocuments(userId)
      .then((rows) => { if (active) setDocuments(rows) })
      .catch(() => { if (active) setDocuments([]) })
    return () => { active = false; element?.close?.(); opener?.focus?.() }
  }, [open, userId])

  const pickerDocs = cachedDocuments(userId) || documents
  const chips = useMemo(() => {
    const counts = {}
    for (const doc of pickerDocs || []) counts[doc.category] = (counts[doc.category] || 0) + 1
    return [{ key: 'all', label: 'All', count: (pickerDocs || []).length },
      ...Object.entries(counts).map(([key, count]) => ({ key, label: DOCUMENT_CATEGORIES[key] || key, count }))]
  }, [pickerDocs])

  const visible = useMemo(() => (pickerDocs || []).filter((doc) => {
    if (category !== 'all' && doc.category !== category) return false
    if (!query.trim()) return true
    return String(doc.title || '').toLowerCase().includes(query.trim().toLowerCase())
  }), [pickerDocs, category, query])

  const close = (afterClose) => { if (closing) return; setClosing(true); closeTimer.current = setTimeout(() => { setSelected([]); setQuery(''); setCategory('all'); setClosing(false); onClose?.(); afterClose?.() }, 150) }
  const toggle = (doc) => {
    if (linked.includes(doc.id)) return
    setSelected((previous) => (previous.includes(doc.id)
      ? previous.filter((value) => value !== doc.id)
      : [...previous, doc.id]))
  }
  const confirm = () => {
    const chosen = (pickerDocs || []).filter((doc) => selected.includes(doc.id))
    close(() => onChoose?.(chosen))
  }

  if (!open) return null

  return createPortal(
    <dialog ref={dialog} className={`document-modal document-modal--choose${closing ? ' document-modal--closing' : ''}`} aria-labelledby={`${id}-title`}
      onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); event.preventDefault(); close() } }}
      onCancel={(event) => { event.preventDefault(); close() }}
      onClick={(event) => { if (event.target === event.currentTarget) close() }}>
      <div className="document-modal__box">
        <header className="document-modal__head">
          <h3 id={`${id}-title`}>Choose from Documents</h3>
          <button type="button" className="document-modal__close" aria-label="Close picker" onClick={() => close()}>×</button>
        </header>
        <div className="document-modal__body">
          <input className="document-modal__search" type="search" value={query} placeholder="Search your documents"
            aria-label="Search your documents" onChange={(event) => setQuery(event.target.value)} />
          <FilterChips items={chips.slice(1)} value={category} onChange={setCategory} total={(documents || []).length} groupLabel="Filter by category" />
          {pickerDocs == null ? <p className="document-modal__empty">Loading documents…</p>
            : visible.length === 0 ? (
              <p className="document-modal__empty">
                {pickerDocs.length ? 'Nothing matches this search.' : 'No documents yet. Upload a file to get started.'}
              </p>
            ) : (
              <ul className="document-modal__list">
                {visible.map((doc) => {
                  const already = linked.includes(doc.id)
                  return (
                    <li key={doc.id} className={`document-modal__row${selected.includes(doc.id) ? ' document-modal__row--on' : ''}`}>
                      <label className={`document-modal__choice${already ? ' document-modal__choice--disabled' : ''}`}>
                        <FileIcon doc={doc} />
                        <span className="document-modal__details"><span className="document-modal__title" title={doc.title}>{doc.title}</span>
                          <span className="document-modal__meta">{[DOCUMENT_CATEGORIES[doc.category] || doc.category, formatSize(doc.size_bytes), doc.created_at ? formatDate(doc.created_at.slice(0, 10), 'day') : ''].filter(Boolean).join(' · ')}</span>
                        </span>
                        {already && <span className="document-modal__linked">Linked</span>}
                        <input type="checkbox" aria-label={doc.title} checked={selected.includes(doc.id)} disabled={already} onChange={() => toggle(doc)} />
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
        </div>
        <footer className="document-modal__foot">
          <button type="button" className="edu-btn edu-btn--ghost" onClick={() => close(onUploadNew)}>↑ Upload new</button>
          <span className="document-modal__count">{selected.length} selected</span>
          <button type="button" className="edu-btn edu-btn--ghost" onClick={() => close()}>Cancel</button>
          <button type="button" className="edu-btn edu-btn--primary" disabled={!selected.length} onClick={confirm}>
            {`Attach ${selected.length} file${selected.length === 1 ? '' : 's'}`}
          </button>
        </footer>
      </div>
    </dialog>, document.body,
  )
}

/* ---------------------------------------------------------------------------
 * The block itself
 * ------------------------------------------------------------------------- */

export default function ProofBlock({
  section, itemId, userId, title = 'Proof', hint, onChange, disabled = false, label, allowVisibility = false,
  pendingFiles = null, onPendingChange, onUploaded, onDeleted, failedFiles = [], onRetryFile,
}) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [chooseOpen, setChooseOpen] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [usage, setUsage] = useState(null)
  const [usageChecked, setUsageChecked] = useState(false)
  const usageRequest = useRef(0)
  const [actionError, setActionError] = useState('')
  const [retryAction, setRetryAction] = useState(null)
  const [hiddenIds, setHiddenIds] = useState([])
  const [uploadingRows, setUploadingRows] = useState([])
  const [reloadKey, setReloadKey] = useState(0)

  const refresh = () => setReloadKey((value) => value + 1)
  const pendingMode = pendingFiles !== null
  const shownFiles = pendingMode ? pendingFiles : files
  const initialLoading = !pendingMode && Boolean(itemId) && loading && files.length === 0

  useEffect(() => {
    if (!itemId || pendingMode) return undefined
    let active = true
    Promise.resolve().then(() => {
      if (!active) return
      setLoading(true)
      setLoadError('')
      return listItemDocuments(section, itemId, label)
        .then((rows) => { if (active) setFiles(rows) })
        .catch((cause) => { if (active) setLoadError(cause?.message || 'Could not load the attached files.') })
        .finally(() => { if (active) setLoading(false) })
    })
    return () => { active = false }
  }, [section, itemId, label, reloadKey, pendingMode])

  // Warm the usage snapshot while the panel is open; absence remains unknown.
  useEffect(() => { if (userId && shownFiles.length) primeDocumentUsage(userId).catch(() => {}) }, [userId, shownFiles.length])

  // Another section deleted a file → drop it here too, without a reload.
  useEffect(() => onDocumentsChanged(refresh), [])

  useEffect(() => { onChange?.(files) }, [files, onChange])

  const openChoose = () => { setActionError(''); setChooseOpen(true) }

  const linkMany = async (docs) => {
    if (pendingMode) { onPendingChange?.([...pendingFiles, ...docs.filter((doc) => !pendingFiles.some((file) => file.id === doc.id))]); setChooseOpen(false); return }
    const results = await Promise.allSettled(docs.map((doc) => linkDocument(userId, section, itemId, doc.id, { notify: false, ...(label ? { label } : {}) })))
    if (results.some((result) => result.status === 'fulfilled')) notifyDocumentsChanged()
    const failure = results.find((result) => result.status === 'rejected')
    if (failure) setActionError(failure.reason?.message || 'Could not link a file. Try again.')
    setChooseOpen(false)
  }

  const removeLink = async (doc) => {
    setActionError(''); setRetryAction(null)
    if (pendingMode) { onPendingChange?.(pendingFiles.filter((file) => file.id !== doc.id)); return }
    setHiddenIds((prev) => [...prev, doc.id])
    try {
      await Promise.all([unlinkDocument(section, itemId, doc.id, label), new Promise((resolve) => setTimeout(resolve, 150))])
      setFiles((previous) => previous.filter((file) => file.id !== doc.id))
      setHiddenIds((prev) => prev.filter((id) => id !== doc.id))
    } catch {
      setHiddenIds((prev) => prev.filter((id) => id !== doc.id))
      setActionError('Could not remove the link.')
      setRetryAction(() => () => removeLink(doc))
    }
  }

  const retryFailedLink = async (doc) => {
    try { await onRetryFile?.(doc); setActionError(''); setRetryAction(null) }
    catch { setActionError('Could not attach this file.'); setRetryAction(() => () => retryFailedLink(doc)) }
  }

  const view = async (doc) => {
    setActionError('')
    try { await openDocument(doc) } catch { setActionError('Could not open the file. Allow pop-ups and try again.') }
  }

  const askDelete = async (doc) => {
    setActionError('')
    const request = ++usageRequest.current
    setDeleting(doc)
    setUsage(cachedDocumentUsage(userId, doc.id))
    setUsageChecked(false)
    try {
      const fresh = await documentUsage(doc.id)
      if (request !== usageRequest.current) return
      setUsage((previous) => JSON.stringify(previous) === JSON.stringify(fresh) ? previous : fresh)
      setUsageChecked(true)
    } catch {
      if (request !== usageRequest.current) return
      setActionError('Could not check where this file is used. Please try again.')
      setDeleting(null)
    }
  }

  const deleteFile = async (doc) => {
    setActionError(''); setRetryAction(null); setHiddenIds((prev) => [...prev, doc.id])
    try {
      await Promise.all([deleteDocumentEverywhere(doc.id), new Promise((resolve) => setTimeout(resolve, 150))])
      setFiles((previous) => previous.filter((file) => file.id !== doc.id))
      if (pendingMode) { onPendingChange?.(pendingFiles.filter((file) => file.id !== doc.id)); onDeleted?.(doc) }
      setHiddenIds((prev) => prev.filter((id) => id !== doc.id))
    } catch {
      setHiddenIds((prev) => prev.filter((id) => id !== doc.id))
      setActionError('Could not delete the file.')
      setRetryAction(() => () => deleteFile(doc))
    }
  }
  const confirmDelete = () => { const doc = deleting; setDeleting(null); if (doc) deleteFile(doc) }

  return (
    <div className="proof">
      <div className="proof__head">
        <span className="proof__label">{title}</span>
        {!disabled && (
          <span className="proof__links">
            <button type="button" className="edu-link" onClick={openChoose}>Choose from Documents</button>
            <button type="button" className="edu-link" onClick={() => setUploadOpen(true)}>Upload</button>
          </span>
        )}
      </div>

      {initialLoading ? <p className="proof__empty">Loading files…</p>
        : loadError ? <InlineError message={loadError} />
          : shownFiles.length === 0 && failedFiles.length === 0 && uploadingRows.length === 0 ? (
            <p className="proof__empty">
              {hint || 'No files attached yet.'}
            </p>
          ) : (
            <ul className="proof__list">
              {uploadingRows.map((doc) => <li key={doc.id} className="proof__row"><FileIcon doc={doc} /><span className="proof__title">{doc.title}</span><span role="status"><span className="file-spinner" aria-hidden="true" /> Uploading…</span></li>)}
              {shownFiles.map((doc) => (
                <li key={doc.id} className={`proof__row${hiddenIds.includes(doc.id) ? ' file-row--hiding' : ''}`}>
                  <FileIcon doc={doc} />
                  <span className="proof__title" title={doc.title}>{doc.title}</span>
                  <span className="proof__meta">
                    {DOCUMENT_CATEGORIES[doc.category] || doc.category} · {formatSize(doc.size_bytes)}
                  </span>
                  <span className="proof__actions">
                    <button type="button" className="proof__link" onClick={() => view(doc)}>View</button>
                    {allowVisibility && !disabled && <button type="button" className="proof__link" aria-label={`${doc.visibility === 'public' ? 'Make private' : 'Make public'} ${doc.title}`} onClick={async () => {
                      try { await setDocumentLinkVisibility(userId, doc.link_id, doc.visibility === 'public' ? 'private' : 'public') }
                      catch { setActionError('Could not update file visibility. Please try again.') }
                    }}>{doc.visibility === 'public' ? '🌐 Public' : '🔒 Private'}</button>}
                    {!disabled && <button type="button" className="proof__link" onClick={() => removeLink(doc)}>Remove</button>}
                    {!disabled && (
                      <details className="proof__more">
                        <summary aria-label={`More actions for ${doc.title}`} title="More">⋯</summary>
                        <div className="proof__menu">
                          <button type="button" onClick={() => view(doc)}>View file</button>
                          <button type="button" className="proof__menu-danger" onClick={() => askDelete(doc)}>Delete file…</button>
                        </div>
                      </details>
                    )}
                  </span>
                </li>
              ))}
              {failedFiles.map((doc) => <li key={doc.id} className="proof__row">
                <span className="proof__title">{doc.title}</span><span>Not attached</span>
                <button type="button" className="proof__link" onClick={() => retryFailedLink(doc)}>Retry</button>
              </li>)}
            </ul>
          )}
      {pendingMode && shownFiles.length > 0 && <p className="proof__empty">These files will be attached when you create this entry.</p>}

      {actionError && <div className="toast" role="status">{actionError} {retryAction && <button type="button" onClick={retryAction}>Retry</button>}</div>}

      <UploadModal
        open={uploadOpen} section={section} itemId={itemId} userId={userId} label={label}
        existing={shownFiles} deferLink={pendingMode}
        onUploading={setUploadingRows} onUploadFinished={() => setUploadingRows([])}
        onClose={() => setUploadOpen(false)}
        onLinked={(docs, { uploaded } = {}) => {
          if (!pendingMode) return
          onPendingChange?.([...pendingFiles, ...docs.filter((doc) => !pendingFiles.some((file) => file.id === doc.id))])
          if (uploaded) onUploaded?.(docs)
        }}
      />
      <ChooseModal
        open={chooseOpen} userId={userId} linked={shownFiles.map((file) => file.id)} onClose={() => setChooseOpen(false)}
        onChoose={(docs) => linkMany(docs)} onUploadNew={() => setUploadOpen(true)}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this file?"
        message={usage ? `${usageSentence(usage, deleting?.title)} Deleting it removes it from all of them. This cannot be undone.` : 'Checking where this file is used…'}
        confirmLabel="Delete file" confirmDisabled={!usageChecked}
        onCancel={() => { usageRequest.current++; setDeleting(null) }}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
