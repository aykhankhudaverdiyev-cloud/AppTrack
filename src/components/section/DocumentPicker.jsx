import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { uploadDocument, listDocuments, documentUrl, validateDocumentFile } from '../../Services/documentApi'
import { formatDate } from '../../utils/dates'
import { InlineError } from '../forms/PanelValidation'

/**
 * DocumentPicker — choose one file from the student's library or upload a new
 * one, without leaving the page. The modal owns focus (native <dialog>).
 *
 * `trigger` lets a caller render its own trigger(s) instead of the stock
 * "📄 Add file" button: pass a render function that receives
 * `{ open, openUpload }` and call them from any control. The Education panel
 * uses this for its two links, "Choose from Documents" and "Upload".
 */
export default function DocumentPicker({
  value, category, userId, onChange, disabled, addLabel = 'Add file', trigger,
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('documents')
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [docs, setDocs] = useState([])
  const [error, setError] = useState('')
  const [viewError, setViewError] = useState('')
  const [file, setFile] = useState(null)
  const [drag, setDrag] = useState(false)
  const [retry, setRetry] = useState(false)
  const dialog = useRef(null)
  const input = useRef(null)
  const id = useId()

  useEffect(() => {
    if (!open) return undefined
    const element = dialog.current
    element.showModal()
    let active = true
    listDocuments(userId, [category]).then((rows) => {
      if (active) setDocs(rows)
    }, () => {
      if (active) setDocs(null)
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; element.close() }
  }, [open, userId, category])

  const launch = (startTab = 'documents') => {
    setTab(startTab); setError(''); setRetry(false); setFile(null); setLoading(true); setOpen(true)
  }
  const chooseFile = (next) => {
    const message = next ? validateDocumentFile(next) : ''
    setFile(message ? null : next); setError(message); setRetry(false)
    if (input.current) input.current.value = ''
  }
  const linkDocument = (doc) => { onChange(doc); setViewError(''); setOpen(false) }
  const upload = async () => {
    if (!file || !userId || uploading) return
    setUploading(true); setError(''); setRetry(false)
    try { linkDocument(await uploadDocument(userId, category, file)) }
    catch { setError('Upload failed. Please try again.'); setRetry(true) }
    finally { setUploading(false) }
  }
  const view = async () => {
    const popup = window.open('about:blank', '_blank')
    if (popup) popup.opener = null
    try {
      const url = await documentUrl(value.file_path, 60)
      if (!url) throw new Error('Missing URL')
      if (popup) popup.location.replace(url)
      else setViewError('Allow pop-ups to view this file.')
    } catch { popup?.close(); setViewError('Could not open the file. Try View again.') }
  }

  const modal = (
    <>
      <InlineError message={viewError} />
      {open && createPortal(<dialog ref={dialog} className="document-modal" aria-labelledby={`${id}-title`}
        onCancel={(event) => { event.preventDefault(); if (!uploading) setOpen(false) }}
        onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); event.preventDefault(); if (!uploading) setOpen(false) } }}
        onClick={(event) => { if (event.target === event.currentTarget && !uploading) setOpen(false) }}>
        <div className="document-modal__box">
          <header className="document-modal__head"><h3 id={`${id}-title`}>Choose a document</h3>
            <button type="button" aria-label="Close document picker" className="document-modal__close" disabled={uploading} onClick={() => setOpen(false)}>×</button>
          </header>
          <div className="document-modal__body">
            <div className="document-modal__tabs" role="group" aria-label="Document source">
              {['documents', 'upload'].map((item) => <button key={item} type="button" aria-pressed={tab === item} disabled={uploading}
                className={`document-modal__tab${tab === item ? ' document-modal__tab--on' : ''}`} onClick={() => setTab(item)}>
                {item === 'documents' ? 'Your documents' : 'Upload new'}
              </button>)}
            </div>
            {tab === 'documents' ? loading ? <p className="document-modal__empty">Loading documents…</p> : docs === null ? (
              <InlineError message="Could not load your documents. Reopen the picker to retry." />
            ) : docs.length ? (
              <ul className="document-modal__list">{docs.map((doc) => <li key={doc.id} className="document-modal__row">
                <span className="document-modal__title" title={doc.title}>{doc.title}</span>
                <time className="document-modal__meta">{formatDate(doc.created_at?.slice(0, 10), 'day')}</time>
                <button type="button" className="document-modal__use" onClick={() => linkDocument(doc)}>Use</button>
              </li>)}</ul>
            ) : <p className="document-modal__empty">No documents yet. Upload a file to get started.</p> : <>
              <input ref={input} hidden type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => chooseFile(event.target.files?.[0] || null)} />
              {file ? <div className="document-modal__row"><span className="document-modal__title">{file.name}</span>
                <span className="document-modal__meta">{file.size < 1024 ? `${file.size} B` : `${(file.size / 1024).toFixed(1)} KB`}</span>
                <button type="button" className="document-modal__close" aria-label="Remove selected file" disabled={uploading} onClick={() => chooseFile(null)}>×</button></div> : (
                <button type="button" className={`document-modal__drop${drag ? ' document-modal__drop--active' : ''}`} onClick={() => input.current.click()}
                  onDragOver={(event) => { event.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
                  onDrop={(event) => { event.preventDefault(); setDrag(false); chooseFile(event.dataTransfer.files[0] || null) }}>
                  Drop a file here or browse<span>PDF, JPG, PNG · max 10 MB</span>
                </button>
              )}
              <InlineError message={error} />
              <button type="button" className="document-modal__upload-btn" disabled={uploading || !file || !userId} onClick={upload}>
                {uploading ? 'Uploading…' : retry ? 'Retry' : 'Upload'}
              </button>
            </>}
          </div>
        </div>
      </dialog>, document.body)}
    </>
  )

  if (trigger) {
    return <>
      {trigger({ open: () => launch('documents'), openUpload: () => launch('upload'), launch, disabled })}
      {modal}
    </>
  }

  return <div className="document-picker">
    <div className="document-picker__row">
      {value ? <>
        <span aria-hidden="true">📄</span><span className="document-picker__title" title={value.title}>{value.title || 'Document'}</span>
        <button type="button" className="document-picker__view" onClick={view} disabled={!value.file_path}>View</button>
        <button type="button" className="document-picker__change" onClick={() => launch('documents')}>Change</button>
        <button type="button" className="document-picker__change" onClick={() => { setViewError(''); onChange(null) }}>Remove</button>
      </> : <button type="button" className="document-picker__add" disabled={disabled} onClick={() => launch('documents')}><span aria-hidden="true">📄</span> {addLabel}</button>}
    </div>
    {modal}
  </div>
}
