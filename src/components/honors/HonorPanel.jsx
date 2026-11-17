/** ============================================================================
 * HonorPanel — ONE panel for both add and edit (spec §3)
 * Edit mode autosaves (800 ms debounce + blur, optimistic, inline validation).
 * Create mode is a form with a sticky footer that unlocks at 4/4 required
 * fields. Category / result / grade levels / recognition levels are chip
 * groups; dates are month-year pickers.
 * ============================================================================ */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAutosave } from '../../hooks/useAutosave'
import {
  ChipGroup, TextAreaField, MonthYearInput, DocumentPicker, TipBox,
} from '../section'
import {
  HONOR_CATEGORIES, HONOR_RESULTS, HONOR_GRADE_LEVELS, HONOR_LIMITS,
  honorCategory, honorCategoryLabel,
} from '../../constants/honors.js'
import { draftFromRow, emptyHonorDraft, validateHonor, requiredCompleted } from '../../utils/honors.js'

const RESULT_OPTIONS = HONOR_RESULTS.map((r) => ({ value: r.key, label: r.label }))
const GRADE_OPTIONS = HONOR_GRADE_LEVELS.map((n) => ({ value: String(n), label: `Grade ${n}` }))
const LEVEL_OPTIONS = [
  { value: 'school', label: 'School' },
  { value: 'city', label: 'City' },
  { value: 'regional', label: 'Regional' },
  { value: 'national', label: 'National' },
  { value: 'international', label: 'International' },
]

