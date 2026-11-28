import { usePendingAttachments } from '../../hooks/usePendingAttachments'
import DiscardAttachmentsDialog from '../section/DiscardAttachmentsDialog'
import { readCreateDraft } from '../../hooks/useAutosave'
/** ============================================================================
 * HonorsSection — Honors & Awards page (spec §3)
 * ============================================================================
 * Cards + sticky detail panel (40 / 60). Drag-to-rank in the All view via
 * @dnd-kit; the filter and the open honor live in the URL (?category=…&id=…).
 * ============================================================================ */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useHonors } from '../../hooks/useHonors'
import { useUndoToast } from '../../hooks/useUndoToast'
import SectionPage from '../section/SectionPage'
import FilterChips from '../section/FilterChips'
import ListCard from '../section/ListCard'
import HonorPanel from './HonorPanel'
import { ConfirmDialog } from '../forms'
import {
  HONOR_CATEGORIES, honorEmoji, honorTint,
} from '../../constants/honors.js'
import { computeHonorStatus, buildHonorMeta, honorTitle, honorCategoryCounts, mapDbError } from '../../utils/honors.js'
import './HonorsSection.css'

const STATUS_CLASS = { draft: 'draft', missing: 'missing', complete: 'complete' }

/* ── card menu ──────────────────────────────────────────────────────────── */

function CardMenu({ honor, onEdit, onDuplicate, onMoveTop, onDelete }) {
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

  const pick = (action) => (event) => {
    event.stopPropagation()
    setOpen(false)
    action()
  }

  return (
    <div className="honors-menu" ref={wrap} onClick={(event) => event.stopPropagation()}>
      <button
        type="button" className="honors-menu__btn" aria-haspopup="menu" aria-expanded={open}
        aria-label={`Actions for ${honorTitle(honor)}`} onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <div className="honors-menu__list" role="menu">
          <button type="button" role="menuitem" onClick={pick(onEdit)}>Edit</button>
          <button type="button" role="menuitem" onClick={pick(onDuplicate)}>Duplicate</button>
          <button type="button" role="menuitem" onClick={pick(onMoveTop)}>Move to top</button>
          <button type="button" role="menuitem" className="honors-menu__danger" onClick={pick(onDelete)}>Delete</button>
        </div>
      )}
    </div>
  )
}

/* ── ranked card (All view) ─────────────────────────────────────────────── */

