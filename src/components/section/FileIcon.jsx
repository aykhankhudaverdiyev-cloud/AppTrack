/** Consistent type badge for document rows. */
export default function FileIcon({ doc }) {
  const type = String(doc.mime_type || doc.type || '').toLowerCase()
  const name = String(doc.file_path || doc.name || doc.title || '').toLowerCase()
  const label = type.includes('pdf') || name.endsWith('.pdf') ? 'PDF'
    : type.startsWith('image/') || /\.(png|jpe?g)$/.test(name) ? 'IMG'
      : type.includes('word') || name.endsWith('.docx') ? 'DOCX' : 'FILE'
  return <span className="file-type-icon" aria-hidden="true">{label}</span>
}