function savedLabel(savedAt, now) {
  if (!savedAt) return ''
  const seconds = Math.max(0, Math.round((now - savedAt.getTime()) / 1000))
  if (seconds < 5) return 'Saved just now'
  if (seconds < 60) return `Saved ${seconds} s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `Saved ${minutes} min ago`
  return `Saved ${Math.round(minutes / 60)} h ago`
}

export default function HonorPanel({
  mode = 'edit', row, userId,
  onSave, onCreate, onClose,
}) {
  const [initial] = useState(() => (mode === 'edit' && row ? draftFromRow(row) : emptyHonorDraft()))
  const [draft, setDraft] = useState(initial)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [touched, setTouched] = useState({})
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])

  const errors = useMemo(() => validateHonor(draft, mode, { touched }), [draft, mode, touched])
  const blocked = Object.keys(errors).length > 0
  const completed = requiredCompleted(draft)
  const canCreate = completed === 4 && !blocked

  const persist = useCallback(async (payload) => {
    if (!onSave) return
    if (Object.keys(validateHonor(payload, 'edit')).length) return
    await onSave(payload)
  }, [onSave])

  const { saving, savedAt, error: saveError, flush } = useAutosave(draft, persist, {
    delay: 800,
    enabled: mode === 'edit',
  })

  const set = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }))

  const cancelCreate = useCallback(() => {
    const untouched = JSON.stringify(draft) === JSON.stringify(emptyHonorDraft())
    if (untouched) onClose?.()
    else setConfirmDiscard(true)
  }, [draft, onClose])

  const requestClose = useCallback(() => {
    if (mode === 'create') { cancelCreate(); return }
    flush()
    onClose?.()
  }, [mode, cancelCreate, flush, onClose])

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') { event.stopPropagation(); requestClose() } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [requestClose])

  const submitCreate = async (event) => {
    event.preventDefault()
    if (!canCreate || creating) return
    setCreating(true)
    setCreateError('')
    try {
      await onCreate?.({ ...draft, touched })
    } catch (error) {
      setCreateError(error?.message || 'Could not create the honor. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const category = honorCategory(draft.category)
  const title = mode === 'create' ? 'New honor' : (draft.title.trim() || 'Untitled honor')

  const statusText = mode === 'create'
    ? 'Not saved yet'
    : blocked
      ? 'Check the highlighted fields'
      : saving
        ? 'Saving…'
        : saveError
          ? "Couldn't save · Retry"
          : savedAt
            ? `${savedLabel(savedAt, now)} ✓`
            : 'Saved just now ✓'

  const top5On = Boolean(draft.is_top5_commonapp)
  const top5Text = top5On ? `Position ${row?.top5_order ?? draft.top5_order ?? '—'} of 5` : 'Not included'

  return (
    <aside className={`honor-panel${mode === 'create' ? ' honor-panel--create' : ''}`} role="region" aria-label={title} tabIndex={-1}>
      <header className="honor-panel__head">
        <button type="button" className="honor-panel__back" onClick={requestClose} aria-label="Back to the list">
          <span aria-hidden="true">←</span>
        </button>
        <span className={`honor-panel__tile tile--${category.tint}${mode === 'create' ? ' tile--new' : ''}`} aria-hidden="true">
          {mode === 'create' ? '＋' : category.emoji}
        </span>
        <h2 className="honor-panel__title">{title}</h2>
        <label className="honor-panel__category">
          {honorCategoryLabel(draft.category)}
          <span aria-hidden="true">▾</span>
          <select value={draft.category} onChange={(event) => set('category', event.target.value)} aria-label="Honor category">
            {HONOR_CATEGORIES.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
        </label>
        <span className={`honor-panel__save${saveError ? ' honor-panel__save--error' : ''}`} role="status" aria-live="polite">
          {saveError ? (
            <button type="button" className="honor-panel__retry" onClick={flush}>Couldn&apos;t save · Retry</button>
          ) : statusText}
        </span>
        <button type="button" className="honor-panel__close" onClick={requestClose} aria-label="Close panel">
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <form className="honor-panel__body" onSubmit={submitCreate}>
        <p className="honor-section-label">Basics</p>
        <div className="honor-grid">
          <div className="honor-field">
            <label className="field-label">Honor title<span className="field-req" aria-hidden="true"> *</span></label>
            <input
              className={`honor-input${errors.title ? ' honor-input--invalid' : ''}`}
              value={draft.title}
              onChange={(event) => set('title', event.target.value.slice(0, HONOR_LIMITS.title))}
              onBlur={() => { setTouched((t) => ({ ...t, title: true })); if (mode === 'edit') flush() }}
              placeholder="e.g. Silver Medal, National Informatics Olympiad"
              maxLength={HONOR_LIMITS.title}
            />
            {errors.title && <p className="field-error" role="alert">{errors.title}</p>}
          </div>
          <div className="honor-field">
            <label className="field-label">Subject</label>
            <input
              className={`honor-input${errors.subject ? ' honor-input--invalid' : ''}`}
              value={draft.subject}
              onChange={(event) => set('subject', event.target.value.slice(0, HONOR_LIMITS.subject))}
              onBlur={() => { setTouched((t) => ({ ...t, subject: true })); if (mode === 'edit') flush() }}
              placeholder="e.g. Informatics"
              maxLength={HONOR_LIMITS.subject}
            />
            {errors.subject && <p className="field-error" role="alert">{errors.subject}</p>}
          </div>
          <div className="honor-field honor-span-2">
            <label className="field-label">Date received<span className="field-req" aria-hidden="true"> *</span></label>
            <MonthYearInput
              label="Date received"
              value={draft.received_month}
              onChange={(value) => set('received_month', value)}
              onBlur={() => { setTouched((t) => ({ ...t, received_month: true })); if (mode === 'edit') flush() }}
              required
              error={touched.received_month ? errors.received_month : undefined}
            />
            {touched.received_month && errors.received_month && <p className="field-error" role="alert">{errors.received_month}</p>}
          </div>
          <div className="honor-field honor-span-2">
            <label className="field-label">Awarding body</label>
            <input
              className={`honor-input${errors.issuer ? ' honor-input--invalid' : ''}`}
              value={draft.issuer}
              onChange={(event) => set('issuer', event.target.value.slice(0, HONOR_LIMITS.issuer))}
              onBlur={() => { setTouched((t) => ({ ...t, issuer: true })); if (mode === 'edit') flush() }}
              placeholder="e.g. Ministry of Science and Education"
              maxLength={HONOR_LIMITS.issuer}
            />
            {errors.issuer && <p className="field-error" role="alert">{errors.issuer}</p>}
          </div>
        </div>

        <p className="honor-section-label">Result and levels</p>
        <div className="honor-grid">
          <div className="honor-field honor-span-2">
            <ChipGroup
              label="Result"
              value={draft.result || null}
              onChange={(value) => set('result', value)}
              options={RESULT_OPTIONS}
              singleSelect
            />
            {touched.result && errors.result && <p className="field-error" role="alert">{errors.result}</p>}
          </div>
          <div className="honor-field honor-span-2">
            <ChipGroup
              label="Grade levels<span className='field-label__req'> *</span>"
              value={draft.grade_levels.map(String)}
              onChange={(value) => set('grade_levels', value.map(Number))}
              options={GRADE_OPTIONS}
              required
            />
            {touched.grade_levels && errors.grade_levels && <p className="field-error" role="alert">{errors.grade_levels}</p>}
          </div>
          <div className="honor-field honor-span-2">
            <ChipGroup
              label="Level of recognition<span className='field-label__req'> *</span>"
              value={draft.levels}
              onChange={(value) => set('levels', value)}
              options={LEVEL_OPTIONS}
              required
            />
            {touched.levels && errors.levels && <p className="field-error" role="alert">{errors.levels}</p>}
          </div>
        </div>

        <p className="honor-section-label">Description</p>
        <div className="honor-grid">
          <div className="honor-field honor-span-2">
            <TextAreaField
              label="What you did to earn it"
              value={draft.description}
              max={HONOR_LIMITS.description}
              onChange={(value) => set('description', value)}
              onBlur={() => { setTouched((t) => ({ ...t, description: true })); if (mode === 'edit') flush() }}
              error={touched.description ? errors.description : undefined}
              copyLabel="Description"
            />
            {touched.description && errors.description && <p className="field-error" role="alert">{errors.description}</p>}
          </div>
        </div>

        <p className="honor-section-label">Proof</p>
        <div className="honor-grid">
          <div className="honor-field honor-span-2">
            <label className="field-label">Certificate</label>
            <DocumentPicker
              value={draft.certificate_document_id ? { id: draft.certificate_document_id, title: 'Certificate' } : null}
              category="award_certificate"
              userId={userId}
              onChange={(doc) => set('certificate_document_id', doc.id)}
            />
          </div>
          <div className="honor-field honor-span-2">
            <label className="field-label">Verification link</label>
            <input
              className={`honor-input${errors.verification_url ? ' honor-input--invalid' : ''}`}
              value={draft.verification_url}
              onChange={(event) => set('verification_url', event.target.value)}
              onBlur={() => { setTouched((t) => ({ ...t, verification_url: true })); if (mode === 'edit') flush() }}
              placeholder="https://…"
            />
            {errors.verification_url && <p className="field-error" role="alert">{errors.verification_url}</p>}
          </div>
        </div>

        <p className="honor-section-label">Forms</p>
        <div className="honor-grid">
          <div className="honor-field honor-span-2">
            <label className="field-label">Include in top 5 for forms</label>
            <div className="honor-switch">
              <input
                type="checkbox"
                checked={top5On}
                onChange={(event) => set('is_top5_commonapp', event.target.checked)}
              />
              <span className="honor-switch__track" aria-hidden="true"><span /></span>
              <span className="honor-switch__text">{top5Text}</span>
            </div>
            <p className="field-hint">{top5On ? `Position ${top5Text}` : 'Not included in the top 5.'}</p>
          </div>
        </div>

        {mode === 'create' && (
          <footer className="honor-panel__footer">
            <p className={`honor-required${canCreate ? ' honor-required--done' : ''}`} role="status">
              {canCreate ? '✓ ' : ''}{completed} of 4 required fields
            </p>
            {createError && <p className="field-error" role="alert">{createError}</p>}
            <div className="honor-panel__footer-actions">
              <button type="button" className="honor-btn honor-btn--ghost" onClick={cancelCreate}>Cancel</button>
              <button type="submit" className="honor-btn honor-btn--primary" disabled={!canCreate || creating}>
                {creating ? 'Creating…' : 'Create honor'}
              </button>
            </div>
          </footer>
        )}

        <TipBox>💡 Tip: say how selective it was. Numbers like Top 30 of 2,000 help readers understand the level.</TipBox>
      </form>

      {confirmDiscard && (
        <div className="honor-discard" role="presentation" onClick={() => setConfirmDiscard(false)}>
          <div className="honor-discard__box" role="alertdialog" aria-modal="true" aria-label="Discard this honor?" onClick={(event) => event.stopPropagation()}>
            <h3>Discard this honor?</h3>
            <p>Nothing has been saved yet.</p>
            <div className="honor-discard__actions">
              <button type="button" className="honor-btn honor-btn--ghost" onClick={() => setConfirmDiscard(false)}>Keep editing</button>
              <button type="button" className="honor-btn honor-btn--danger" onClick={() => { setConfirmDiscard(false); onClose?.() }}>Discard</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

