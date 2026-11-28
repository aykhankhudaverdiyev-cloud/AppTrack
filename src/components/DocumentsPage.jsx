/** ============================================================================
 * DocumentsPage — the Documents tab: every file, and where it is used
 * ============================================================================
 * Reads the same two tables the Proof blocks write (document_files +
 * item_documents), so the rows here are exactly the rows in the panels.
 * Deleting from here is the same action as deleting from a panel: one dialog,
 * "Used in …", then the file disappears everywhere without a reload.
 * ============================================================================ */

import { useEffect, useMemo, useRef, useState } from 'react'
import ConfirmDialog from './forms/ConfirmDialog'
import FilterChips from './section/FilterChips'
import { UploadModal } from './section/ProofBlock'
import { InlineError } from './forms/PanelValidation'
import { useUndoToast } from '../hooks/useUndoToast'
import { onDataChanged } from '../store/studentsStore'
import {
  DOCUMENT_CATEGORIES, deleteDocumentEverywhere, documentUsage, formatSize,
  listAllLinks, listDocuments, openDocument, usageSentence,
} from '../Services/documentsApi'
import { formatDate } from '../utils/dates'
import './DocumentsPage.css'

const SECTION_TITLES = {
  education: 'Education', test: 'Test Scores', honor: 'Honors',
  project: 'Projects', activity: 'Activities', application: 'Applications',
}

