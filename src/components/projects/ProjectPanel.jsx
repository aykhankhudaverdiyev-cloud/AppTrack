/**
 * ============================================================================
 * ProjectPanel — the right-hand panel of the Projects page (spec mockup)
 * ============================================================================
 * One panel for both add and edit. Edit mode autosaves (800 ms debounce +
 * blur, optimistic, inline validation); create mode is a form with a sticky
 * footer that unlocks as soon as the project has a title.
 *
 * Sections: BASICS (title, role, start date, status) → DETAILS (Problem,
 * What you built, Result — each with a counter and a progress track) →
 * TECH AND LINKS (technologies, GitHub, live demo) → CONNECTIONS (linked
 * activity, visibility).
 * ============================================================================
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useAutosave } from '../../hooks/useAutosave'
import {
  PROJECT_LIMITS, PROJECT_ROLES, PROJECT_STATUSES, PROJECT_TYPES, PROJECT_VISIBILITIES,
} from '../../constants/projectTypes'
import {
  draftFromRow, emptyProjectDraft, projectTile, projectTypeMeta, requiredCompleted,
  rowFromDraft, validateProject,
} from '../../utils/projects'
import { formatMonthInput, parseMonthInput } from '../../utils/activities'

const ROLE_OPTIONS = PROJECT_ROLES.map((role) => ({ value: role.key, label: role.label }))
const STATUS_OPTIONS = PROJECT_STATUSES.map((status) => ({ value: status.key, label: status.label }))
const VISIBILITY_OPTIONS = PROJECT_VISIBILITIES.map((option) => ({ value: option.key, label: option.label }))
const DEV_URL = 'https://'

function savedLabel(savedAt, now) {
  if (!savedAt) return ''
  const seconds = Math.max(0, Math.round((now - savedAt.getTime()) / 1000))
  if (seconds < 5) return 'Saved just now'
  if (seconds < 60) return `Saved ${seconds} s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `Saved ${minutes} min ago`
  return `Saved ${Math.round(minutes / 60)} h ago`
}

/* ── building blocks ─────────────────────────────────────────────────────── */

function FieldError({ id, message }) {
  if (!message) return null
  return <p className="prj-field-error" id={id} role="alert">{message}</p>
}

function SectionLabel({ children }) {
  return <p className="prj-section-label">{children}</p>
}

function TextField({ label, value, onChange, onBlur, error, placeholder, maxLength, required, id }) {
  const autoId = useId()
  const inputId = id || autoId
  return (
    <div className={`prj-field${error ? ' prj-field--invalid' : ''}`}>
      <label className="prj-label" htmlFor={inputId}>
        {label}
        {required && <span className="prj-req" aria-hidden="true"> *</span>}
      </label>
      <input
        id={inputId}
        className="prj-input"
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${inputId}-err` : undefined}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
      <FieldError id={`${inputId}-err`} message={error} />
    </div>
  )
}

function MonthField({ label, value, onChange, onBlur, error }) {
  const id = useId()
  const [text, setText] = useState(() => formatMonthInput(value))
  const lastValue = useRef(value)

  useEffect(() => {
    if (value !== lastValue.current) {
      lastValue.current = value
      setText(formatMonthInput(value))
    }
  }, [value])

  const handle = (raw) => {
    setText(raw)
    const parsed = parseMonthInput(raw)
    if (parsed || raw.trim() === '') {
      lastValue.current = parsed
      onChange(parsed)
    }
  }

  const invalid = text.trim() !== '' && !parseMonthInput(text)

  return (
    <div className={`prj-field${error || invalid ? ' prj-field--invalid' : ''}`}>
      <label className="prj-label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="prj-input"
        value={text}
        placeholder="MM/YYYY"
        inputMode="numeric"
        maxLength={7}
        aria-invalid={error || invalid ? 'true' : undefined}
        aria-describedby={error || invalid ? `${id}-err` : undefined}
        onChange={(event) => handle(event.target.value)}
        onBlur={onBlur}
      />
      <FieldError id={`${id}-err`} message={error || (invalid ? 'Use MM/YYYY' : '')} />
    </div>
  )
}

function Segmented({ label, value, onChange, options, name }) {
  return (
    <fieldset className="prj-field prj-segmented-field">
      <legend className="prj-label">{label}</legend>
      <div className="prj-segmented" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <label key={option.value} className={`prj-seg${value === option.value ? ' prj-seg--on' : ''}`}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function DescriptionField({ id, label, value, max, onChange, onBlur, error, rows = 2 }) {
  const ref = useRef(null)

  // Grow with the content so the box always shows the whole answer.
  useEffect(() => {
    const node = ref.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${node.scrollHeight}px`
  }, [value])

  const length = value.length
  const percent = Math.min(100, (length / max) * 100)
  const tone = percent >= 90 ? 'warn' : 'ok'

  return (
    <div className={`prj-field prj-desc${rows === 1 ? ' prj-desc--single' : ''}${error ? ' prj-field--invalid' : ''}`}>
      <div className="prj-label-row">
        <label className="prj-label" htmlFor={id}>{label}</label>
        <span className="prj-counter" aria-live="polite">{length} / {max}</span>
      </div>
      <textarea
        id={id}
        ref={ref}
        className="prj-input prj-textarea"
        value={value}
        rows={rows}
        maxLength={max}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        onChange={(event) => onChange(event.target.value.slice(0, max))}
        onBlur={onBlur}
      />
      <div className={`prj-progress prj-progress--${tone}`} aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
      <FieldError id={`${id}-err`} message={error} />
    </div>
  )
}

