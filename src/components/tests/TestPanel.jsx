/** ============================================================================
 * TestPanel — ONE panel for both add and edit (spec §4)
 * Edit mode autosaves sections + attempt fields. Choose a test type to
 * pre-fill its sections (never overwrites sections the user already entered).
 * ============================================================================ */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePanelValidation } from '../../hooks/usePanelValidation'
import { InlineError, ValidationSummary, NumericInput } from '../forms/PanelValidation'
import { useAutosave } from '../../hooks/useAutosave'
import { Field } from '../forms'
import '../activities/ActivitiesSection.css'
import { ChipGroup, DocumentPicker, TagSelect, TipBox } from '../section'
import { getDocument } from '../../Services/documentApi'
import {
  TEST_TYPES, TEST_STATUSES, testPreset, needsExamName,
  TEST_TYPE_LABEL, testEmoji, testTint,
} from '../../constants/tests.js'
import { draftFromRow, emptyTestDraft, validateTestAttempt, testRequiredFields } from '../../utils/tests.js'
import { suggestOverall, defaultExpiry, applyPreset } from '../../utils/tests.js'
import './TestPanel.css'

const STATUS_OPTIONS = TEST_STATUSES.map((s) => ({ value: s.key, label: s.label }))

function sectionErrors(sections) {
  const errors = {}
  sections.forEach((section, index) => {
    const key = section.id || index
    const score = Number(section.score)
    const max = Number(section.score_max)
    if (!Number.isFinite(max) || max < 0) errors[`section_max_${key}`] = 'Enter a valid maximum'
    if (!Number.isFinite(score) || score < 0 || (section.score_max !== '' && section.score_max != null && score > max)) {
      errors[`section_score_${key}`] = 'Enter a score within the section maximum'
    }
  })
  return errors
}

