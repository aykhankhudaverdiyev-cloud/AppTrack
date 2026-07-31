import { useState } from 'react'

function formatSize(bytes) {
  if (!bytes) return 'PDF file'
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

export default function DocumentGroup({
  studentId,
  application,
  category,
  onUpload,
  onRemove,
  onSetDocVisibility,
  readOnly = false,
}) {
  const [activePdf, setActivePdf] = useState(null)

  const docs = getDocs(application, category.key)

  console.log("Category:", category.key)
  console.log("Docs:", docs)
  console.log("Available categories:", Object.keys(application.documents || {}))

  console.log("APPLICATION DOCS:", application.documents)
  
  const inputId = `doc-${studentId}-${application.id}-${category.key}`

  function getDocs(application, key) {
    const docs = application.documents
    if (!docs || Array.isArray(docs)) return []
    return docs[key] || []
  }

  return (
    <section className="doc-group">
      <header className="doc-group__head">
        <div className="doc-group__title">
          <span className="doc-group__icon" style={{ background: category.tint || 'rgba(124,58,237,0.12)', color: category.color || '#6d28d9' }}>
            {category.emoji || '📄'}
          </span>
          <div className="doc-group__label">
            <h5>{category.label}</h5>
            <p>{category.hint || ''}</p>
          </div>
        </div>
        <span className="doc-group__count">{docs.length}</span>
      </header>

      <div className="doc-group__body">
        {docs.map((doc) => (
          <div key={doc.id} className="doc-chip">
            <span className="doc-chip__file">📄</span>

            <div className="doc-chip__info">
              <strong title={doc.name}>{doc.name}</strong>
              <span>{formatSize(doc.size)}</span>
            </div>

            <div className="doc-chip__actions">
              {doc.file_url && (
                <>
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => setActivePdf(doc)}
                  >
                    View
                  </button>

                  <a
                    className="mini-btn"
                    href={doc.file_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open tab
                  </a>
                </>
              )}

              {!readOnly && onSetDocVisibility && (
                <button
                  type="button"
                  className={`mini-btn ${doc.visibility === 'public' ? 'mini-btn--public' : ''}`}
                  onClick={() =>
                    onSetDocVisibility(
                      doc.id,
                      doc.visibility === 'public' ? 'private' : 'public'
                    )
                  }
                  title={doc.visibility === 'public' ? 'Public' : 'Private'}
                >
                  {doc.visibility === 'public' ? '🌐' : '🔒'}
                </button>
              )}

              {!readOnly && (<button
                type="button"
                className="mini-btn mini-btn--danger"
                onClick={() => onRemove(studentId, application.id, category.key, doc.id)}
              >
                Remove
              </button>)}
            </div>
          </div>
        ))}
        {!readOnly && (
        <>
          <label htmlFor={inputId} className="doc-drop">
            <span className="doc-drop__plus">＋</span>
            <span className="doc-drop__text">
              Upload PDF
              <small>Click to browse — PDF only</small>
            </span>
          </label>

          <input
            id={inputId}
            type="file"
            accept="application/pdf"
            className="file-input-hidden"
            onChange={(e) => {
              onUpload(
                studentId,
                application.id,
                category.key,
                e.target.files?.[0] || null
              )
              e.target.value = ''
            }}
          />
        </>
      )}

      </div>

      {activePdf && (
        <section className="pdf-viewer">
          <div className="pdf-viewer__head">
            <div className="pdf-viewer__meta">
              <strong>{activePdf.name}</strong>
              <span>{formatSize(activePdf.size)}</span>
            </div>
            <div className="pdf-viewer__actions">
              <a className="mini-btn" href={activePdf.file_url} target="_blank" rel="noreferrer">
                Open tab
              </a>
              <button type="button" className="mini-btn mini-btn--danger" onClick={() => setActivePdf(null)}>Close</button>
            </div>
          </div>
          <div className="pdf-viewer__frame">
            <iframe src={`${activePdf.file_url}#toolbar=0`} title={activePdf.name} width="100%" height="620" />
          </div>
        </section>
      )}
    </section>
  )
}