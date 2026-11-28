/** ============================================================================
 * EducationSection — the Education page (redesign of the academic library tab)
 * ============================================================================
 * White page container with a faint lavender glow, the "Education" header and
 * a purple gradient "+ Add education" button, always-visible filter chips
 * ("All 1", "Secondary school 1", "University 0", "Programs 0"), then a 36/64
 * two-column layout: the entry list on the left and the editing panel on the
 * right. The filter and the open entry live in the URL (?type=…&id=…), exactly
 * like Test Scores and Honors, so a reload keeps the panel open.
 * ============================================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useEducation } from '../../hooks/useEducation'
import { useUndoToast } from '../../hooks/useUndoToast'
import SectionPage from '../section/SectionPage'
import FilterChips from '../section/FilterChips'
import EducationPanel from './EducationPanel'
import { ConfirmDialog } from '../forms'
import { saveGrades } from '../../Services/educationApi'
import { linkDocument, documentUsage, deleteDocumentEverywhere } from '../../Services/documentsApi'
import {
  EDUCATION_TYPES, educationType, entryChips, entryMeta, entryTitle, filterCounts, filterEntries,
} from '../../utils/education.js'
import './EducationSection.css'

const STATUS_TINT = {
  secondary_school: 'lilac', university: 'sky', pre_college: 'mint', foundation_year: 'mint',
}

/* ── card menu ──────────────────────────────────────────────────────────── */

function CardMenu({ entry, onDuplicate, onDelete }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (event) => { if (!wrap.current?.contains(event.target)) setOpen(false) }
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (action) => (event) => { event.stopPropagation(); setOpen(false); action() }

  return (
    <div className="edu-menu" ref={wrap} onClick={(event) => event.stopPropagation()}>
      <button type="button" className="edu-menu__btn" aria-haspopup="menu" aria-expanded={open}
        aria-label={`Actions for ${entryTitle(entry)}`} onClick={() => setOpen((value) => !value)}>
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <div className="edu-menu__list" role="menu">
          <button type="button" role="menuitem" onClick={pick(onDuplicate)}>Duplicate</button>
          <button type="button" role="menuitem" className="edu-menu__danger" onClick={pick(onDelete)}>Delete</button>
        </div>
      )}
    </div>
  )
}

/* ── card ───────────────────────────────────────────────────────────────── */

export function EducationCard({ entry, selected, onOpen, onDuplicate, onDelete }) {
  const type = educationType(entry.entry_type)
  const chips = entryChips(entry)
  const meta = entryMeta(entry)
  const place = [entry.city, entry.country].filter(Boolean).join(', ')
  return (
    <article
      className={`edu-card${selected ? ' edu-card--selected' : ''}`}
      role="button" tabIndex={0}
      aria-pressed={selected}
      onClick={() => onOpen(entry)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(entry) }
      }}
    >
      <span className={`edu-card__tile tile--${STATUS_TINT[type.key] || 'lilac'}`} aria-hidden="true">{type.emoji}</span>
      <div className="edu-card__text">
        <h3 className="edu-card__title">{entryTitle(entry)}</h3>
        <p className="edu-card__sub">
          <span>{educationType(entry.entry_type).label}</span>
          {place && <span className="edu-card__dot" aria-hidden="true">·</span>}
          {place && <span>{place}</span>}
        </p>
        {meta && <p className="edu-card__meta">{meta}</p>}
        {chips.length > 0 && (
          <div className="edu-card__chips">
            {chips.map((chip) => <span key={chip} className="edu-card__chip">{chip}</span>)}
          </div>
        )}
        {entry.is_current && <span className="status-pill status-pill--complete">Currently attending</span>}
      </div>
      <CardMenu entry={entry} onDuplicate={() => onDuplicate(entry)} onDelete={() => onDelete(entry)} />
    </article>
  )
}

/* ── section ────────────────────────────────────────────────────────────── */

