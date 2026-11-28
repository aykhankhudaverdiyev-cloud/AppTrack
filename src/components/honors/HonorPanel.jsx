/** ============================================================================
 * HonorPanel — ONE panel for both add and edit (spec §3)
 * Edit mode autosaves (800 ms debounce + blur, optimistic, inline validation).
 * Create mode is a form with a sticky footer that unlocks at 4/4 required
 * fields. Category / result / grade levels / recognition levels are chip
 * groups; dates are month-year pickers.
 * ============================================================================ */
import { useCallback, useEffect, useState } from 'react'
import { usePanelValidation } from '../../hooks/usePanelValidation'
import { InlineError, ValidationSummary } from '../forms/PanelValidation'
import { readCreateDraft, useCreateDraft, useAutosave } from '../../hooks/useAutosave'
import {
  ChipGroup, GradeChips, TagSelect, TextAreaField, DatePicker, ProofBlock, TipBox,
} from '../section'
import {
  HONOR_CATEGORIES, HONOR_RESULTS, HONOR_LEVELS, HONOR_LIMITS,
  honorCategory,
} from '../../constants/honors.js'
import { draftFromRow, emptyHonorDraft, validateHonor, requiredCompleted, mapDbError, HONOR_REQUIRED_FIELDS } from '../../utils/honors.js'
import './HonorPanel.css'

const REQUIRED_TOUCHED = Object.fromEntries(HONOR_REQUIRED_FIELDS.map(({ key }) => [key, true]))

