/**
 * ============================================================================
 * ActivitiesSection — Activities & Experiences (list + filters + panel)
 * ============================================================================
 * All view: full-width ranked rows with drag-and-drop (@dnd-kit), 10-activity
 * guidance, 20 hard cap. Filtered view: cards + sticky side panel. The filter
 * and the open activity live in the URL (?type=…&id=…), so refresh keeps them.
 * ============================================================================
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import ActivityPanel from './ActivityPanel'
import { ACTIVITY_CATEGORIES, ACTIVITY_LIMITS, CATEGORY_ADD_LABELS, activityCategory, categoryLabel } from '../../constants/activityTypes'
import {
  activityTitle, buildMeta, categoryCounts, computeStatus,
} from '../../utils/activities'
import { useActivities } from '../../hooks/useActivities'
import { ConfirmDialog } from '../forms'
import './ActivitiesSection.css'

const STATUS_CLASS = { draft: 'act-pill--draft', missing: 'act-pill--missing', complete: 'act-pill--complete' }

function StatusPill({ row }) {
  const status = computeStatus(row)
  return <span className={`act-pill ${STATUS_CLASS[status.key]}`}>{status.label}</span>
}

function Tile({ type, size = 'md', isNew = false }) {
  const category = activityCategory(type)
  return (
    <span className={`act-tile act-tile--${category.tint} act-tile--${size}${isNew ? ' act-tile--new' : ''}`} aria-hidden="true">
      {isNew ? '＋' : category.emoji}
    </span>
  )
}

/* ── row menu ────────────────────────────────────────────────────────────── */

function RowMenu({ row, onEdit, onDuplicate, onMoveTop, onDelete }) {
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
    <div className="act-menu" ref={wrap} onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="act-menu__btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${activityTitle(row)}`}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <div className="act-menu__list" role="menu">
          <button type="button" role="menuitem" onClick={pick(onEdit)}>Edit</button>
          <button type="button" role="menuitem" onClick={pick(onDuplicate)}>Duplicate</button>
          <button type="button" role="menuitem" onClick={pick(onMoveTop)}>Move to top</button>
          <button type="button" role="menuitem" className="act-menu__danger" onClick={pick(onDelete)}>Delete</button>
        </div>
      )}
    </div>
  )
}

/* ── ranked row (All view) ───────────────────────────────────────────────── */

function SortableRow({ row, rank, onOpen, onEdit, onDuplicate, onMoveTop, onDelete }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: row.id })
  const style = {
    transform: transform ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)` : undefined,
    transition,
  }
  const category = categoryLabel(row.activity_type)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`act-row${isDragging ? ' act-row--ghost' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(row)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(row)
        }
      }}
      aria-label={`${activityTitle(row)}, ${row.position || category}. Open details`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="act-grip"
        aria-label={`Reorder ${activityTitle(row)}`}
        onClick={(event) => event.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        <span aria-hidden="true">⠿</span>
      </button>
      <span className="act-rank" aria-hidden="true">{rank}</span>
      <Tile type={row.activity_type} />
      <div className="act-row__text">
        <h3>{activityTitle(row)}</h3>
        {row.position ? <p>{row.position}</p> : null}
      </div>
      <span className="act-tag">{category}</span>
      <span className="act-row__meta">{buildMeta(row)}</span>
      <StatusPill row={row} />
      <RowMenu row={row} onEdit={onEdit} onDuplicate={onDuplicate} onMoveTop={onMoveTop} onDelete={onDelete} />
    </div>
  )
}

function RowPreview({ row, rank }) {
  return (
    <div className="act-row act-row--overlay">
      <span className="act-grip" aria-hidden="true"><span>⠿</span></span>
      <span className="act-rank" aria-hidden="true">{rank}</span>
      <Tile type={row.activity_type} />
      <div className="act-row__text">
        <h3>{activityTitle(row)}</h3>
        {row.position ? <p>{row.position}</p> : null}
      </div>
      <span className="act-tag">{categoryLabel(row.activity_type)}</span>
      <span className="act-row__meta">{buildMeta(row)}</span>
      <StatusPill row={row} />
      <span className="act-menu__btn" aria-hidden="true">⋯</span>
    </div>
  )
}