export default function DocumentsPage({ userId, onOpenItem }) {
  const [documents, setDocuments] = useState([])
  const [links, setLinks] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState('newest')
  const [deleting, setDeleting] = useState(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [deleteUsage, setDeleteUsage] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const { toast, showToast, hideToast } = useUndoToast()
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  useEffect(() => {
    if (!userId) return undefined
    let active = true
    Promise.resolve().then(async () => {
      if (!active) return
      setLoading(true)
      setError('')
      try {
        const [files, allLinks] = await Promise.all([listDocuments(userId), listAllLinks(userId)])
        if (!active) return
        setDocuments(files)
        setLinks(allLinks)
      } catch (cause) {
        if (active) setError(cause?.message || 'Could not load your documents.')
      } finally {
        if (active) setLoading(false)
      }
    })
    return () => { active = false }
  }, [userId, reloadKey])

  const refresh = () => setReloadKey((value) => value + 1)
  useEffect(() => onDataChanged(refresh), [])

  const chips = useMemo(() => {
    const counts = {}
    for (const doc of documents) counts[doc.category] = (counts[doc.category] || 0) + 1
    return Object.entries(counts).map(([key, count]) => ({ key, label: DOCUMENT_CATEGORIES[key] || key, count }))
  }, [documents])

  const visible = useMemo(() => documents.filter((doc) => {
    if (category !== 'all' && doc.category !== category) return false
    if (!query.trim()) return true
    return String(doc.title || '').toLowerCase().includes(query.trim().toLowerCase())
  }).sort((a, b) => {
    if (sort === 'name') return String(a.title || '').localeCompare(String(b.title || ''))
    if (sort === 'category') return String(DOCUMENT_CATEGORIES[a.category] || a.category || '').localeCompare(String(DOCUMENT_CATEGORIES[b.category] || b.category || ''))
    return String(b.created_at || '').localeCompare(String(a.created_at || ''))
  }), [documents, category, query, sort])

  const usageOf = (docId) => {
    const items = Object.values(links).flatMap((entry) => (entry.documents.some((doc) => doc.id === docId)
      ? [{ section: entry.section, item_id: entry.key.split(':')[1], title: entry.itemTitle }]
      : []))
    return { total: items.length, items }
  }

  const view = async (doc) => {
    try { await openDocument(doc) } catch { setError('Could not open the file. Allow pop-ups and try again.') }
  }

  const askDelete = async (doc) => {
    setDeleting(doc)
    setDeleteUsage(null)
    try { setDeleteUsage(await documentUsage(doc.id)) } catch { setDeleting(null); setError('Could not check where this file is used. Please try again.') }
  }

  const confirmDelete = async () => {
    const doc = deleting
    setDeleting(null)
    try {
      await deleteDocumentEverywhere(doc.id)
      setDocuments((previous) => previous.filter((file) => file.id !== doc.id))
      const remaining = {}
      for (const [key, entry] of Object.entries(links)) {
        const kept = entry.documents.filter((file) => file.id !== doc.id)
        if (kept.length) remaining[key] = { ...entry, documents: kept }
      }
      setLinks(remaining)
      showToast('File deleted')
      timer.current = setTimeout(hideToast, 4000)
    } catch {
      setError('Could not delete the file. Try again.')
    }
  }

  const itemsFor = (docId) => usageOf(docId).items

  return (
    <section className="documents-page">
      <header className="documents-page__head">
        <div>
          <h3>All documents</h3>
          <p className="documents-page__sub">Every file you uploaded, and where it is used.</p>
        </div>
        <button type="button" className="edu-btn edu-btn--primary" onClick={() => setUploadOpen(true)}>Upload files</button>
      </header>

      {documents.length > 0 && <div className="documents-page__tools">
        <input className="documents-page__search" type="search" value={query} placeholder="Search your documents"
          aria-label="Search your documents" onChange={(event) => setQuery(event.target.value)} />
        <label>Sort <select aria-label="Sort documents" value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="newest">Newest</option><option value="name">Name</option><option value="category">Category</option>
        </select></label>
        <FilterChips items={chips} value={category} onChange={setCategory} total={documents.length}
          groupLabel="Filter by category" alwaysShow />
      </div>}

      {error && <InlineError message={error} />}

      {loading ? <p className="documents-page__empty">Loading documents…</p>
        : visible.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon" aria-hidden="true">📁</div>
            <h4>{documents.length ? 'Nothing matches this search' : 'No documents yet'}</h4>
            <p>{documents.length
              ? 'Try another word or category.'
              : 'Upload your passport, transcripts, score reports and certificates once, then attach them anywhere.'}</p>
            {!documents.length && <button type="button" className="edu-btn edu-btn--primary" onClick={() => setUploadOpen(true)}>Upload files</button>}
          </div>
        ) : (
          <ul className="documents-page__list">
            {visible.map((doc) => {
              const used = itemsFor(doc.id)
              return (
                <li key={doc.id} className="documents-page__row">
                  <span className="documents-page__tile" aria-hidden="true">{String(doc.title || '📄').slice(0, 1).toUpperCase()}</span>
                  <div className="documents-page__info">
                    <strong title={doc.title}>{doc.title}</strong>
                    <span>
                      {DOCUMENT_CATEGORIES[doc.category] || doc.category} · {formatSize(doc.size_bytes)}
                      {doc.created_at ? ` · ${formatDate(doc.created_at.slice(0, 10), 'day')}` : ''}
                    </span>
                    <span className="documents-page__usage">
                      {used.length === 0
                        ? 'Not attached anywhere'
                        : used.map((item) => <button type="button" className="documents-page__usage-chip" key={`${item.section}:${item.item_id}:${item.title}`} onClick={() => onOpenItem?.(item)}>{SECTION_TITLES[item.section] || item.section}{item.title ? ` · ${item.title}` : ''}</button>)}
                    </span>
                  </div>
                  <div className="documents-page__actions">
                    <button type="button" className="documents-page__link" onClick={() => view(doc)}>View</button>
                    <details className="proof__more">
                      <summary aria-label={`More actions for ${doc.title}`} title="More">⋯</summary>
                      <div className="proof__menu">
                        <button type="button" onClick={() => view(doc)}>View file</button>
                        <button type="button" className="proof__menu-danger" onClick={() => askDelete(doc)}>Delete file…</button>
                      </div>
                    </details>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

      <UploadModal open={uploadOpen} section="library" userId={userId} existing={documents} libraryOnly
        onClose={() => setUploadOpen(false)} onLinked={(files) => {
          refresh()
          showToast(`Uploaded ${files.length} file${files.length === 1 ? '' : 's'}`)
        }} />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this file?"
        message={deleteUsage
          ? `${usageSentence(deleteUsage, deleting?.title)} Deleting it removes it from all of them. This cannot be undone.`
          : 'Checking where this file is used…'}
        confirmLabel="Delete file" confirmDisabled={!deleteUsage}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />

      {toast && (
        <div className="toast" role="status">
          <span>{toast.message}</span>
          {toast.action && (
            <button type="button" onClick={() => { hideToast(); toast.action.run() }}>{toast.action.label}</button>
          )}
        </div>
      )}
    </section>
  )
}