function SortableCard({ honor, rank, onOpen, onEdit, onDuplicate, onMoveTop, onDelete }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: honor.id })
  const style = {
    transform: transform ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)` : undefined,
    transition,
  }
  const status = computeHonorStatus(honor)
  return (
    <div ref={setNodeRef} style={style} className={`honors-card${isDragging ? ' honors-card--ghost' : ''}`} role="button" tabIndex={0}
      onClick={() => onOpen(honor)}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(honor) } }}
      aria-label={`${honorTitle(honor)}. Open details`}>
      <button type="button" ref={setActivatorNodeRef} className="drag-handle" aria-label={`Reorder ${honorTitle(honor)}`} onClick={(event) => event.stopPropagation()} {...attributes} {...listeners} />
      <span className="rank-badge" aria-hidden="true">{rank}</span>
      <span className={`honors-tile tile--${honorTint(honor.category)}`} aria-hidden="true">{honorEmoji(honor)}</span>
      <div className="honors-card__text">
        <h3>{honorTitle(honor)}</h3>
        <span className="honors-card__meta">{buildHonorMeta(honor)}</span>
      </div>
      <span className={`status-pill status-pill--${STATUS_CLASS[status.key]}`}>{status.label}</span>
      <CardMenu honor={honor} onEdit={onEdit} onDuplicate={onDuplicate} onMoveTop={onMoveTop} onDelete={onDelete} />
    </div>
  )
}

/* ── card (filtered view) ───────────────────────────────────────────────── */

function HonorCard({ honor, selected, isNew, onOpen, onEdit, onDuplicate, onMoveTop, onDelete }) {
  const status = computeHonorStatus(honor)
  return (
    <ListCard
      className={`honor-card${selected ? ' honor-card--selected' : ''}${isNew ? ' honor-card--new' : ''}`}
      tile={<span className={`honors-tile tile--${honorTint(isNew ? 'slate' : honor.category)}`} aria-hidden="true">{isNew ? '＋' : honorEmoji(honor)}</span>}
      title={isNew ? 'New honor' : honorTitle(honor)}
      meta={isNew ? 'Not saved yet' : buildHonorMeta(honor)}
      pills={<span className={`status-pill status-pill--${STATUS_CLASS[status.key]}`}>{status.label}</span>}
      menu={isNew ? null : <CardMenu honor={honor} onEdit={onEdit} onDuplicate={onDuplicate} onMoveTop={onMoveTop} onDelete={onDelete} />}
      selected={selected} isNew={isNew} onClick={() => onOpen(honor)}
    />
  )
}

/* ── section ────────────────────────────────────────────────────────────── */

export default function HonorsSection({ userId }) {
  const attachments = usePendingAttachments(userId, 'honor')
  const { attach, requestDiscard } = attachments
  const actions = useHonors(userId)
  const { items, loading, error } = actions
  const { toast, showToast, hideToast } = useUndoToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [adding, setAdding] = useState(() => Boolean(readCreateDraft(userId && `honors:${userId}`)))
  const [deleting, setDeleting] = useState(null)
  const [dragId, setDragId] = useState(null)
  const toastTimer = useRef(null)

  const categoryParam = searchParams.get('category') || 'all'
  const filter = categoryParam !== 'all' && HONOR_CATEGORIES.some((c) => c.key === categoryParam) ? categoryParam : 'all'
  const selectedId = searchParams.get('id')
  const selected = useMemo(() => items.find((item) => item.id === selectedId) || null, [items, selectedId])
  const counts = useMemo(() => honorCategoryCounts(items), [items])
  const top5Count = items.filter((item) => item.is_top5_commonapp).length
  const ranked = items.map((item, index) => ({ item, rank: index + 1 }))
  const filtered = filter === 'all' ? items : items.filter((item) => item.category === filter)

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

  const openRow = useCallback((row) => { const open = () => { setAdding(false); setParams({ id: row.id }) }; if (adding) requestDiscard(open); else open() }, [adding, requestDiscard, setParams])

  const closePanel = useCallback(() => { setAdding(false); setParams({ id: null }) }, [setParams])

  const startAdd = useCallback(() => {
    if (adding) return
    // Don't force the URL's category filter to the new draft's default
    // category — that would select a filter chip showing "0" (the draft
    // isn't saved yet) while the real "All" count also reads 0.
    setAdding(true)
    setParams({ id: null })
  }, [setParams, adding])

  const handleCreate = useCallback(async (draft) => {
    const row = await actions.create(draft)
    await attach(row.id)
    await new Promise((resolve) => requestAnimationFrame(resolve))
    setAdding(false)
    setParams({ category: filter === 'all' ? null : row.category, id: row.id })
    showToast(`${honorTitle(row)} added`, {
      label: 'Undo',
      run: async () => {
        try {
          await actions.remove(row.id)
          setParams({ id: null })
          hideToast()
        } catch (cause) {
          showToast(mapDbError(cause).message)
        }
      },
    })
  }, [actions, attach, setParams, showToast, hideToast, filter])

  const handleSave = useCallback(async (draft) => {
    if (!selected) return
    await actions.update(selected.id, draft)
  }, [actions, selected])

  const handleDelete = useCallback(async (honor) => {
    try {
      await actions.remove(honor.id)
      setParams({ id: null })
      showToast(`${honorTitle(honor)} deleted`, {
        label: 'Undo',
        run: async () => {
          try {
            await actions.restore(honor)
            showToast('Restored')
          } catch (cause) {
            showToast(mapDbError(cause).message)
          }
        },
      })
    } catch (cause) {
      showToast(mapDbError(cause).message)
    }
  }, [actions, setParams, showToast])

  const handleDuplicate = useCallback(async (honor) => {
    try {
      const copy = await actions.duplicate(honor.id)
      showToast(`${honorTitle(copy)} created`, { label: 'Edit', run: () => openRow(copy) })
    } catch (cause) {
      showToast(mapDbError(cause).message)
    }
  }, [actions, openRow, showToast])

  const handleMoveTop = useCallback(async (honor) => {
    try { await actions.moveToTop(honor.id) } catch (cause) {
      showToast(mapDbError(cause).message)
    }
  }, [actions, showToast])

  /* ── drag and drop (All view only) ── */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const dragRow = dragId ? items.find((item) => item.id === dragId) : null
  const dragRank = dragRow ? items.findIndex((item) => item.id === dragRow.id) + 1 : 0

  const onDragEnd = async ({ active, over }) => {
    setDragId(null)
    if (!over || active.id === over.id) return
    const from = items.findIndex((item) => item.id === active.id)
    const to = items.findIndex((item) => item.id === over.id)
    if (from === -1 || to === -1) return
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    try {
      await actions.reorder(next)
      showToast('Order saved')
    } catch (cause) {
      showToast(mapDbError(cause).message, { label: 'Retry', run: () => actions.reorder(next).catch((error) => showToast(mapDbError(error).message)) })
    }
  }

  const chips = HONOR_CATEGORIES
    .filter((category) => counts[category.key] || filter === category.key)
    .map((category) => ({ ...category, count: counts[category.key] || 0 }))

  const panelOpen = adding || Boolean(selected)

  return (
    <>
      <SectionPage
        title="Honors &amp; Awards"
        subtitle="Competitions, scholarships and recognition. Drag to rank them."
        action={{ label: 'Add honor', onClick: startAdd }}
        chips={<FilterChips items={chips} total={items.length} value={filter} onChange={(value) => setParams({ category: value, id: null })} />}
        counter={`Top 5 for forms: ${top5Count} / 5`}
      >
      <div className={`honors-columns${panelOpen ? ' honors-columns--panel' : ''}`}>
        <div className="honors-main">
          {error ? (
            <div className="honors-state honors-state--error">
              <p role="alert">{mapDbError({ message: error }).message}</p>
              <button type="button" className="honors-btn honors-btn--retry" onClick={actions.retry}>Retry</button>
            </div>
          ) : loading ? (
            <div className="honors-skeleton" aria-hidden="true">
              {[0, 1, 2].map((key) => <div key={key} className="honors-skeleton__card" />)}
            </div>
          ) : adding ? (
            <div className="honors-cards">
              <HonorCard honor={{ title: '', category: filter === 'all' ? 'other' : filter }} isNew selected onClick={() => {}} />
            </div>
          ) : items.length === 0 ? (
            <div className="honors-empty">
              <div className="honors-empty__tiles" aria-hidden="true">
                <span className="honors-tile tile--mint">🥈</span>
                <span className="honors-tile tile--slate">🏁</span>
                <span className="honors-tile tile--rose">🎓</span>
              </div>
              <p>Add your first honor. Olympiads, competitions, scholarships and sports awards all count.</p>
              <button type="button" className="honors-btn honors-btn--primary" onClick={startAdd}>
                <span aria-hidden="true">＋</span> Add honor
              </button>
            </div>
          ) : filter === 'all' ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={({ active }) => setDragId(active.id)} onDragCancel={() => setDragId(null)} onDragEnd={onDragEnd}>
              <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                <div className="honors-cards">
                  {ranked.map(({ item, rank }) => (
                    <div key={item.id}>
                      <SortableCard
                        honor={item} rank={rank}
                        onOpen={openRow} onEdit={() => openRow(item)}
                        onDuplicate={() => handleDuplicate(item)} onMoveTop={() => handleMoveTop(item)}
                        onDelete={() => setDeleting(item)}
                      />
                    </div>
                  ))}
                </div>
              </SortableContext>
              <DragOverlay dropAnimation={null}>
                {dragRow ? (
                  <div className="honors-card honors-card--overlay">
                    <span className="drag-handle" aria-hidden="true" />
                    <span className="rank-badge" aria-hidden="true">{dragRank}</span>
                    <span className={`honors-tile tile--${honorTint(dragRow.category)}`} aria-hidden="true">{honorEmoji(dragRow)}</span>
                    <div className="honors-card__text">
                      <h3>{honorTitle(dragRow)}</h3>
                      <span className="honors-card__meta">{buildHonorMeta(dragRow)}</span>
                    </div>
                    <span className={`status-pill status-pill--${STATUS_CLASS[computeHonorStatus(dragRow).key]}`}>{computeHonorStatus(dragRow).label}</span>
                    <span className="honors-menu__btn" aria-hidden="true">⋯</span>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          ) : (
            <div className="honors-cards">
              {filtered.map((honor) => (
                <HonorCard
                  key={honor.id} honor={honor} selected={honor.id === selectedId}
                  onOpen={openRow} onEdit={() => openRow(honor)}
                  onDuplicate={() => handleDuplicate(honor)} onMoveTop={() => handleMoveTop(honor)}
                  onDelete={() => setDeleting(honor)}
                />
              ))}
              {adding && (
                <HonorCard honor={{ title: '', category: filter === 'all' ? 'other' : filter }} isNew selected onClick={() => {}} />
              )}
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <button type="button" className="honors-add-link" onClick={startAdd} disabled={adding}>
              <span aria-hidden="true">＋</span> Add honor
            </button>
          )}
          {!loading && !error && items.length > 0 && (
            <p className="honors-footnote">Changes are saved automatically.</p>
          )}
        </div>

        {panelOpen && (
          <HonorPanel
            key={adding ? 'new' : selected?.id}
            mode={adding ? 'create' : 'edit'}
            row={adding ? undefined : selected}
            userId={userId}
            defaultCategory={filter === 'all' ? 'other' : filter}
            defaultTop5={top5Count < 5}
            onSave={adding ? undefined : handleSave}
            attachments={attachments}
            onCreate={adding ? handleCreate : undefined}
            onClose={closePanel}
          />
        )}
      </div>
    </SectionPage>

    <>
      <DiscardAttachmentsDialog attachments={attachments} />
      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.title || 'this honor'}?`}
        message="This cannot be undone."
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={() => { const honor = deleting; setDeleting(null); if (honor) handleDelete(honor) }}
      />

      {toast && (
        <div className="toast" role="status">
          <span>{toast.message}</span>
          {toast.action && (
            <button type="button" onClick={() => { hideToast(); toast.action.run() }}>
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </>
    </>
  )
}