/* ── card (filtered view) ────────────────────────────────────────────────── */

function ActivityCard({ row, selected, isNew, onOpen, onEdit, onDuplicate, onMoveTop, onDelete }) {
  const category = categoryLabel(row.activity_type)
  return (
    <div
      className={`act-card${selected ? ' act-card--selected' : ''}${isNew ? ' act-card--new' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(row)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(row)
        }
      }}
      aria-label={`${activityTitle(row)}, ${row.position || category}${isNew ? ', not saved yet' : ''}`}
    >
      <Tile type={isNew ? undefined : row.activity_type} size="lg" isNew={isNew} />
      <div className="act-card__text">
        <h3>{isNew ? (row.organization_name || 'New activity') : activityTitle(row)}</h3>
        <p>{row.position || 'Your role'}</p>
        <span className="act-card__meta">{isNew ? 'Not saved yet' : buildMeta(row)}</span>
        {isNew ? <span className="act-pill act-pill--new">New</span> : <StatusPill row={row} />}
      </div>
      {!isNew && <RowMenu row={row} onEdit={onEdit} onDuplicate={onDuplicate} onMoveTop={onMoveTop} onDelete={onDelete} />}
    </div>
  )
}

/* ── section ─────────────────────────────────────────────────────────────── */

export default function ActivitiesSection({ userId }) {
  const actions = useActivities(userId)
  const { items, loading, error } = actions
  const [searchParams, setSearchParams] = useSearchParams()
  const [adding, setAdding] = useState(false)
  const [focusId, setFocusId] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [toast, setToast] = useState(null)
  const [dragId, setDragId] = useState(null)
  const toastTimer = useRef(null)

  const typeParam = searchParams.get('type') || 'all'
  const filter = typeParam !== 'all' && ACTIVITY_CATEGORIES.some((c) => c.key === typeParam) ? typeParam : 'all'
  const selectedId = searchParams.get('id')
  const selected = useMemo(() => items.find((item) => item.id === selectedId) || null, [items, selectedId])
  const counts = useMemo(() => categoryCounts(items), [items])
  const ranked = items.map((item, index) => ({ item, rank: index + 1 }))
  const filtered = filter === 'all' ? items : items.filter((item) => item.activity_type === filter)
  const reachedLimit = items.length >= ACTIVITY_LIMITS.max

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

  const showToast = useCallback((message, action) => {
    clearTimeout(toastTimer.current)
    setToast({ message, action })
    toastTimer.current = setTimeout(() => setToast(null), 6000)
  }, [])

  const openRow = useCallback((row) => {
    setAdding(false)
    setParams({ type: row.activity_type, id: row.id })
  }, [setParams])

  // The panel itself confirms before throwing away an unsaved new activity.
  const closePanel = useCallback(() => {
    setAdding(false)
    setParams({ id: null })
  }, [setParams])

  const startAdd = useCallback((category) => {
    if (reachedLimit) return
    setAdding(true)
    setFocusId(null)
    setParams({ type: category && category !== 'all' ? category : null, id: null })
  }, [reachedLimit, setParams])

  const handleCreate = useCallback(async (draft) => {
    const row = await actions.create(draft)
    setAdding(false)
    setFocusId(row.id)
    setParams({ type: row.activity_type, id: row.id })
    showToast(`${row.organization_name} added. Add a description when you are ready.`, {
      label: 'Undo',
      run: async () => {
        try {
          await actions.remove(row.id)
          setParams({ id: null })
          setToast(null)
        } catch (cause) {
          showToast(cause?.message || 'Could not undo that.')
        }
      },
    })
  }, [actions, setParams, showToast])

  const handleSave = useCallback(async (draft) => {
    if (!selected) return
    await actions.update(selected.id, draft)
  }, [actions, selected])

  const handleDelete = useCallback(async (row) => {
    try {
      await actions.remove(row.id)
      setParams({ id: null })
      showToast(`${row.organization_name || 'Activity'} deleted`, {
        label: 'Undo',
        run: async () => {
          try {
            await actions.restore(row)
            showToast('Restored')
          } catch (cause) {
            showToast(cause?.message || 'Could not restore that activity.')
          }
        },
      })
    } catch (cause) {
      showToast(cause?.message || 'Could not delete that activity.')
    }
  }, [actions, setParams, showToast])

  const handleDuplicate = useCallback(async (row) => {
    try {
      const copy = await actions.duplicate(row.id)
      showToast(`${copy.organization_name} created`, { label: 'Edit', run: () => openRow(copy) })
    } catch (cause) {
      showToast(cause?.message || 'Could not duplicate that activity.')
    }
  }, [actions, openRow, showToast])

  const handleMoveTop = useCallback(async (row) => {
    try {
      await actions.moveToTop(row.id)
    } catch (cause) {
      showToast(cause?.message || 'Could not save the new order.')
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
    } catch {
      showToast('Couldn\'t save the new order · Retry', { label: 'Retry', run: () => actions.reorder(next).catch(() => showToast('Still could not save the order.')) })
    }
  }

  const subtitle = filter === 'all'
    ? 'Drag to set the order. Put your most important activity first.'
    : 'Click an activity to see and edit its details.'

  const chips = ACTIVITY_CATEGORIES
    .filter((category) => counts[category.key] || filter === category.key)
    .map((category) => ({ ...category, count: counts[category.key] || 0 }))

  const panelOpen = adding || Boolean(selected)

  return (
    <section className="act">
      <header className="act-head">
        <div>
          <h1 className="act-title">Activities &amp; Experiences</h1>
          <p className="act-sub">{subtitle}</p>
        </div>
        <button
          type="button"
          className="act-add-btn"
          onClick={() => startAdd(filter)}
          disabled={reachedLimit && !adding}
          title={reachedLimit ? `You can add up to ${ACTIVITY_LIMITS.max} activities` : undefined}
        >
          <span aria-hidden="true">＋</span> Add activity
        </button>
      </header>

      {reachedLimit && (
        <p className="act-limit" role="status">You have reached the {ACTIVITY_LIMITS.max}-activity limit. Delete one to add another.</p>
      )}

      <div className="act-toolbar">
            <div className="act-chips" role="group" aria-label="Filter activities by category">
              <button
                type="button"
                className={`act-chip${filter === 'all' ? ' act-chip--on' : ''}`}
                aria-pressed={filter === 'all'}
                onClick={() => setParams({ type: null, id: null })}
              >
                All <span className="act-chip__n">{items.length}</span>
              </button>
              {chips.map((category) => (
                <button
                  key={category.key}
                  type="button"
                  className={`act-chip${filter === category.key ? ' act-chip--on' : ''}`}
                  aria-pressed={filter === category.key}
                  onClick={() => setParams({ type: category.key, id: null })}
                >
                  {category.chipLabel} <span className="act-chip__n">{category.count}</span>
                </button>
              ))}
            </div>
            {filter === 'all' && items.length > 0 && (
              <span className="act-usage">{Math.min(items.length, ACTIVITY_LIMITS.recommended)} / {ACTIVITY_LIMITS.recommended} activities</span>
            )}
      </div>

      <div className={`act-columns${panelOpen ? ' act-columns--panel' : ''}`}>
        <div className="act-main">
          {error ? (
            <div className="act-state act-state--error">
              <p>Couldn&apos;t load your activities</p>
              <button type="button" className="act-btn act-btn--retry" onClick={actions.retry}>Retry</button>
            </div>
          ) : loading ? (
            <div className="act-skeleton" aria-hidden="true">
              {[0, 1, 2].map((key) => <div key={key} className="act-skeleton__row" />)}
            </div>
          ) : filter === 'all' ? (
            items.length === 0 ? (
              <EmptyState onAdd={() => startAdd('all')} />
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={({ active }) => setDragId(active.id)}
                onDragCancel={() => setDragId(null)}
                onDragEnd={onDragEnd}
              >
                <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                  <div className="act-rows">
                    {ranked.map(({ item, rank }) => (
                      <div key={item.id}>
                        <SortableRow
                          row={item}
                          rank={rank}
                          onOpen={openRow}
                          onEdit={() => openRow(item)}
                          onDuplicate={() => handleDuplicate(item)}
                          onMoveTop={() => handleMoveTop(item)}
                          onDelete={() => setDeleting(item)}
                        />
                        {rank === ACTIVITY_LIMITS.recommended && items.length > ACTIVITY_LIMITS.recommended && (
                          <p className="act-divider-note">Most applications include only your first {ACTIVITY_LIMITS.recommended} activities</p>
                        )}
                      </div>
                    ))}
                  </div>
                </SortableContext>
                <DragOverlay dropAnimation={null}>
                  {dragRow ? <RowPreview row={dragRow} rank={dragRank} /> : null}
                </DragOverlay>
              </DndContext>
            )
          ) : filtered.length === 0 ? (
            <div className="act-state">
              <p>No {categoryLabel(filter).toLowerCase()} activities yet</p>
              <button type="button" className="act-btn act-btn--ghost" onClick={() => startAdd(filter)}>
                ＋ Add {CATEGORY_ADD_LABELS[filter]}
              </button>
            </div>
          ) : (
            <div className="act-cards">
              {filtered.map((item) => (
                <ActivityCard
                  key={item.id}
                  row={item}
                  selected={item.id === selectedId}
                  onOpen={openRow}
                  onEdit={() => openRow(item)}
                  onDuplicate={() => handleDuplicate(item)}
                  onMoveTop={() => handleMoveTop(item)}
                  onDelete={() => setDeleting(item)}
                />
              ))}
              {adding && (
                <ActivityCard
                  row={{ organization_name: '', position: '', activity_type: filter }}
                  isNew
                  selected
                  onOpen={() => {}}
                />
              )}
            </div>
          )}

          {!loading && !error && filter !== 'all' && filtered.length > 0 && !adding && (
            <button type="button" className="act-add-link" onClick={() => startAdd(filter)} disabled={reachedLimit}>
              ＋ Add {CATEGORY_ADD_LABELS[filter]}
            </button>
          )}

        {!loading && !error && items.length > 0 && (
          <p className="act-footnote">Changes are saved automatically.</p>
        )}
      </div>

      {panelOpen && (
        <ActivityPanel
            key={adding ? 'new' : selected?.id}
            mode={adding ? 'create' : 'edit'}
            row={adding ? undefined : selected}
            defaultType={filter === 'all' ? 'other' : filter}
            onSave={adding ? undefined : handleSave}
            onCreate={adding ? handleCreate : undefined}
            onClose={closePanel}
          instantFocus={focusId === selected?.id}
        />
      )}
    </div>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.organization_name || 'this activity'}?`}
        message="This cannot be undone."
        confirmLabel="Delete"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const row = deleting
          setDeleting(null)
          if (row) handleDelete(row)
        }}
      />

      {toast && (
        <div className="act-toast" role="status">
          <span>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                const action = toast.action
                setToast(null)
                action.run()
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

function EmptyState({ onAdd }) {
  return (
    <div className="act-empty">
      <div className="act-empty__tiles" aria-hidden="true">
        {['volunteering', 'work', 'sports', 'arts'].map((type) => <Tile key={type} type={type} size="lg" />)}
      </div>
      <p>Add your first activity. Sports, clubs, family responsibilities and part-time work all count.</p>
      <button type="button" className="act-add-btn" onClick={onAdd}><span aria-hidden="true">＋</span> Add activity</button>
    </div>
  )
}
