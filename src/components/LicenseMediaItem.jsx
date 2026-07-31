import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const LICENSE_BUCKET = 'student-documents'

export default function LicenseMediaItem({ media, onRemove, readOnly = false }) {
  const [resolvedUrl, setResolvedUrl] = useState('')

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

  return (
    <span className="pill-link pill-link--file">
      {resolvedUrl ? (
        <a href={resolvedUrl} target="_blank" rel="noreferrer">
          📄 {media.name}
        </a>
      ) : (
        <>📄 {media.name}</>
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
  )
}