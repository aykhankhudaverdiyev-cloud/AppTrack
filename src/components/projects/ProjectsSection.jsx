/**
 * ============================================================================
 * ProjectsSection — the Projects page (cards + sticky detail panel)
 * ============================================================================
 * Header, category chips, a 40 / 60 split of project cards and the selected
 * project's panel, and the "+ Add project" link. The filter and the open
 * project live in the URL (?type=…&id=…), so refresh keeps them.
 * ============================================================================
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ProjectPanel from './ProjectPanel'
import { PROJECT_TYPES } from '../../constants/projectTypes'
import {
  hasLinkedActivity, projectAddLabel, projectCategoryCounts, projectSummary, projectTags,
  projectTile, projectTypeLabel, projectTypeMeta, statusMeta,
} from '../../utils/projects'
import { useProjects } from '../../hooks/useProjects'
import { isGraduateLevel } from '../../utils/academicRules'
import { AcademicCollection } from '../academic/AcademicSection'
import { ConfirmDialog } from '../forms'
import './ProjectsSection.css'

/* ── card menu ───────────────────────────────────────────────────────────── */

function CardMenu({ project, onEdit, onDuplicate, onDelete }) {
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
    <div className="prj-menu" ref={wrap} onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="prj-menu__btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${project.title || 'this project'}`}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <div className="prj-menu__list" role="menu">
          <button type="button" role="menuitem" onClick={pick(onEdit)}>Edit</button>
          <button type="button" role="menuitem" onClick={pick(onDuplicate)}>Duplicate</button>
          <button type="button" role="menuitem" className="prj-menu__danger" onClick={pick(onDelete)}>Delete</button>
        </div>
      )}
    </div>
  )
}

/* ── card ────────────────────────────────────────────────────────────────── */

