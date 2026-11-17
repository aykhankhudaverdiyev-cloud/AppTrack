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
import { getDocument } from '../../Services/documentApi'
import {
  HONOR_CATEGORIES, HONOR_RESULTS, HONOR_GRADE_LEVELS, HONOR_LEVELS, HONOR_LIMITS,
  honorCategory,
} from '../../constants/honors.js'
import { draftFromRow, emptyHonorDraft, validateHonor, requiredCompleted } from '../../utils/honors.js'
import './HonorPanel.css'

const RESULT_OPTIONS = HONOR_RESULTS.map((r) => ({ value: r.key, label: r.label }))
const GRADE_OPTIONS = HONOR_GRADE_LEVELS.map((n) => ({ value: String(n), label: String(n) }))
const LEVEL_OPTIONS = HONOR_LEVELS.map((l) => ({ value: l.key, label: l.label }))

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
  mode = 'edit', row, userId, defaultCategory = 'academic_olympiad',
  onSave, onCreate, onClose,
}) {
  const [initial] = useState(() => (mode === 'edit' && row ? draftFromRow(row) : emptyHonorDraft(defaultCategory)))
  const [draft, setDraft] = useState(initial)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [touched, setTouched] = useState({})
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [certDoc, setCertDoc] = useState(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])

  // The draft only stores certificate_document_id (the DB-shaped value); fetch
  // the document's title/filename separately so DocumentPicker can show it.
  useEffect(() => {
    let cancelled = false
    const id = draft.certificate_document_id
    if (!id || certDoc?.id === id) return undefined
    getDocument(userId, id).then((doc) => { if (!cancelled) setCertDoc(doc) }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.certificate_document_id, userId])

  const errors = useMemo(() => validateHonor(draft, mode, { touched }), [draft, mode, touched])
  const blocked = Object.keys(errors).length > 0
  const completed = requiredCompleted(draft)
  const canCreate = completed === 4 && !blocked

  const persist = useCallback(async (payload) => {
    if (!onSave) return
    if (Object.keys(validateHonor(payload, 'edit')).length) return
    await onSave(payload)
  }, [onSave])

  const { saving, savedAt, error: saveError, markDirty, flush } = useAutosave(draft, persist, {
    delay: 800,
    enabled: mode === 'edit',
  })

  // Every field setter goes through this one function, and it always marks
  // the autosave dirty in edit mode — otherwise useAutosave's flush() never
  // actually saves anything (it short-circuits until markDirty() runs), and
  // the "Saved ✓" status would be shown without ever having saved.
  const set = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
    if (mode === 'edit') markDirty()
  }

  const cancelCreate = useCallback(() => {
    const untouched = JSON.stringify(draft) === JSON.stringify(emptyHonorDraft(defaultCategory))
    if (untouched) onClose?.()
    else setConfirmDiscard(true)
  }, [draft, onClose, defaultCategory])

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
  const top5PositionText = top5On ? `Position ${row?.top5_order ?? draft.top5_order ?? '—'} of 5` : ''

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
          <select
            value={draft.category}
            aria-label="Category"
            onChange={(event) => {
              set('category', event.target.value)
              setTouched((t) => ({ ...t, category: true }))
              if (mode === 'edit') flush()
            }}
          >
            {HONOR_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
          <span aria-hidden="true">▾</span>
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
          <div className="honor-field honor-span-2">
            <div className="honor-field__row">
              <label className="sfield-label">Honor title<span className="sfield-req" aria-hidden="true"> *</span></label>
              <span className="honor-field__counter">{draft.title.length} / {HONOR_LIMITS.title}</span>
            </div>
            <input
              className={`honor-input${errors.title ? ' honor-input--invalid' : ''}`}
              value={draft.title}
              onChange={(event) => set('title', event.target.value.slice(0, HONOR_LIMITS.title))}
              onBlur={() => { setTouched((t) => ({ ...t, title: true })); if (mode === 'edit') flush() }}
              placeholder="e.g. Silver Medal, National Informatics Olympiad"
              maxLength={HONOR_LIMITS.title}
            />
            {touched.title && errors.title && <p className="sfield-error" role="alert">{errors.title}</p>}
          </div>
          <div className="honor-field">
            <label className="sfield-label">Subject</label>
            <input
              className={`honor-input${errors.subject ? ' honor-input--invalid' : ''}`}
              value={draft.subject}
              onChange={(event) => set('subject', event.target.value.slice(0, HONOR_LIMITS.subject))}
              onBlur={() => { setTouched((t) => ({ ...t, subject: true })); if (mode === 'edit') flush() }}
              placeholder="e.g. Informatics"
              maxLength={HONOR_LIMITS.subject}
            />
            {touched.subject && errors.subject && <p className="sfield-error" role="alert">{errors.subject}</p>}
          </div>
          <div className="honor-field">
            <MonthYearInput
              label="Date received"
              value={draft.received_month}
              onChange={(value) => set('received_month', value)}
              onBlur={() => { setTouched((t) => ({ ...t, received_month: true })); if (mode === 'edit') flush() }}
              required
              error={touched.received_month ? errors.received_month : undefined}
            />
            {touched.received_month && errors.received_month && <p className="sfield-error" role="alert">{errors.received_month}</p>}
          </div>
          <div className="honor-field honor-span-2">
            <label className="sfield-label">Awarding body</label>
            <input
              className={`honor-input${errors.issuer ? ' honor-input--invalid' : ''}`}
              value={draft.issuer}
              onChange={(event) => set('issuer', event.target.value.slice(0, HONOR_LIMITS.issuer))}
              onBlur={() => { setTouched((t) => ({ ...t, issuer: true })); if (mode === 'edit') flush() }}
              placeholder="e.g. Ministry of Science and Education"
              maxLength={HONOR_LIMITS.issuer}
            />
            {touched.issuer && errors.issuer && <p className="sfield-error" role="alert">{errors.issuer}</p>}
          </div>
          <div className="honor-field honor-span-2">
            <ChipGroup
              label="Result"
              value={draft.result || null}
              onChange={(value) => { set('result', value); setTouched((t) => ({ ...t, result: true })); if (mode === 'edit') flush() }}
              options={RESULT_OPTIONS}
              singleSelect
            />
            {touched.result && errors.result && <p className="sfield-error" role="alert">{errors.result}</p>}
          </div>
          <div className="honor-field">
            <ChipGroup
              label="Grade levels"
              value={draft.grade_levels.map(String)}
              onChange={(value) => { set('grade_levels', value.map(Number)); setTouched((t) => ({ ...t, grade_levels: true })); if (mode === 'edit') flush() }}
              options={GRADE_OPTIONS}
              required
            />
            {touched.grade_levels && errors.grade_levels && <p className="sfield-error" role="alert">{errors.grade_levels}</p>}
          </div>
          <div className="honor-field">
            <ChipGroup
              label="Level of recognition"
              value={draft.levels}
              onChange={(value) => { set('levels', value); setTouched((t) => ({ ...t, levels: true })); if (mode === 'edit') flush() }}
              options={LEVEL_OPTIONS}
              required
              helper="Select all that apply"
            />
            {touched.levels && errors.levels && <p className="sfield-error" role="alert">{errors.levels}</p>}
          </div>
          <div className="honor-field honor-span-2">
            <div className="honor-field__row">
              <label className="sfield-label">Selectivity</label>
              <span className="honor-field__optional">Optional</span>
            </div>
            <input
              className={`honor-input${errors.participants_context ? ' honor-input--invalid' : ''}`}
              value={draft.participants_context}
              onChange={(event) => set('participants_context', event.target.value.slice(0, HONOR_LIMITS.participantsContext))}
              onBlur={() => { setTouched((t) => ({ ...t, participants_context: true })); if (mode === 'edit') flush() }}
              placeholder="e.g. Top 30 of 2,000 students"
              maxLength={HONOR_LIMITS.participantsContext}
            />
            {touched.participants_context && errors.participants_context && <p className="sfield-error" role="alert">{errors.participants_context}</p>}
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
            {touched.description && errors.description && <p className="sfield-error" role="alert">{errors.description}</p>}
          </div>
        </div>

        <p className="honor-section-label">Proof</p>
        <div className="honor-grid">
          <div className="honor-field">
            <label className="sfield-label">Certificate</label>
            <DocumentPicker
              value={draft.certificate_document_id ? (certDoc || { id: draft.certificate_document_id, title: 'Certificate' }) : null}
              category="award_certificate"
              userId={userId}
              onChange={(doc) => { setCertDoc(doc); set('certificate_document_id', doc.id); if (mode === 'edit') flush() }}
            />
          </div>
          <div className="honor-field">
            <label className="sfield-label">Verification link</label>
            <input
              className={`honor-input${errors.verification_url ? ' honor-input--invalid' : ''}`}
              value={draft.verification_url}
              onChange={(event) => set('verification_url', event.target.value)}
              onBlur={() => { setTouched((t) => ({ ...t, verification_url: true })); if (mode === 'edit') flush() }}
              placeholder="https://…"
            />
            {touched.verification_url && errors.verification_url && <p className="sfield-error" role="alert">{errors.verification_url}</p>}
          </div>
        </div>

        <p className="honor-section-label">Forms</p>
        <div className="honor-grid">
          <div className="honor-field honor-span-2 honor-field--row">
            <label className="honor-switch">
              <input
                type="checkbox"
                checked={top5On}
                onChange={(event) => { set('is_top5_commonapp', event.target.checked); if (mode === 'edit') flush() }}
              />
              <span className="honor-switch__track" aria-hidden="true"><span /></span>
              <span className="honor-switch__text">Include in top 5 for forms</span>
            </label>
            <span className="honor-field__aside">{top5PositionText}</span>
          </div>
        </div>

        {mode === 'create' && (
          <footer className="honor-panel__footer">
            <p className={`honor-required${canCreate ? ' honor-required--done' : ''}`} role="status">
              {canCreate ? '✓ ' : ''}{completed} of 4 required fields
            </p>
            {createError && <p className="sfield-error" role="alert">{createError}</p>}
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