function TechnologyInput({ tags, onChange, onBlur, error }) {
  const [text, setText] = useState('')
  const inputRef = useRef(null)

  const add = (raw) => {
    const value = raw.trim().replace(/,+$/, '').slice(0, PROJECT_LIMITS.tagLength)
    if (!value) return
    const exists = tags.some((tag) => tag.toLowerCase() === value.toLowerCase())
    if (!exists && tags.length < PROJECT_LIMITS.tags) onChange([...tags, value])
    setText('')
  }

  return (
    <div className={`prj-field prj-tech${error ? ' prj-field--invalid' : ''}`}>
      <label className="prj-label" htmlFor="prj-tech-input">Technologies</label>
      <div
        className="prj-tech__box"
        onClick={() => inputRef.current?.focus()}
        role="presentation"
      >
        {tags.map((tag) => (
          <span key={tag} className="prj-tag prj-tag--removable">
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={(event) => {
                event.stopPropagation()
                onChange(tags.filter((item) => item !== tag))
              }}
            >
              <span aria-hidden="true">×</span>
            </button>
          </span>
        ))}
        <input
          id="prj-tech-input"
          ref={inputRef}
          className="prj-tech__input"
          value={text}
          placeholder={tags.length ? 'Add…' : 'React, Python, PostgreSQL…'}
          maxLength={PROJECT_LIMITS.tagLength}
          onChange={(event) => {
            const raw = event.target.value
            if (raw.includes(',')) {
              raw.split(',').forEach(add)
              return
            }
            setText(raw)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              add(text)
            }
            if (event.key === 'Backspace' && !text && tags.length) onChange(tags.slice(0, -1))
          }}
          onBlur={() => {
            if (text.trim()) add(text)
            onBlur?.()
          }}
        />
      </div>
      {tags.length >= PROJECT_LIMITS.tags && (
        <p className="prj-hint">You can list up to {PROJECT_LIMITS.tags} technologies.</p>
      )}
      <FieldError id="prj-tech-err" message={error} />
    </div>
  )
}

/* ── panel ───────────────────────────────────────────────────────────────── */