const RESULT_OPTIONS = HONOR_RESULTS.map((r) => ({ value: r.key, label: r.label }))
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
  mode = 'edit', row, userId, defaultCategory = 'other', defaultTop5 = false,
  onSave, onCreate, onClose, attachments,
}) {
  const draftKey = mode === 'create' && userId ? `honors:${userId}` : null
  const [initial] = useState(() => (mode === 'edit' && row ? draftFromRow(row) : emptyHonorDraft(defaultCategory, defaultTop5)))
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

  const validation = usePanelValidation(validateHonor(draft, mode, { touched: REQUIRED_TOUCHED }), HONOR_REQUIRED_FIELDS)
  const { errors } = validation
  const blocked = Object.keys(errors).length > 0

  const persist = useCallback(async (payload) => {
    if (!onSave) return
    if (requiredCompleted(payload) !== 4 || Object.keys(validateHonor(payload, 'edit')).length) {
      throw new Error('Check the required fields before saving.')
    }
    await onSave(payload)
  }, [onSave])

  const { saving, savedAt, error: saveError, isDirty, markDirty, flush } = useAutosave(draft, persist, {
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
    if (attachments) { attachments.requestDiscard(() => { clearDraft(); onClose?.() }); return }
    const untouched = JSON.stringify(draft) === JSON.stringify(emptyHonorDraft(defaultCategory, defaultTop5))
    if (untouched) { clearDraft(); onClose?.() }
    else setConfirmDiscard(true)
  }, [draft, onClose, defaultCategory, defaultTop5, clearDraft, attachments])

  const requestClose = useCallback(async () => {
    if (mode === 'create') { cancelCreate(); return }
    await flush()
    onClose?.()
  }, [mode, cancelCreate, flush, onClose])

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') { event.stopPropagation(); requestClose() } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [requestClose])

  const submitCreate = async (event) => {
    event.preventDefault()
    if (mode !== 'create' || creating || !validation.validateSubmit()) return
    setCreating(true)
    setCreateError('')
    try {
      await onCreate?.(attachments ? { ...draft, id: attachments.id } : draft)
      clearDraft()
    } catch (error) {
      setCreateError(mapDbError(error).message)
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
        : savedAt && !isDirty
          ? `${savedLabel(savedAt, now)} ✓`
          : isDirty ? 'Unsaved changes' : 'All changes saved'

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
        <TagSelect label="Category" value={draft.category}
          options={HONOR_CATEGORIES.map(({ key, label }) => ({ value: key, label }))}
          onChange={(value) => set('category', value)} />
        <span className={`honor-panel__save${saveError ? ' honor-panel__save--error' : ''}`} role="status" aria-live="polite">
          {saveError ? <>{mapDbError(saveError).message}{' '}
            <button type="button" className="honor-panel__retry" onClick={flush}>Retry</button>
          </> : statusText}
        </span>
        <button type="button" className="honor-panel__close" onClick={requestClose} aria-label="Close panel">
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <form className="honor-panel__body panel-validation" onSubmit={submitCreate} {...validation.formProps}>
        <p className="honor-section-label">Basics</p>
        <div className="honor-grid">
          <div className="honor-field honor-span-2">
            <div className="honor-field__row">
              <label className="sfield-label" htmlFor="honor-title">Honor title<span className="sfield-req" aria-hidden="true"> *</span></label>
              <span className="honor-field__counter">{draft.title.length} / {HONOR_LIMITS.title}</span>
            </div>
            <input
              id="honor-title" data-form-field="title"
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? "honor-title-error" : undefined}
              className={`honor-input${errors.title ? ' honor-input--invalid' : ''}`}
              value={draft.title}
              onChange={(event) => set('title', event.target.value.slice(0, HONOR_LIMITS.title))}
              onBlur={() => { if (mode === 'edit') flush() }}
              placeholder="e.g. Silver Medal, National Informatics Olympiad"
              maxLength={HONOR_LIMITS.title}
            />
            <InlineError id="honor-title-error" message={errors.title} />
          </div>
          <div className="honor-field">
            <label className="sfield-label" htmlFor="honor-subject">Subject</label>
            <input
              id="honor-subject" data-form-field="subject"
              aria-invalid={errors.subject ? true : undefined}
              aria-describedby={errors.subject ? "honor-subject-error" : undefined}
              className={`honor-input${errors.subject ? ' honor-input--invalid' : ''}`}
              value={draft.subject}
              onChange={(event) => set('subject', event.target.value.slice(0, HONOR_LIMITS.subject))}
              onBlur={() => { if (mode === 'edit') flush() }}
              placeholder="e.g. Informatics"
              maxLength={HONOR_LIMITS.subject}
            />
            <InlineError id="honor-subject-error" message={errors.subject} />
          </div>
          <div className="honor-field">
            <DatePicker
              label="Date received" allowFuture={false} fieldKey="received_month" error={errors.received_month}
              value={draft.received_month}
              onChange={(value) => set('received_month', value)}
              onBlur={() => { if (mode === 'edit') flush() }}
            />
          </div>
          <div className="honor-field honor-span-2">
            <label className="sfield-label" htmlFor="honor-issuer">Awarding body</label>
            <input
              id="honor-issuer" data-form-field="issuer"
              aria-invalid={errors.issuer ? true : undefined}
              aria-describedby={errors.issuer ? "honor-issuer-error" : undefined}
              className={`honor-input${errors.issuer ? ' honor-input--invalid' : ''}`}
              value={draft.issuer}
              onChange={(event) => set('issuer', event.target.value.slice(0, HONOR_LIMITS.issuer))}
              onBlur={() => { if (mode === 'edit') flush() }}
              placeholder="e.g. Ministry of Science and Education"
              maxLength={HONOR_LIMITS.issuer}
            />
            <InlineError id="honor-issuer-error" message={errors.issuer} />
          </div>
          <div className="honor-field honor-span-2">
            <ChipGroup
              label="Result"
              value={draft.result || null}
              onChange={(value) => set('result', value)}
              options={RESULT_OPTIONS}
              singleSelect
            />
          </div>
          <div className="honor-field honor-span-2">
            <GradeChips fieldKey="grade_levels" value={draft.grade_levels} required error={errors.grade_levels}
              onChange={(value) => set('grade_levels', value)} />
          </div>
          <div className="honor-field honor-span-2">
            <ChipGroup
              label="Level of recognition" fieldKey="levels"
              value={draft.levels[0] || null}
              singleSelect locked
              onChange={(value) => set('levels', [value])}
              options={LEVEL_OPTIONS}
              required
              equal
              error={errors.levels}
              helper="Choose the highest level"
            />
          </div>
          <div className="honor-field honor-span-2">
            <div className="honor-field__row">
              <label className="sfield-label" htmlFor="honor-participants_context">Selectivity</label>
              <span className="honor-field__optional">Optional</span>
            </div>
            <input
              id="honor-participants_context" data-form-field="participants_context"
              aria-invalid={errors.participants_context ? true : undefined}
              aria-describedby={errors.participants_context ? "honor-participants_context-error" : undefined}
              className={`honor-input${errors.participants_context ? ' honor-input--invalid' : ''}`}
              value={draft.participants_context}
              onChange={(event) => set('participants_context', event.target.value.slice(0, HONOR_LIMITS.participantsContext))}
              onBlur={() => { if (mode === 'edit') flush() }}
              placeholder="e.g. Top 30 of 2,000 students"
              maxLength={HONOR_LIMITS.participantsContext}
            />
            <InlineError id="honor-participants_context-error" message={errors.participants_context} />
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
              onBlur={() => { if (mode === 'edit') flush() }}
              fieldKey="description" error={errors.description}
              copyLabel="Description"
            />
          </div>
        </div>

        <p className="honor-section-label">Proof</p>
        <ProofBlock section="honor" itemId={mode === 'edit' ? row?.id : attachments?.id} userId={userId} title="Certificate"
          hint="No certificate attached yet. Upload it or choose it from Documents." pendingFiles={mode === 'create' && attachments ? attachments.files : null}
          onPendingChange={attachments?.setFiles} onUploaded={attachments?.uploaded} onDeleted={attachments?.deleted}
          failedFiles={attachments?.failed[row?.id] || []} onRetryFile={(file) => attachments?.retry(row.id, file)} />
        <div className="honor-grid">
          <div className="honor-field">
            <label className="sfield-label" htmlFor="honor-verification_url">Verification link</label>
            <input
              id="honor-verification_url" data-form-field="verification_url"
              aria-invalid={errors.verification_url ? true : undefined}
              aria-describedby={errors.verification_url ? "honor-verification_url-error" : undefined}
              className={`honor-input${errors.verification_url ? ' honor-input--invalid' : ''}`}
              value={draft.verification_url}
              onChange={(event) => set('verification_url', event.target.value)}
              onBlur={() => { if (mode === 'edit') flush() }}
              placeholder="https://…"
            />
            <InlineError id="honor-verification_url-error" message={errors.verification_url} />
          </div>
        </div>

        <p className="honor-section-label">Forms</p>
        <div className="honor-grid">
          <div className="honor-field honor-span-2 honor-field--row">
            <label className="honor-switch">
              <input
                type="checkbox"
                checked={top5On}
                onChange={(event) => set('is_top5_commonapp', event.target.checked)}
              />
              <span className="honor-switch__track" aria-hidden="true"><span /></span>
              <span className="honor-switch__text">Include in top 5 for forms</span>
            </label>
            <span className="honor-field__aside">{top5PositionText}</span>
          </div>
        </div>

        {mode === 'create' && (
          <footer className="honor-panel__footer">
            <ValidationSummary validation={validation} className="honor-required" completeClassName="honor-required--done" />
            {createError && <p className="sfield-error" role="alert">{createError}</p>}
            <div className="honor-panel__footer-actions">
              <button type="button" className="honor-btn honor-btn--ghost" onClick={cancelCreate}>Cancel</button>
              <button type="submit" className="honor-btn honor-btn--primary" disabled={creating}>
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
              <button type="button" className="honor-btn honor-btn--danger" onClick={() => { setConfirmDiscard(false); clearDraft(); onClose?.() }}>Discard</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