export default function EducationSection({ userId }) {
  const actions = useEducation(userId)
  const { items, loading, error } = actions
  const { toast, showToast, hideToast } = useUndoToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [pendingFiles, setPendingFiles] = useState([])
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [discardAction, setDiscardAction] = useState(null)
  const [discardBusy, setDiscardBusy] = useState(false)
  const [discardError, setDiscardError] = useState('')
  const [failedLinks, setFailedLinks] = useState({})
  const toastTimer = useRef(null)

  const typeParam = searchParams.get('type') || 'all'
  const filter = ['all', ...EDUCATION_TYPES.map((type) => type.key), 'programs'].includes(typeParam) ? typeParam : 'all'
  const selectedId = searchParams.get('id')
  const selected = useMemo(() => items.find((item) => item.id === selectedId) || null, [items, selectedId])
  const filtered = useMemo(() => filterEntries(items, filter), [items, filter])
  const counts = useMemo(() => filterCounts(items), [items])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const setParams = useCallback((patch) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const [key, value] of Object.entries(patch)) {
        if (!value || value === 'all') next.delete(key)
        else next.set(key, value)
      }
      return next
    }, { replace: true })
  }, [setSearchParams])

  const openRow = useCallback((entry) => { if (adding) { setDiscardAction(() => () => { setAdding(false); setParams({ id: entry.id }) }); return } setParams({ id: entry.id }) }, [adding, setParams])
  const closePanel = useCallback(() => { setAdding(false); setParams({ id: null }) }, [setParams])

  const requestDiscard = useCallback(() => setDiscardAction(() => closePanel), [closePanel])

  const startAdd = useCallback(() => {
    if (adding) return
    // The create panel asks for the type itself (Type segmented control).
    setAdding(true)
    setParams({ id: null })
  }, [setParams, adding])

  const handleCreate = useCallback(async (fields, subjects, files) => {
    const row = await actions.create(fields)
    if (subjects?.length) {
      // The grade table is a child list; reload so the new entry's rows are
      // the synced ones returned by the database.
      try { await saveGrades(userId, row.id, subjects); actions.reload() }
      catch { showToast('Entry created, but grades could not be saved. Please add them again.') }
    }
    const failed = []
    for (const file of files) {
      try { await linkDocument(userId, 'education', row.id, file.id) }
      catch { failed.push(file) }
    }
    if (failed.length) setFailedLinks((prev) => ({ ...prev, [row.id]: failed }))
    setPendingFiles([])
    setUploadedFiles([])
    // Let React commit the list BEFORE closing the create panel, so the panel
    // is replaced by the new entry's edit view instead of reopening.
    await new Promise((resolve) => { requestAnimationFrame(() => resolve()) })
    setAdding(false)
    setParams({ id: row.id })
    if (!subjects?.length && !failed.length) showToast(`${educationType(row.entry_type).label} added`, {
      label: 'Undo',
      run: async () => {
        try {
          await actions.remove(row.id)
          setParams({ id: null })
          hideToast()
        } catch (cause) {
          showToast(cause?.message || 'Could not undo that.')
        }
      },
    })
    return row
  }, [actions, userId, setParams, showToast, hideToast])

  const handleDelete = useCallback(async (entry) => {
    try {
      await actions.remove(entry.id)
      setParams({ id: null })
      showToast(`${entryTitle(entry)} deleted`, {
        label: 'Undo',
        run: async () => {
          try {
            // Undo restores every saved field (the row is gone, so a create
            // with the original values is enough).
            const fields = Object.fromEntries(Object.entries(entry).filter(([key]) => ![
              'id', 'user_id', 'created_at', 'updated_at', 'grades',
            ].includes(key)))
            const restored = await actions.create(fields)
            showToast('Restored', { label: 'Open', run: () => openRow(restored) })
          } catch (cause) {
            showToast(cause?.message || 'Could not restore that entry.')
          }
        },
      })
    } catch (cause) {
      showToast(cause?.message || 'Could not delete that entry.')
    }
  }, [actions, setParams, showToast, openRow])

  const handleDuplicate = useCallback(async (entry) => {
    try {
      const copy = await actions.duplicate(entry)
      showToast(`${entryTitle(entry)} duplicated`, { label: 'Open', run: () => openRow(copy) })
    } catch (cause) {
      showToast(cause?.message || 'Could not duplicate that entry.')
    }
  }, [actions, openRow, showToast])

  const handleGradesSaved = useCallback((id, rows) => {
    actions.patch(id, { grades: rows.map((row, index) => ({ ...row, sort_order: index })) })
  }, [actions])

  const panelOpen = adding || Boolean(selected)
  const emptyHint = filter === 'all'
    ? 'Add a school, university or program to keep your transcripts in one place.'
    : 'Nothing in this category yet.'

  return (
    <>
      <SectionPage
        className="edu-page"
        title="Education"
        subtitle="Your schools, grades and transcripts in one place."
        action={{ label: adding ? 'Close' : 'Add education', onClick: adding ? requestDiscard : startAdd, disabled: loading || Boolean(error) }}
        chips={(
          <FilterChips
            items={counts.filter((chip) => chip.key !== 'all')}
            total={items.length}
            value={filter}
            onChange={(value) => { if (adding) setDiscardAction(() => () => { setAdding(false); setParams({ type: value, id: null }) }); else setParams({ type: value, id: null }) }}
            groupLabel="Filter education entries"
          />
        )}
      >
        <div className={`edu-columns${panelOpen ? ' edu-columns--panel' : ''}`}>
          <div className="edu-main">
            {error ? (
              <div className="edu-state edu-state--error">
                <p>Couldn&apos;t load your education</p>
                <button type="button" className="edu-btn edu-btn--primary" onClick={actions.retry}>Retry</button>
              </div>
            ) : loading ? (
              <div className="edu-skeleton" aria-hidden="true">
                {[0, 1].map((key) => <div key={key} className="edu-skeleton__card" />)}
              </div>
            ) : (
              <>
                <div className="edu-cards">
                  {filtered.map((entry) => (
                    <EducationCard
                      key={entry.id}
                      entry={entry}
                      selected={!adding && entry.id === selectedId}
                      onOpen={openRow}
                      onDuplicate={handleDuplicate}
                      onDelete={setDeleting}
                    />
                  ))}
                </div>

                {filtered.length === 0 && (
                  <div className="edu-state">
                    <span className="edu-state__tiles" aria-hidden="true">
                      <span className="edu-card__tile tile--lilac">🏫</span>
                      <span className="edu-card__tile tile--sky">🎓</span>
                    </span>
                    <p>{emptyHint}</p>
                    <button type="button" className="edu-btn edu-btn--primary" onClick={startAdd}>
                      <span aria-hidden="true">＋</span> Add education
                    </button>
                  </div>
                )}

                <button type="button" className="edu-empty-card" onClick={startAdd}>
                  <span className="edu-empty-card__plus" aria-hidden="true">＋</span>
                  Add a university, summer program or foundation year
                </button>
              </>
            )}
          </div>

          {panelOpen && (
            <EducationPanel
              key={adding ? 'new' : selected?.id}
              mode={adding ? 'create' : 'edit'}
              row={adding ? undefined : selected || undefined}
              userId={userId}
              onCreate={adding ? handleCreate : undefined}
              onUpdate={adding ? undefined : actions.update}
              onGradesSaved={handleGradesSaved}
              onClose={closePanel}
              pendingFiles={pendingFiles} onPendingChange={setPendingFiles}
              onUploaded={(docs) => setUploadedFiles((prev) => [...prev, ...docs])}
              onRequestDiscard={requestDiscard}
              failedFiles={failedLinks[selected?.id] || []}
              onRetryFile={async (file) => {
                try {
                  await linkDocument(userId, 'education', selected.id, file.id)
                  setFailedLinks((prev) => ({ ...prev, [selected.id]: (prev[selected.id] || []).filter((doc) => doc.id !== file.id) }))
                  actions.reload()
                } catch { showToast('Could not attach this file. Please try again.') }
              }}
            />
          )}
        </div>
      </SectionPage>

      {discardAction && <div className="confirm-overlay" role="presentation">
        <div className="confirm-box" role="alertdialog" aria-modal="true" aria-label="Discard this entry?">
          <h3>Discard this entry?</h3>
          <p>{uploadedFiles.length ? 'Newly uploaded files can be kept in Documents or deleted if they are not used elsewhere. Existing files will be kept.' : 'Your draft changes will be lost. Existing files will be kept.'}</p>
          {discardError && <p role="alert">{discardError}</p>}
          <div className="confirm-actions">
            <button type="button" autoFocus disabled={discardBusy} onClick={() => { setDiscardError(''); setDiscardAction(null) }}>Keep editing</button>
            <button type="button" disabled={discardBusy} onClick={() => { setPendingFiles([]); setUploadedFiles([]); setDiscardError(''); const action = discardAction; setDiscardAction(null); action() }}>Discard and keep files</button>
            {uploadedFiles.length > 0 && <button type="button" disabled={discardBusy} onClick={async () => {
              setDiscardBusy(true); setDiscardError('')
              try {
                for (const file of uploadedFiles) {
                  const usage = await documentUsage(file.id)
                  if (!usage.total) await deleteDocumentEverywhere(file.id)
                  setUploadedFiles((prev) => prev.filter((doc) => doc.id !== file.id))
                  if (!usage.total) setPendingFiles((prev) => prev.filter((doc) => doc.id !== file.id))
                }
                setPendingFiles([]); const action = discardAction; setDiscardAction(null); action()
              } catch { setDiscardError('Could not delete all uploaded files. Try again or keep the remaining files.') }
              finally { setDiscardBusy(false) }
            }}>Discard and delete unused uploads</button>}
          </div>
        </div>
      </div>}
      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${entryTitle(deleting || {})}?`}
        message="Its grades and linked transcript are removed too. This cannot be undone."
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={() => { const entry = deleting; setDeleting(null); if (entry) handleDelete(entry) }}
      />

      {toast && (
        <div className="toast" role="status">
          <span>{toast.message}</span>
          {toast.action && (
            <button type="button" onClick={() => { hideToast(); toast.action.run() }}>{toast.action.label}</button>
          )}
        </div>
      )}
    </>
  )
}