export default function ProjectPanel({
  mode = 'edit',
  row,
  defaultType = 'software_app',
  activities = [],
  onSave,
  onCreate,
  onClose,
  instantFocus = false,
}) {
  // The baseline is captured once: the parent remounts the panel (key) when a
  // different project is selected, so autosaves can never reset what is typed.
  const [initial] = useState(() => (mode === 'edit' && row ? draftFromRow(row) : emptyProjectDraft(defaultType)))
  const [draft, setDraft] = useState(initial)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const titleRef = useRef(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (instantFocus) titleRef.current?.focus()
  }, [instantFocus])

  const errors = useMemo(() => validateProject(draft, mode), [draft, mode])
  const blocked = Object.keys(errors).length > 0
  const completed = requiredCompleted(draft)
  const canCreate = completed === 1 && !blocked

  const persist = useCallback(async (payload) => {
    if (!onSave) return
    // Never write values the panel is showing an error for.
    if (Object.keys(validateProject(payload, 'edit')).length) return
    await onSave(payload)
  }, [onSave])

  const { saving, savedAt, error: saveError, markDirty, flush } = useAutosave(draft, persist, {
    delay: 800,
    enabled: mode === 'edit',
  })

  const set = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
    if (mode === 'edit') markDirty()
  }

  const blur = () => { if (mode === 'edit') flush() }

  const cancelCreate = () => {
    const untouched = JSON.stringify(draft) === JSON.stringify(emptyProjectDraft(defaultType))
    if (untouched) onClose?.()
    else setConfirmDiscard(true)
  }

  const requestClose = () => {
    if (mode === 'create') {
      cancelCreate()
      return
    }
    flush()
    onClose?.()
  }

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        requestClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const submitCreate = async (event) => {
    event.preventDefault()
    if (!canCreate || creating) return
    setCreating(true)
    setCreateError('')
    try {
      await onCreate?.(draft)
    } catch (error) {
      setCreateError(error?.message || 'Could not create the project. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const meta = projectTypeMeta(draft.project_type)
  const tile = mode === 'create'
    ? { emoji: '＋', tint: meta.tint }
    : projectTile({ ...rowFromDraft(draft), created_at: row?.created_at })
  const title = mode === 'create' ? 'New project' : String(draft.title || '').trim() || 'Untitled project'

  const statusText = mode === 'create'
    ? 'Not saved yet'
    : blocked
      ? 'Check the highlighted fields'
      : saving
        ? 'Saving…'
        : saveError
          ? 'Couldn\'t save · Retry'
          : savedAt
            ? `${savedLabel(savedAt, now)} ✓`
            : 'Saved just now ✓'

  const activityOptions = activities.map((activity) => ({
    value: activity.id,
    label: activity.organization_name || 'Activity',
  }))

  return (
    <aside
      className={`prj-panel${mode === 'create' ? ' prj-panel--create' : ''}`}
      role="region"
      aria-label={mode === 'create' ? 'New project' : `${title} details`}
      tabIndex={-1}
    >
      <header className="prj-panel__head">
        <button type="button" className="prj-panel__back" onClick={requestClose} aria-label="Back to the list">
          <span aria-hidden="true">←</span>
        </button>
        <span className={`prj-tile prj-tile--${tile.tint}${mode === 'create' ? ' prj-tile--new' : ''}`} aria-hidden="true">
          {tile.emoji}
        </span>
        <h2 className="prj-panel__title">{title}</h2>
        <label className="prj-type-tag">
          <span className="prj-type-tag__text">{meta.label}</span>
          <span aria-hidden="true">▾</span>
          <select
            value={draft.project_type}
            onChange={(event) => set('project_type', event.target.value)}
            aria-label="Project type"
          >
            {PROJECT_TYPES.map((option) => (
              <option key={option.key} value={option.key}>{option.full}</option>
            ))}
          </select>
        </label>
        <span className={`prj-save${saveError ? ' prj-save--error' : ''}`} role="status" aria-live="polite">
          {saveError ? (
            <button type="button" className="prj-save__retry" onClick={flush}>Couldn&apos;t save · Retry</button>
          ) : statusText}
        </span>
        <button type="button" className="prj-panel__close" onClick={requestClose} aria-label="Close panel">
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <form className="prj-panel__body" onSubmit={submitCreate}>
        <SectionLabel>Basics</SectionLabel>
        <div className="prj-grid">
          <TextField
            id="prj-title"
            label="Project title"
            required
            value={draft.title}
            onChange={(value) => set('title', value.slice(0, PROJECT_LIMITS.title))}
            onBlur={blur}
            error={errors.title}
            placeholder="e.g. AppTrack"
          />
          <Segmented
            label="Your role"
            name="prj-role"
            value={draft.role_type}
            onChange={(value) => set('role_type', value)}
            options={ROLE_OPTIONS}
          />
          <MonthField
            label="Start date"
            value={draft.start_month}
            onChange={(value) => set('start_month', value)}
            onBlur={blur}
            error={errors.start_month}
          />
          <Segmented
            label="Status"
            name="prj-status"
            value={draft.status}
            onChange={(value) => set('status', value)}
            options={STATUS_OPTIONS}
          />
        </div>

        <SectionLabel>Details</SectionLabel>
        <div className="prj-desc-stack">
          <DescriptionField
            id="prj-problem"
            label="Problem"
            value={draft.problem}
            max={PROJECT_LIMITS.problem}
            onChange={(value) => set('problem', value)}
            onBlur={blur}
            error={errors.problem}
          />
          <DescriptionField
            id="prj-build"
            label="What you built"
            value={draft.build_summary}
            max={PROJECT_LIMITS.buildSummary}
            onChange={(value) => set('build_summary', value)}
            onBlur={blur}
            error={errors.build_summary}
          />
          <DescriptionField
            id="prj-result"
            label="Result"
            value={draft.result}
            max={PROJECT_LIMITS.result}
            onChange={(value) => set('result', value)}
            onBlur={blur}
            error={errors.result}
            rows={1}
          />
        </div>

        <SectionLabel>Tech and links</SectionLabel>
        <div className="prj-grid">
          <div className="prj-span-2">
            <TechnologyInput
              tags={draft.tech_tags}
              onChange={(value) => set('tech_tags', value)}
              onBlur={blur}
            />
          </div>
          <TextField
            label="GitHub"
            value={draft.github_url}
            onChange={(value) => set('github_url', value)}
            onBlur={blur}
            error={errors.github_url}
            placeholder="github.com/…"
          />
          <TextField
            label="Live demo"
            value={draft.demo_url}
            onChange={(value) => set('demo_url', value)}
            onBlur={blur}
            error={errors.demo_url}
            placeholder={DEV_URL}
          />
        </div>

        <SectionLabel>Connections</SectionLabel>
        <div className="prj-grid">
          <div className={`prj-field${errors.related_activity_id ? ' prj-field--invalid' : ''}`}>
            <label className="prj-label" htmlFor="prj-linked">Linked activity</label>
            <select
              id="prj-linked"
              className="prj-input prj-select"
              value={draft.related_activity_id}
              onChange={(event) => set('related_activity_id', event.target.value)}
              onBlur={blur}
              disabled={!activityOptions.length}
            >
              <option value="">
                {activityOptions.length ? 'Choose an activity' : 'Add an activity first'}
              </option>
              {activityOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Segmented
              label="Visibility"
              name="prj-visibility"
              value={draft.visibility}
              onChange={(value) => set('visibility', value)}
              options={VISIBILITY_OPTIONS}
            />
            <p className="prj-hint">Public projects appear on your public profile.</p>
          </div>
        </div>

        {mode === 'create' && (
          <footer className="prj-panel__footer">
            <p className={`prj-required${canCreate ? ' prj-required--done' : ''}`} role="status">
              {canCreate ? '✓ ' : ''}{completed} of 1 required fields
            </p>
            {createError && <p className="prj-field-error" role="alert">{createError}</p>}
            <div className="prj-panel__footer-actions">
              <button type="button" className="prj-btn prj-btn--ghost" onClick={cancelCreate}>Cancel</button>
              <button type="submit" className="prj-btn prj-btn--primary" disabled={!canCreate || creating}>
                {creating ? 'Creating…' : 'Create project'}
              </button>
            </div>
          </footer>
        )}
      </form>

      {confirmDiscard && (
        <div className="prj-discard" role="presentation" onClick={() => setConfirmDiscard(false)}>
          <div
            className="prj-discard__box"
            role="alertdialog"
            aria-modal="true"
            aria-label="Discard this project?"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>Discard this project?</h3>
            <p>Nothing has been saved yet.</p>
            <div className="prj-discard__actions">
              <button type="button" className="prj-btn prj-btn--ghost" onClick={() => setConfirmDiscard(false)}>Keep editing</button>
              <button type="button" className="prj-btn prj-btn--danger" onClick={() => { setConfirmDiscard(false); onClose?.() }}>Discard</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
