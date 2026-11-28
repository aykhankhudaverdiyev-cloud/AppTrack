/**
 * ============================================================================
 * ActivityPanel — ONE panel for both add and edit (spec §5.2, §5.3)
 * ============================================================================
 * Edit mode autosaves (800 ms debounce + blur, optimistic, inline validation).
 * Create mode is a form with a sticky footer that unlocks at 6/6 required
 * fields. Type-specific blocks (Work details, Research details) and the
 * description fields follow the type dropdown; hidden values are kept, so
 * switching type never loses shared data.
 * ============================================================================
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { DatePicker, GradeChips, SegmentedControl, TagSelect } from '../section'
import { usePanelValidation } from '../../hooks/usePanelValidation'
import { InlineError, ValidationSummary, NumericInput } from '../forms/PanelValidation'
import { readCreateDraft, useCreateDraft, useAutosave } from '../../hooks/useAutosave'
import { ACTIVITY_CATEGORIES, ACTIVITY_LIMITS } from '../../constants/activityTypes'
import {
  MODE_LABELS, OUTPUT_LABELS, REQUIRED_FIELDS, TIMING_LABELS,
  draftFromRow, emptyDraft, expectedDescriptionFields, hoursHelperText,
  validateActivity,
} from '../../utils/activities'

const MODE_OPTIONS = Object.entries(MODE_LABELS).map(([value, label]) => ({ value, label }))
const TIMING_OPTIONS = Object.entries(TIMING_LABELS).map(([value, label]) => ({ value, label }))
const PAY_OPTIONS = [{ value: 'paid', label: 'Paid' }, { value: 'unpaid', label: 'Unpaid' }]
const TYPE_OPTIONS = [
  { value: 'part_time', label: 'Part-time' },
  { value: 'full_time', label: 'Full-time' },
]
const OUTPUT_OPTIONS = Object.entries(OUTPUT_LABELS).map(([value, label]) => ({ value, label }))

function savedLabel(savedAt, now) {
  if (!savedAt) return ''
  const seconds = Math.max(0, Math.round((now - savedAt.getTime()) / 1000))
  if (seconds < 5) return 'Saved just now'
  if (seconds < 60) return `Saved ${seconds} s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `Saved ${minutes} min ago`
  return `Saved ${Math.round(minutes / 60)} h ago`
}

/* ── small building blocks ───────────────────────────────────────────────── */

function TextField({ label, value, onChange, onBlur, error, required, fieldKey, min, max, hint, placeholder, maxLength, inputMode, type = 'text' }) {
  const id = useId()
  const Input = type === 'number' ? NumericInput : 'input'
  return (
    <div data-form-field={fieldKey} className={`act-field${error ? ' act-field--invalid' : ''}`}>
      <label className="act-label" htmlFor={id}>
        {label}
        {required && <span className="act-req" aria-hidden="true"> *</span>}
      </label>
      <Input
        id={id}
        className="act-input"
        type={type}
        min={min}
        max={max}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
      {hint && !error && <p className="act-hint">{hint}</p>}
      <InlineError id={`${id}-err`} message={error} />
    </div>
  )
}



function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text || '')
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1400)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button type="button" className="act-copy" onClick={copy} title={`Copy ${label}`} aria-label={`Copy ${label}`}>
      <span aria-hidden="true">⧉</span>
      {copied && <span className="act-copy__tip" role="status">Copied</span>}
    </button>
  )
}

function DescriptionField({ id, label, value, max, onChange, onBlur, error, autoFocus, fieldKey }) {
  const ref = useRef(null)
  const [shortened, setShortened] = useState(false)
  useEffect(() => { if (autoFocus) ref.current?.focus() }, [autoFocus])

  const length = value.length
  const percent = Math.min(100, (length / max) * 100)
  const tone = percent >= 90 ? 'warn' : 'ok'

  const handle = (raw) => {
    if (raw.length > max) {
      setShortened(true)
      clearTimeout(window.__actShortenTimer)
      window.__actShortenTimer = setTimeout(() => setShortened(false), 3000)
      onChange(raw.slice(0, max))
      return
    }
    onChange(raw)
  }

  return (
    <div data-form-field={fieldKey} className={`act-field act-desc${error ? ' act-field--invalid' : ''}`}>
      <div className="act-label-row">
        <label className="act-label" htmlFor={id}>{label}<CopyButton text={value} label={label} /></label>
        <span className="act-counter" aria-live="polite">{length} / {max}</span>
      </div>
      <textarea
        id={id}
        ref={ref}
        className="act-input act-textarea"
        value={value}
        rows={3}
        maxLength={max}
        onChange={(event) => handle(event.target.value)}
        onBlur={onBlur}
        aria-describedby={error ? `${id}-err` : undefined}
        aria-invalid={error ? 'true' : undefined}
      />
      <div className={`act-progress act-progress--${tone}`} aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
      {shortened && <p className="act-hint act-hint--warn" role="status">Pasted text was shortened to {max} characters.</p>}
      <InlineError id={`${id}-err`} message={error} />
    </div>
  )
}