function ProjectCard({ project, selected, isNew, onOpen, onEdit, onDuplicate, onDelete }) {
  const tile = isNew ? { emoji: '＋', tint: projectTypeMeta(project.project_type || 'software_app').tint } : projectTile(project)
  const tags = projectTags(project)
  const status = statusMeta(project.status)
  const title = isNew ? (String(project.title || '').trim() || 'New project') : (project.title || 'Untitled project')

  return (
    <article
      className={`prj-card${selected ? ' prj-card--selected' : ''}${isNew ? ' prj-card--new' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(project)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(project)
        }
      }}
      aria-label={`${title}, ${status.label}${isNew ? ', not saved yet' : ''}`}
    >
      <span className={`prj-tile prj-tile--${tile.tint}${isNew ? ' prj-tile--new' : ''}`} aria-hidden="true">{tile.emoji}</span>
      <div className="prj-card__text">
        <h3>{title}</h3>
        {isNew
          ? <p className="prj-card__summary">Not saved yet</p>
          : (projectSummary(project) ? <p className="prj-card__summary">{projectSummary(project)}</p> : null)}
        {tags.length > 0 && (
          <div className="prj-card__tags">
            {tags.map((tag) => <span key={tag} className="prj-tag">{tag}</span>)}
          </div>
        )}
        <div className="prj-card__foot">
          {isNew
            ? <span className="prj-pill prj-pill--new">New</span>
            : <span className={`prj-pill prj-pill--${status.tone}`}>{status.dot && <span className="prj-pill__dot" aria-hidden="true">●</span>}{status.label}</span>}
          {!isNew && hasLinkedActivity(project) && (
            <span className="prj-card__link"><span aria-hidden="true">🔗</span> Linked to Activities</span>
          )}
        </div>
      </div>
      {!isNew && <CardMenu project={project} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} />}
    </article>
  )
}

/* ── section ─────────────────────────────────────────────────────────────── */

export default function ProjectsSection({ userId, activities = [], level, library }) {
  const actions = useProjects(userId)
  const { items, loading, error } = actions
  const [searchParams, setSearchParams] = useSearchParams()
  const [adding, setAdding] = useState(false)
  const [focusId, setFocusId] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  const typeParam = searchParams.get('type') || 'all'
  const filter = typeParam !== 'all' && PROJECT_TYPES.some((type) => type.key === typeParam) ? typeParam : 'all'
  const selectedId = searchParams.get('id')
  const selected = useMemo(() => items.find((item) => item.id === selectedId) || null, [items, selectedId])
  const counts = useMemo(() => projectCategoryCounts(items), [items])
  const filtered = filter === 'all' ? items : items.filter((item) => item.project_type === filter)

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

  const openProject = useCallback((row) => {
    setAdding(false)
    setParams({ type: row.project_type, id: row.id })
  }, [setParams])

  // The panel itself confirms before throwing away an unsaved new project.
  const closePanel = useCallback(() => {
    setAdding(false)
    setParams({ id: null })
  }, [setParams])

  const startAdd = useCallback((type) => {
    setAdding(true)
    setFocusId(null)
    setParams({ type: type && type !== 'all' ? type : null, id: null })
  }, [setParams])

  const handleCreate = useCallback(async (draft) => {
    const row = await actions.create(draft)
    setAdding(false)
    setFocusId(row.id)
    setParams({ type: row.project_type, id: row.id })
    showToast(`${row.title} added. Add the details when you are ready.`, {
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
      showToast(`${row.title || 'Project'} deleted`, {
        label: 'Undo',
        run: async () => {
          try {
            await actions.restore(row)
            showToast('Restored')
          } catch (cause) {
            showToast(cause?.message || 'Could not restore that project.')
          }
        },
      })
    } catch (cause) {
      showToast(cause?.message || 'Could not delete that project.')
    }
  }, [actions, setParams, showToast])

  const handleDuplicate = useCallback(async (row) => {
    try {
      const copy = await actions.duplicate(row.id)
      showToast(`${copy.title} created`, { label: 'Edit', run: () => openProject(copy) })
    } catch (cause) {
      showToast(cause?.message || 'Could not duplicate that project.')
    }
  }, [actions, openProject, showToast])

  const chips = PROJECT_TYPES
    .filter((type) => counts[type.key] || filter === type.key)
    .map((type) => ({ ...type, count: counts[type.key] || 0 }))

  const panelOpen = adding || Boolean(selected)
  const graduates = isGraduateLevel(level)

  return (
    <section className="prj">
      <header className="prj-head">
        <div>
          <h1 className="prj-title">Projects</h1>
          <p className="prj-sub">Details, results and links for the things you built or researched.</p>
        </div>
        <button type="button" className="prj-add-btn" onClick={() => startAdd(filter)}>
          <span aria-hidden="true">+</span> Add project
        </button>
      </header>

      <div className="prj-chips" role="group" aria-label="Filter projects by type">
        <button
          type="button"
          className={`prj-chip${filter === 'all' ? ' prj-chip--on' : ''}`}
          aria-pressed={filter === 'all'}
          onClick={() => setParams({ type: null, id: null })}
        >
          All <span className="prj-chip__n">{items.length}</span>
        </button>
        {chips.map((type) => (
          <button
            key={type.key}
            type="button"
            className={`prj-chip${filter === type.key ? ' prj-chip--on' : ''}`}
            aria-pressed={filter === type.key}
            onClick={() => setParams({ type: type.key, id: null })}
          >
            {type.label} <span className="prj-chip__n">{type.count}</span>
          </button>
        ))}
      </div>

      <div className={`prj-columns${panelOpen ? ' prj-columns--panel' : ''}`}>
        <div className="prj-main">
          {error ? (
            <div className="prj-state prj-state--error">
              <p>Couldn&apos;t load your projects</p>
              <button type="button" className="prj-btn prj-btn--ghost" onClick={actions.retry}>Retry</button>
            </div>
          ) : loading ? (
            <div className="prj-skeleton" aria-hidden="true">
              {[0, 1, 2].map((key) => <div key={key} className="prj-skeleton__card" />)}
            </div>
          ) : items.length === 0 ? (
            <EmptyState onAdd={() => startAdd('all')} />
          ) : filtered.length === 0 ? (
            <div className="prj-state">
              <p>No {projectTypeLabel(filter).toLowerCase()} projects yet</p>
              <button type="button" className="prj-btn prj-btn--ghost" onClick={() => startAdd(filter)}>
                ＋ Add {projectAddLabel(filter)}
              </button>
            </div>
          ) : (
            <div className="prj-cards">
              {filtered.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  selected={project.id === selectedId}
                  onOpen={openProject}
                  onEdit={() => openProject(project)}
                  onDuplicate={() => handleDuplicate(project)}
                  onDelete={() => setDeleting(project)}
                />
              ))}
              {adding && (
                <ProjectCard
                  project={{ project_type: filter === 'all' ? 'software_app' : filter }}
                  isNew
                  selected
                  onOpen={() => {}}
                />
              )}
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <button
              type="button"
              className="prj-add-link"
              onClick={() => startAdd(filter)}
            >
              <span aria-hidden="true">+</span> Add project
            </button>
          )}

          {!loading && !error && items.length > 0 && (
            <p className="prj-footnote">Changes are saved automatically.</p>
          )}

          {graduates && library && (
            <details className="prj-publications">
              <summary>Publications (optional)</summary>
              <AcademicCollection table="publications" userId={userId} library={library} />
            </details>
          )}
        </div>

        {panelOpen && (
          <ProjectPanel
            key={adding ? 'new' : selected?.id}
            mode={adding ? 'create' : 'edit'}
            row={adding ? undefined : selected}
            defaultType={filter === 'all' ? 'software_app' : filter}
            activities={activities}
            onSave={adding ? undefined : handleSave}
            onCreate={adding ? handleCreate : undefined}
            onClose={closePanel}
            instantFocus={adding || focusId === selected?.id}
          />
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.title || 'this project'}?`}
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
        <div className="prj-toast" role="status">
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
    <div className="prj-empty">
      <div className="prj-empty__tiles" aria-hidden="true">
        <span className="prj-tile prj-tile--lilac">🗂️</span>
        <span className="prj-tile prj-tile--sky">🤖</span>
        <span className="prj-tile prj-tile--mint">🔬</span>
      </div>
      <p>Add your first project. Apps, research, data work and competition entries all count.</p>
      <button type="button" className="prj-add-btn" onClick={onAdd}><span aria-hidden="true">+</span> Add project</button>
    </div>
  )
}
