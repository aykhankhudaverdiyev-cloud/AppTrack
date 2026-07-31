import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import './LicenseMediaItem.css'

const LICENSE_BUCKET = 'student-documents'

function formatSize(bytes) {
  if (!bytes) return ''
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

export default function LicenseMediaItem({ media, onRemove, readOnly = false }) {
  const [resolvedUrl, setResolvedUrl] = useState('')
  const [showViewer, setShowViewer] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function resolveUrl() {
      const existingUrl = media.url || media.file_url
      if (existingUrl) {
        if (!cancelled) setResolvedUrl(existingUrl)
        return
      }

      const path = media.filePath || media.file_path || media.path
      if (!path) return

      const { data, error } = await supabase.storage
        .from(LICENSE_BUCKET)
        .createSignedUrl(path, 3600)

      if (error) {
        console.error('License media signed URL error:', path, error)
        return
      }

      if (!cancelled) setResolvedUrl(data.signedUrl)
    }

    resolveUrl()
    return () => {
      cancelled = true
    }
  }, [media])

  // Fayl açılanda fresh URL almaq (JWT expired probleminə qarşı)
  async function handleView() {
    const path = media.filePath || media.file_path || media.path
    if (path) {
      const { data, error } = await supabase.storage
        .from(LICENSE_BUCKET)
        .createSignedUrl(path, 3600)
      if (!error && data?.signedUrl) {
        setResolvedUrl(data.signedUrl)
      }
    }
    setShowViewer(true)
  }

  const isPdf = /\.pdf$/i.test(media.name || '')
  const isImage = /\.(png|jpe?g|gif|webp)$/i.test(media.name || '')

  return (
    <>
      <span className="pill-link pill-link--file">
        📄 <span className="pill-link__name">{media.name}</span>

        {resolvedUrl && (
          <>
            <button
              type="button"
              className="pill-link__btn"
              onClick={handleView}
              title="View"
            >
              View
            </button>
            <a
              className="pill-link__btn"
              href={resolvedUrl}
              target="_blank"
              rel="noreferrer"
              title="Open in new tab"
            >
              Open tab
            </a>
          </>
        )}

        {!readOnly && onRemove && (
          <button
            type="button"
            className="chip-x"
            onClick={() => onRemove(media.id)}
            title="Remove"
          >
            ✕
          </button>
        )}
      </span>

      {showViewer && resolvedUrl && (
        <div className="media-viewer-backdrop" onClick={() => setShowViewer(false)}>
          <div className="media-viewer" onClick={(e) => e.stopPropagation()}>
            <div className="media-viewer__head">
              <div className="media-viewer__meta">
                <strong>{media.name}</strong>
                {media.size && <span>{formatSize(media.size)}</span>}
              </div>
              <div className="media-viewer__actions">
                <a
                  className="mini-btn"
                  href={resolvedUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open tab
                </a>
                <button
                  type="button"
                  className="mini-btn mini-btn--danger"
                  onClick={() => setShowViewer(false)}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="media-viewer__frame">
              {isPdf ? (
                <iframe
                  src={`${resolvedUrl}#toolbar=0`}
                  title={media.name}
                  width="100%"
                  height="100%"
                />
              ) : isImage ? (
                <img
                  src={resolvedUrl}
                  alt={media.name}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              ) : (
                <div className="media-viewer__fallback">
                  <p>Preview not available for this file type.</p>
                  <a
                    className="solid-btn solid-btn--sm"
                    href={resolvedUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in new tab
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}