/** ============================================================================
 * DocumentPicker — shows the linked file (📄 · title · "From Documents" ·
 * "Change"). "Change" opens a modal: list the user's document_files of the
 * allowed category, or upload a new file.
 * ============================================================================ */
import { useState, useCallback } from 'react'
import { uploadDocument, listDocuments, documentUrl } from '../../Services/documentApi'

export default function DocumentPicker({
  value,
  category,
  userId,
  onChange,
  onView,
  disabled,
  addLabel = 'Add file',
}) {
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [docs, setDocs] = useState([])
  const [docsError, setDocsError] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [pickedId, setPickedId] = useState(value?.id || '')
  const [newFile, setNewFile] = useState(null)

  const loadDocs = useCallback(async () => {
    if (!userId) return
    try {
      setDocs(await listDocuments(userId, [category]))
      setDocsError('')
    } catch (cause) {
      setDocsError(cause?.message || 'Could not load your documents.')
    }
  }, [userId, category])

  const handleUse = (doc) => {
    setOpen(false)
    onChange(doc)
  }

  const handleUpload = async (event) => {
    event.preventDefault()
    if (!newFile || !userId) return
    setUploading(true)
    setUploadError('')
    try {
      const doc = await uploadDocument(userId, category, newFile)
      setOpen(false)
      onChange(doc)
    } catch (cause) {
      setUploadError(cause?.message || 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const viewFile = async () => {
    if (!value) return
    const url = await documentUrl(value.file_path, 60)
    if (!url) return
    if (onView) onView(url)
    else window.open(url, '_blank')
  }

  return (
    <div className="document-picker" onClick={(event) => event.stopPropagation()}>
      <div className="document-picker__row">
        {value ? (
          <>
            <span className="document-picker__icon" aria-hidden="true">📄</span>
            <span className="document-picker__title" title={value.title || 'Document'}>
              {value.title || 'Document'}
            </span>
            <span className="document-picker__source">From Documents</span>
            <button type="button" className="document-picker__change" onClick={() => setOpen(true)}>Change</button>
            <button type="button" className="document-picker__view" onClick={viewFile} disabled={!value.file_path}>View</button>
          </>
        ) : (
          <button type="button" className="document-picker__add" disabled={disabled} onClick={() => setOpen(true)}>
            <span aria-hidden="true">📄</span> {addLabel}
          </button>
        )}
      </div>

      {open && (
        <div className="document-modal" role="dialog" aria-modal="true" aria-label="Choose a document" onClick={() => setOpen(false)}>
          <div className="document-modal__box" onClick={(event) => event.stopPropagation()}>
            <div className="document-modal__head">
              <h3>Choose a document</h3>
              <button type="button" className="document-modal__close" onClick={() => setOpen(false)}>×</button>
            </div>
            <div className="document-modal__body">
              <button
                type="button"
                className={`document-modal__tab${pickedId === value?.id ? ' document-modal__tab--on' : ''}`}
                onClick={() => { setPickedId(value?.id || ''); setNewFile(null); loadDocs() }}
              >
                Your documents ({docs.length})
              </button>
              <button
                type="button"
                className={`document-modal__tab${pickedId !== value?.id && !newFile ? ' document-modal__tab--on' : ''}`}
                onClick={() => setPickedId('')}
              >
                Upload new file
              </button>

              {pickedId !== '' && !newFile && (
                <>
                  {docsError && <p className="document-modal__error">{docsError}</p>}
                  <ul className="document-modal__list">
                    {docs.map((doc) => (
                      <li key={doc.id} className="document-modal__item">
                        <label className="document-modal__row">
                          <input
                            type="radio"
                            name="document-picker"
                            checked={doc.id === pickedId}
                            onChange={() => setPickedId(doc.id)}
                          />
                          <span className="document-modal__title" title={doc.title}>{doc.title}</span>
                          <span className="document-modal__meta">{doc.category} · {doc.mime_type}</span>
                        </label>
                        <button type="button" className="document-modal__use" onClick={(event) => { event.stopPropagation(); handleUse(doc) }}>Use</button>
                      </li>
                    ))}
                    {docs.length === 0 && <p className="document-modal__empty">No documents yet — upload one below.</p>}
                  </ul>
                </>
              )}

              {pickedId === '' && (
                <form className="document-modal__upload" onSubmit={handleUpload}>
                  <label className="document-modal__field">
                    <span>File (PDF, JPG, PNG, max 10 MB)</span>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setNewFile(event.target.files?.[0] || null)} />
                  </label>
                  {uploadError && <p className="document-modal__error">{uploadError}</p>}
                  <button type="submit" className="document-modal__upload-btn" disabled={uploading || !newFile}>
                    {uploading ? 'Uploading…' : 'Upload & link'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