function SectionLabel({ children }) {
  return <p className="act-section-label">{children}</p>
}

/* ── panel ───────────────────────────────────────────────────────────────── */

export default function ActivityPanel({
  mode = 'edit',
  row, userId,
  defaultType = 'other',
  onSave,
  onCreate,
  onClose,
  instantFocus = false,
}) {
  // The baseline is captured once: the parent remounts the panel (key) when a
  // different activity is selected, so autosaves can never reset what is typed.
  const draftKey = mode === 'create' && userId ? `activities:${userId}` : null
  const [initial] = useState(() => (mode === 'edit' && row ? draftFromRow(row) : emptyDraft(defaultType)))
  const [draft, setDraft] = useState(() => readCreateDraft(draftKey) ?? initial)
  const clearDraft = useCreateDraft(draftKey, draft)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])

  const validation = usePanelValidation(validateActivity(draft, mode), draft.ongoing ? REQUIRED_FIELDS : [...REQUIRED_FIELDS, { key: 'end_month', label: 'End date' }])
  const { errors } = validation
  const blocked = Object.keys(errors).length > 0

  const persist = useCallback(async (payload) => {
    if (!onSave) return
    // Never write values the panel is showing an error for.
    if (Object.keys(validateActivity(payload, 'edit')).length) return
    await onSave(payload)
  }, [onSave])

  const { saving, savedAt, error: saveError, isDirty, markDirty, flush } = useAutosave(draft, persist, {
    delay: 800,
    enabled: mode === 'edit',
  })

  const set = (key, value) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'ongoing' && value) next.end_month = ''
      return next
    })
    if (mode === 'edit') markDirty()
  }

  const blur = () => { if (mode === 'edit') flush() }

  const cancelCreate = () => {
    const untouched = JSON.stringify(draft) === JSON.stringify(emptyDraft(defaultType))
    if (untouched) { clearDraft(); onClose?.() }
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
    if (mode !== 'create' || creating || !validation.validateSubmit()) return
    setCreating(true)
    setCreateError('')
    try {
      await onCreate?.(draft)
      clearDraft()
    } catch (error) {
      setCreateError(error?.message || 'Could not create the activity. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const isWork = draft.activity_type === 'work'
  const isResearch = draft.activity_type === 'research'
  const descFields = expectedDescriptionFields(draft.activity_type)
  const showsOrgDescription = descFields.includes('organization_description')

  const statusText = mode === 'create'
    ? 'Not saved yet'
    : blocked
      ? 'Check the highlighted fields'
      : saving
        ? 'Saving…'
        : saveError
          ? "Couldn't save · Retry"
          : savedAt && !isDirty
            ? `${savedLabel(savedAt, now)} ✓`
            : isDirty ? 'Unsaved changes' : 'All changes saved'

  return (
    <aside
      className={`act-panel${mode === 'create' ? ' act-panel--create' : ''}`}
      role="region"
      aria-label={mode === 'create' ? 'New activity' : `${draft.organization_name || 'Activity'} details`}
      tabIndex={-1}
    >
      <header className="act-panel__head">
        <button type="button" className="act-panel__back" onClick={requestClose} aria-label="Back to the list">
          <span aria-hidden="true">←</span>
        </button>
        <span className={`act-tile act-tile--${ACTIVITY_CATEGORIES.find((c) => c.key === draft.activity_type)?.tint || 'slate'}${mode === 'create' ? ' act-tile--new' : ''}`} aria-hidden="true">
          {mode === 'create' ? '＋' : ACTIVITY_CATEGORIES.find((c) => c.key === draft.activity_type)?.emoji}
        </span>
        <h2 className="act-panel__title">
          {mode === 'create' ? 'New activity' : (draft.organization_name.trim() || 'Untitled activity')}
        </h2>
        <TagSelect label="Activity category" value={draft.activity_type}
          options={ACTIVITY_CATEGORIES.map(({ key, label }) => ({ value: key, label }))}
          onChange={(value) => set('activity_type', value)} />
        <span className={`act-save${saveError ? ' act-save--error' : ''}`} role="status" aria-live="polite">
          {saveError ? (
            <button type="button" className="act-save__retry" onClick={flush}>Couldn&apos;t save · Retry</button>
          ) : statusText}
        </span>
        <button type="button" className="act-panel__close" onClick={requestClose} aria-label="Close panel">
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <form className="act-panel__body panel-validation" onSubmit={submitCreate} {...validation.formProps}>
        <SectionLabel>Basics</SectionLabel>
        <div className="act-grid">
          <TextField
            label="Organization name"
            required
            value={draft.organization_name}
            onChange={(value) => set('organization_name', value.slice(0, ACTIVITY_LIMITS.organizationName))}
            onBlur={blur}
            fieldKey="organization_name"
            error={errors.organization_name}
            placeholder="e.g. City Library"
          />
          <TextField
            label="Your role"
            required
            value={draft.position}
            onChange={(value) => set('position', value.slice(0, ACTIVITY_LIMITS.position))}
            onBlur={blur}
            fieldKey="position"
            error={errors.position}
            placeholder="e.g. Organiser"
          />

          <GradeChips
            value={draft.grade_levels}
            onChange={(value) => set('grade_levels', value)}
            fieldKey="grade_levels"
            error={errors.grade_levels}
            required
          />
          <SegmentedControl
            label="Mode"
            name="activity-mode"
            value={draft.participation_mode}
            onChange={(value) => set('participation_mode', value)}
            options={MODE_OPTIONS}
          />

          <div className="act-field" data-form-field="hours_per_week">
            <label className="act-label" htmlFor="act-hours">Hours per week<span className="act-req" aria-hidden="true"> *</span></label>
            <NumericInput
              id="act-hours"
              className={`act-input${errors.hours_per_week ? ' act-input--invalid' : ''}`}
              placeholder="e.g. 5"
              aria-describedby={errors.hours_per_week ? 'act-hours-err' : undefined}
              min={ACTIVITY_LIMITS.hoursPerWeek.min}
              max={ACTIVITY_LIMITS.hoursPerWeek.max}
              step={ACTIVITY_LIMITS.hoursPerWeek.step}
              value={draft.hours_per_week}
              aria-invalid={errors.hours_per_week ? 'true' : undefined}
              onChange={(event) => set('hours_per_week', event.target.value)}
              onBlur={blur}
            />
            <p className="act-hint">{hoursHelperText(draft.hours_per_week, draft.weeks_per_year, draft.ongoing)}</p>
            <InlineError id="act-hours-err" message={errors.hours_per_week} />
          </div>
          <TextField
            label="Weeks per year"
            required
            type="number"
            inputMode="numeric"
            min={ACTIVITY_LIMITS.weeksPerYear.min}
            max={ACTIVITY_LIMITS.weeksPerYear.max}
            value={draft.weeks_per_year}
            onChange={(value) => set('weeks_per_year', value)}
            onBlur={blur}
            fieldKey="weeks_per_year"
            error={errors.weeks_per_year}
            placeholder="e.g. 30"
          />

          <div className="act-field">
            <div className="act-start-row">
              <DatePicker
                label="Start date" allowFuture={false}
                required
                value={draft.start_month}
                onChange={(value) => set('start_month', value)}
                onBlur={blur}
                fieldKey="start_month"
                error={errors.start_month}
              />
              <label className="act-switch">
                <input
                  type="checkbox"
                  checked={draft.ongoing}
                  onChange={(event) => set('ongoing', event.target.checked)}
                />
                <span className="act-switch__track" aria-hidden="true"><span /></span>
                <span className="act-switch__text">Ongoing</span>
              </label>
            </div>
          </div>
          {draft.ongoing ? (
            <TextField
              label="Location"
              value={draft.location}
              onChange={(value) => set('location', value)}
              onBlur={blur}
              placeholder="City, Country"
            />
          ) : (
            <DatePicker
              label="End date" min={draft.start_month || undefined}
              required
              value={draft.end_month}
              onChange={(value) => set('end_month', value)}
              onBlur={blur}
              fieldKey="end_month"
              error={errors.end_month}
            />
          )}

          {!draft.ongoing && (
            <TextField
              label="Location"
              value={draft.location}
              onChange={(value) => set('location', value)}
              onBlur={blur}
              placeholder="City, Country"
            />
          )}
          {isWork && (
            <SegmentedControl
              label="Timing"
              name="activity-timing"
              value={draft.timing}
              onChange={(value) => set('timing', value)}
              options={TIMING_OPTIONS}
            />
          )}
        </div>

        {isWork && (
          <>
            <SectionLabel>Work details</SectionLabel>
            <div className="act-grid">
              <SegmentedControl
                label="Pay"
                name="activity-pay"
                value={draft.is_paid ? 'paid' : 'unpaid'}
                onChange={(value) => set('is_paid', value === 'paid')}
                options={PAY_OPTIONS}
              />
              <SegmentedControl
                label="Type"
                name="activity-employment"
                value={draft.employment_type}
                onChange={(value) => set('employment_type', value)}
                options={TYPE_OPTIONS}
              />
              <TextField
                label="Supervisor name"
                value={draft.supervisor_name}
                onChange={(value) => set('supervisor_name', value)}
                onBlur={blur}
                placeholder="Full name"
              />
              <TextField
                label="Supervisor email"
                type="email"
                value={draft.supervisor_email}
                onChange={(value) => set('supervisor_email', value)}
                onBlur={blur}
                fieldKey="supervisor_email"
                error={errors.supervisor_email}
                placeholder="name@company.com"
              />
            </div>
            <p className="act-hint act-hint--block">Optional. Some applications ask for a contact.</p>
          </>
        )}

        {isResearch && (
          <>
            <SectionLabel>Research details</SectionLabel>
            <div className="act-grid">
              <TextField
                label="Mentor"
                value={draft.research_mentor}
                onChange={(value) => set('research_mentor', value)}
                onBlur={blur}
                placeholder="Supervising researcher"
              />
              <TextField
                label="Institution"
                value={draft.research_institution}
                onChange={(value) => set('research_institution', value)}
                onBlur={blur}
                placeholder="Lab or university"
              />
              <TextField
                label="Research question"
                value={draft.research_question}
                onChange={(value) => set('research_question', value.slice(0, ACTIVITY_LIMITS.researchQuestion))}
                onBlur={blur}
                fieldKey="research_question"
                error={errors.research_question}
                placeholder="What did you investigate?"
              />
              <div className="act-field">
                <label className="act-label">Output status</label>
                <TagSelect label="Output status" value={draft.output_status} options={OUTPUT_OPTIONS}
                  onChange={(value) => set('output_status', value)} />
              </div>
            </div>
          </>
        )}

        <SectionLabel>Description{mode === 'create' ? <span className="act-section-label__note"> optional, you can write it later</span> : null}</SectionLabel>
        <div className="act-desc-stack">
          {showsOrgDescription && (
            <DescriptionField
              id="act-org-description"
              label="About the organization"
              value={draft.organization_description}
              max={ACTIVITY_LIMITS.organizationDescription}
              onChange={(value) => set('organization_description', value)}
              onBlur={blur}
              fieldKey="organization_description"
              error={errors.organization_description}
              autoFocus={instantFocus && !draft.organization_description}
            />
          )}
          <DescriptionField
            id="act-long-description"
            label="What you did"
            value={draft.long_description}
            max={ACTIVITY_LIMITS.longDescription}
            onChange={(value) => set('long_description', value)}
            onBlur={blur}
            fieldKey="long_description"
            error={errors.long_description}
            autoFocus={instantFocus && (showsOrgDescription ? Boolean(draft.organization_description) : true)}
          />
        </div>

        <p className="act-tip">💡 Tip: start with an action verb and include at least one number.</p>

        {mode === 'create' && (
          <footer className="act-panel__footer">
            <ValidationSummary validation={validation} className="act-required" completeClassName="act-required--done" />
            {createError && <p className="act-field-error" role="alert">{createError}</p>}
            <div className="act-panel__footer-actions">
              <button type="button" className="act-btn act-btn--ghost" onClick={cancelCreate}>Cancel</button>
              <button type="submit" className="act-btn act-btn--primary" disabled={creating}>
                {creating ? 'Creating…' : 'Create activity'}
              </button>
            </div>
          </footer>
        )}
      </form>

      {confirmDiscard && (
        <div className="act-discard" role="presentation" onClick={() => setConfirmDiscard(false)}>
          <div className="act-discard__box" role="alertdialog" aria-modal="true" aria-label="Discard this activity?" onClick={(event) => event.stopPropagation()}>
            <h3>Discard this activity?</h3>
            <p>Nothing has been saved yet.</p>
            <div className="act-discard__actions">
              <button type="button" className="act-btn act-btn--ghost" onClick={() => setConfirmDiscard(false)}>Keep editing</button>
              <button type="button" className="act-btn act-btn--danger" onClick={() => { setConfirmDiscard(false); clearDraft(); onClose?.() }}>Discard</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