function savedLabel(savedAt, now) {
  if (!savedAt) return ''
  const seconds = Math.max(0, Math.round((now - savedAt.getTime()) / 1000))
  if (seconds < 5) return 'Saved just now'
  if (seconds < 60) return `Saved ${seconds} s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `Saved ${minutes} min ago`
  return `Saved ${Math.round(minutes / 60)} h ago`
}

export default function TestPanel({
  mode = 'edit', row, userId, defaultTestType = 'SAT',
  onSave, onCreate, onClose, onOpenApplications,
}) {
  const [draft, setDraft] = useState(() => (mode === 'edit' && row ? draftFromRow(row, row.sections) : emptyTestDraft(defaultTestType)))
  const [sections, setSections] = useState(() => mode === 'edit'
    ? draftFromRow(row, row?.sections).sections
    : applyPreset(defaultTestType))
  const [sectionEdited, setSectionEdited] = useState(false)
  const [expiryEdited, setExpiryEdited] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [reportDoc, setReportDoc] = useState(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])

  // The draft only stores report_document_id (the DB-shaped value); fetch the
  // document's title/filename separately so DocumentPicker can show it.
  useEffect(() => {
    let cancelled = false
    const id = draft.report_document_id
    if (!id || reportDoc?.id === id) return undefined
    getDocument(userId, id).then((doc) => { if (!cancelled) setReportDoc(doc) }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.report_document_id, userId])

  const validation = usePanelValidation({
    ...validateTestAttempt(draft, mode, { touched: { test_type: true, status: true, national_exam_name: true, attempt_number: true } }),
    ...(draft.status === 'released' ? sectionErrors(sections) : {}),
  }, testRequiredFields(draft))
  const { errors } = validation
  const blocked = Object.keys(errors).length > 0

  const persist = useCallback(async ({ draft: payload, sections: scores }) => {
    if (Object.keys(validateTestAttempt(payload, 'edit', { touched: { national_exam_name: true, attempt_number: true } })).length
      || (payload.status === 'released' && Object.keys(sectionErrors(scores)).length)) {
      throw new Error('Check the highlighted fields')
    }
    await onSave?.(payload, scores)
  }, [onSave])
  const autosavePayload = useMemo(() => ({ draft, sections }), [draft, sections])

  const { saving, savedAt, error: saveError, isDirty, markDirty, flush } = useAutosave(autosavePayload, persist, {
    delay: 800,
    enabled: mode === 'edit',
  })

  // Every field setter marks the autosave dirty in edit mode — otherwise
  // useAutosave's flush() short-circuits and never actually saves (only the
  // sections list did this before; plain fields like title/date/status never
  // persisted even though the header showed "Saved ✓").
  const set = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
    if (mode === 'edit') markDirty()
  }
  const blur = () => { if (mode === 'edit') flush() }

  const cancelCreate = useCallback(() => {
    const untouched = JSON.stringify(draft) === JSON.stringify(emptyTestDraft(defaultTestType))
      && !sectionEdited
    if (untouched) onClose?.()
    else setConfirmDiscard(true)
  }, [draft, sectionEdited, onClose, defaultTestType])

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
      await onCreate?.({ ...draft, sections: sections.map((s) => ({ ...s, id: s.id || crypto.randomUUID() })) })
    } catch (error) {
      setCreateError(error?.message || 'Could not create the test. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const isEnglish = ['IELTS', 'TOEFL', 'DUOLINGO', 'PTE', 'CAMBRIDGE_C1', 'CAMBRIDGE_C2'].includes(draft.test_type)
  const trfLabel = draft.test_type === 'IELTS' ? 'TRF number' : 'Report number'
  const suggested = suggestOverall(draft.test_type, sections)


  const title = mode === 'create' ? 'New test' : (draft.national_exam_name || draft.test_type)
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
            : isDirty ? 'Unsaved changes' : 'All changes saved'

  const setSection = (index, key, value) => {
    setSectionEdited(true)
    setSections((prev) => prev.map((s, i) => i === index ? { ...s, [key]: value } : s))
    if (mode === 'edit') markDirty()
  }

  const addSection = () => {
    setSectionEdited(true)
    setSections((prev) => [...prev, { id: crypto.randomUUID(), section: '', score: '', score_max: '', sort_order: prev.length }])
    if (mode === 'edit') markDirty()
  }

  const removeSection = (index) => {
    setSectionEdited(true)
    setSections((prev) => prev.filter((_, i) => i !== index))
    if (mode === 'edit') markDirty()
  }

  const overallInput = () => (
    <Field className="test-field" label="Overall score" fieldKey="overall_score" error={errors.overall_score}
      hint={draft.overall_score === '' && suggested != null ? `Suggested from sections: ${suggested}` : undefined}>
      {({ id, describedBy, invalid }) => (
        <div className="test-overall-row">
          <NumericInput id={id} aria-describedby={describedBy} aria-invalid={invalid} className="test-input test-input--short"
            step="any" min="0" max={draft.overall_max || undefined} value={draft.overall_score} placeholder={suggested ?? ''}
            onChange={(event) => set('overall_score', event.target.value)} onBlur={blur} />
          {draft.overall_max !== '' && <span className="test-suffix">/ {draft.overall_max}</span>}
        </div>
      )}
    </Field>
  )

  return (
    <aside className={`act-panel test-panel${mode === 'create' ? ' test-panel--create' : ''}`} role="region" aria-label={title} tabIndex={-1}>
      <header className="act-panel__head">
        <button type="button" className="act-panel__back" onClick={requestClose} aria-label="Back to the list">
          <span aria-hidden="true">←</span>
        </button>
        <span className={`test-panel__tile tile--${testTint(draft.test_type)}${mode === 'create' ? ' test-panel__tile--new' : ''}`} aria-hidden="true">
          {mode === 'create' ? '＋' : testEmoji(draft.test_type)}
        </span>
        <h2 className="act-panel__title">{title}</h2>
        <TagSelect label="Test type" value={draft.test_type}
          options={TEST_TYPES.map((value) => ({ value, label: TEST_TYPE_LABEL(value) }))}
          onChange={(nextType) => {
            if (mode === 'create') {
              setDraft((prev) => ({ ...prev, test_type: nextType,
                overall_max: testPreset(nextType).overallMax ?? '',
                expires_on: expiryEdited ? prev.expires_on : defaultExpiry(nextType, prev.test_date) || '',
              }))
              if (!sectionEdited) setSections(applyPreset(nextType))
            } else set('test_type', nextType)
          }} />
        <span className={`test-panel__save${saveError ? ' test-panel__save--error' : ''}`} role="status" aria-live="polite">
          {saveError ? (
            <button type="button" className="test-panel__retry" onClick={flush}>Couldn&apos;t save · Retry</button>
          ) : statusText}
        </span>
        <button type="button" className="act-panel__close" onClick={requestClose} aria-label="Close panel">
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <form className="act-panel__body panel-validation" onSubmit={submitCreate} {...validation.formProps}>
        <p className="test-section-label">Basics</p>
        <div className="test-grid">
          {needsExamName(draft.test_type) && (
            <Field className="test-field test-span-2" label="Exam name" fieldKey="national_exam_name" required error={errors.national_exam_name}>
              {({ id, describedBy, invalid }) => <input id={id} aria-describedby={describedBy} aria-invalid={invalid} className="test-input"
                value={draft.national_exam_name} maxLength={100} placeholder="e.g. Azerbaijan DIM"
                onChange={(event) => set('national_exam_name', event.target.value)}
                onBlur={blur} />}
            </Field>
          )}
          <div className="test-field test-span-2">
            <ChipGroup label="Status" fieldKey="status" error={errors.status} value={draft.status || null}
              onChange={(value) => { if (value) set('status', value) }}
              options={STATUS_OPTIONS} singleSelect required />
          </div>
          <Field label="Test date" className="test-field">
            {({ id }) => <input id={id} className="test-input" type="date" value={draft.test_date}
              onChange={(event) => {
                set('test_date', event.target.value)
                if (mode === 'create' && !expiryEdited) set('expires_on', defaultExpiry(draft.test_type, event.target.value) || '')
              }} onBlur={blur} />}
          </Field>
          <Field label="Expires on" fieldKey="expires_on" className="test-field" error={errors.expires_on} hint={isEnglish ? 'Default: two years from the test date' : undefined}>
            {({ id, describedBy, invalid }) => <input id={id} aria-describedby={describedBy} aria-invalid={invalid} className="test-input" type="date" value={draft.expires_on}
              onChange={(event) => { setExpiryEdited(true); set('expires_on', event.target.value) }} onBlur={blur} />}
          </Field>
          <Field label={trfLabel} fieldKey="trf_number" className="test-field" error={errors.trf_number}>
            {({ id }) => <input id={id} className="test-input" aria-invalid={Boolean(errors.trf_number)} value={draft.trf_number}
              onChange={(event) => set('trf_number', event.target.value)} onBlur={blur} maxLength={40} />}
          </Field>
          <Field label="Attempt" fieldKey="attempt_number" className="test-field" error={errors.attempt_number}>
            {({ id }) => <NumericInput id={id} className="test-input" aria-invalid={Boolean(errors.attempt_number)} min={1} value={draft.attempt_number}
              onChange={(event) => set('attempt_number', event.target.value)} onBlur={blur} />}
          </Field>
        </div>

        {draft.status === 'released' && (
          <>
            <p className="test-section-label">Scores</p>
            {overallInput()}
            <div className="test-field test-span-2">
              <div className="test-sections-grid">
                {sections.map((section, index) => {
                  const key = section.id || index
                  const scoreKey = `section_score_${key}`
                  const maxKey = `section_max_${key}`
                  return <div key={key} className="test-section-item">
                    <div className="test-section-item__head">
                      <input className="test-section-name" value={section.section}
                        onChange={(event) => setSection(index, 'section', event.target.value.slice(0, 60))}
                        onBlur={blur}
                        placeholder="Section name" />
                      <button type="button" className="test-remove" onClick={() => removeSection(index)} aria-label={`Remove ${section.section || 'section'}`}>×</button>
                    </div>
                    <div className="test-section-box">
                      <NumericInput data-form-field={scoreKey} aria-invalid={errors[scoreKey] ? true : undefined}
                        aria-describedby={errors[scoreKey] ? scoreKey : undefined} className="test-score-input" aria-label={`${section.section || 'Section'} score`} step="any" min="0" value={section.score}
                        onChange={(event) => setSection(index, 'score', event.target.value)}
                        onBlur={blur} placeholder="0" />
                      <span className="test-slash">/</span>
                      <NumericInput data-form-field={maxKey} aria-invalid={errors[maxKey] ? true : undefined}
                        aria-describedby={errors[maxKey] ? maxKey : undefined} className="test-score-max-input" aria-label={`${section.section || 'Section'} maximum`} step="any" min="0" value={section.score_max}
                        onChange={(event) => setSection(index, 'score_max', event.target.value)}
                        onBlur={blur} placeholder="max" />
                    </div>
                    <InlineError id={scoreKey} message={errors[scoreKey]} />
                    <InlineError id={maxKey} message={errors[maxKey]} />
                  </div>
                })}
              </div>
              <button type="button" className="test-add-section" onClick={addSection}>＋ Add section</button>
            </div>
          </>
        )}

        {draft.status === 'released' && <label className="test-switch">
          <input type="checkbox" checked={Boolean(draft.is_best)}
            onChange={(event) => set('is_best', event.target.checked)} />
          <span className="test-switch__track" aria-hidden="true"><span /></span>
          <span className="test-switch__text">Best {TEST_TYPE_LABEL(draft.test_type)} result</span>
          <span className="test-switch__aside">Shown first on your profile and forms</span>
        </label>}

        <p className="test-section-label">Proof</p>
        <div className="test-grid">
          <div className="test-field">
            <label className="sfield-label">Score report</label>
            <DocumentPicker
              value={draft.report_document_id ? (reportDoc || { id: draft.report_document_id, title: 'Score report' }) : null}
              category={isEnglish ? 'english_certificate' : 'test_report'}
              userId={userId}
              onChange={(doc) => { setReportDoc(doc); set('report_document_id', doc?.id || '') }} />
          </div>
          {onOpenApplications && <div className="test-field">
            <span className="sfield-label">Official reports</span>
            <button type="button" className="test-add-section" onClick={async () => { await flush(); onOpenApplications() }}>Open Applications →</button>
          </div>}
        </div>

        <label className="test-field">
          <span className="sfield-label">Notes</span>
          <button type="button" className="test-add-note" onClick={() => set('notes', draft.notes || 'Add your note here…')}>Add note</button>
          <textarea data-form-field="notes" aria-invalid={errors.notes ? true : undefined} aria-describedby={errors.notes ? "test-notes-error" : undefined} className="test-input test-textarea" value={draft.notes} onChange={(event) => set('notes', event.target.value.slice(0, 500))}
            onBlur={blur} maxLength={500} />
          <InlineError id="test-notes-error" message={errors.notes} />
        </label>

        {mode === 'create' && (
          <footer className="test-panel__footer">
            <ValidationSummary validation={validation} className="test-required" completeClassName="test-required--done" />
            {createError && <p className="sfield-error" role="alert">{createError}</p>}
            <div className="test-panel__footer-actions">
              <button type="button" className="test-btn test-btn--ghost" onClick={cancelCreate}>Cancel</button>
              <button type="submit" className="test-btn test-btn--primary" disabled={creating}>
                {creating ? 'Creating…' : 'Create test'}
              </button>
            </div>
          </footer>
        )}

        <TipBox>{isEnglish ? 'Tip: IELTS and TOEFL results are valid for two years. Check the expiry date before each deadline.' : 'Tip: mark one attempt as Best so forms use the right score.'}</TipBox>
      </form>

      {confirmDiscard && (
        <div className="test-discard" role="presentation" onClick={() => setConfirmDiscard(false)}>
          <div className="test-discard__box" role="alertdialog" aria-modal="true" aria-label="Discard this test?" onClick={(event) => event.stopPropagation()}>
            <h3>Discard this test?</h3>
            <p>Nothing has been saved yet.</p>
            <div className="test-discard__actions">
              <button type="button" className="test-btn test-btn--ghost" onClick={() => setConfirmDiscard(false)}>Keep editing</button>
              <button type="button" className="test-btn test-btn--danger" onClick={() => { setConfirmDiscard(false); onClose?.() }}>Discard</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
