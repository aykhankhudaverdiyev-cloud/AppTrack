/** ============================================================================
 * TestPanel — ONE panel for both add and edit (spec §4)
 * Edit mode autosaves sections + attempt fields. Choose a test type to
 * pre-fill its sections (never overwrites sections the user already entered).
 * ============================================================================ */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAutosave } from '../../hooks/useAutosave'
import { ChipGroup, DocumentPicker, TipBox } from '../section'
import {
  TEST_TYPES, TEST_STATUSES, testPreset, needsExamName,
  TEST_TYPE_LABEL, testEmoji, testTint,
} from '../../constants/tests.js'
import { draftFromRow, emptyTestDraft, validateTestAttempt, requiredCompleted } from '../../utils/tests.js'
import { suggestOverall, defaultExpiry, applyPreset } from '../../utils/tests.js'

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
  onSave, onCreate, onClose,
}) {
  const initialSections = mode === 'edit' && row ? (row.sections || []) : applyPreset(defaultTestType, [])
  const [draft, setDraft] = useState(() => (mode === 'edit' && row ? draftFromRow(row, row.sections) : emptyTestDraft(defaultTestType)))
  const [sections, setSections] = useState(initialSections)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [touched, setTouched] = useState({})
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])

  const errors = useMemo(() => validateTestAttempt(draft, mode, { touched }), [draft, mode, touched])
  const blocked = Object.keys(errors).length > 0
  const completed = requiredCompleted(draft)
  const canCreate = completed === 2 && !blocked

  const persist = useCallback(async (payload) => {
    if (!onSave) return
    if (Object.keys(validateTestAttempt(payload, 'edit')).length) return
    await onSave(payload, sections)
  }, [onSave, sections])

  const { saving, savedAt, error: saveError, markDirty, flush } = useAutosave(draft, persist, {
    delay: 800,
    enabled: mode === 'edit',
  })

  const set = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }))
  const touch = (key) => setTouched((prev) => ({ ...prev, [key]: true }))
  const blur = () => { if (mode === 'edit') flush() }

  const cancelCreate = useCallback(() => {
    const untouched = JSON.stringify(draft) === JSON.stringify(emptyTestDraft(defaultTestType))
      && (sections.length === 0 || sections.every((s) => !s.section))
    if (untouched) onClose?.()
    else setConfirmDiscard(true)
  }, [draft, sections, onClose, defaultTestType])

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
      await onCreate?.({ ...draft, sections })
    } catch (error) {
      setCreateError(error?.message || 'Could not create the test. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const preset = testPreset(draft.test_type)
  const isEnglish = ['IELTS', 'TOEFL', 'DUOLINGO', 'PTE', 'CAMBRIDGE_C1', 'CAMBRIDGE_C2'].includes(draft.test_type)
  const trfLabel = draft.test_type === 'IELTS' ? 'TRF number' : 'Report number'
  const suggested = suggestOverall(draft.test_type, sections)
  const overallAuto = preset.overall === 'sum-auto'

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
            : 'Saved just now ✓'

  const setSection = (index, key, value) => {
    setSections((prev) => prev.map((s, i) => i === index ? { ...s, [key]: value } : s))
    if (mode === 'edit') markDirty()
  }

  const addSection = () => {
    setSections((prev) => [...prev, { id: '', section: '', score: '', score_max: '', sort_order: prev.length }])
    if (mode === 'edit') markDirty()
  }

  const removeSection = (index) => {
    setSections((prev) => prev.filter((_, i) => i !== index))
    if (mode === 'edit') markDirty()
  }

  const overallInput = () => {
    const max = draft.overall_max || preset.overallMax
    if (overallAuto) return (
      <div className="test-field">
        <label className="field-label">Overall<span className="field-req" aria-hidden="true"> *</span></label>
        <span className="test-overall">{String(draft.overall_score === '' ? suggested ?? '' : draft.overall_score)} <span className="test-suffix">/ ${max}</span></span>
        <p className="field-hint">Computed from the sections above.</p>
      </div>
    )
    return (
      <div className="test-field">
        <label className="field-label">Overall score</label>
        <input className={`test-input${errors.overall_score ? ' test-input--invalid' : ''}`} type="number"
          value={draft.overall_score} step={draft.test_type === 'IELTS' ? '0.25' : 'any'}
          onChange={(event) => set('overall_score', event.target.value)}
          onBlur={() => { touch('overall_score'); if (mode === 'edit') flush() }}
        />
        <span className="test-suffix">/ {max}</span>
        {draft.overall_score === '' && suggested != null && (
          <p className="field-hint">Suggested from sections: {suggested}</p>
        )}
        {errors.overall_score && <p className="field-error" role="alert">{errors.overall_score}</p>}
      </div>
    )
  }

  return (
    <aside className={`test-panel${mode === 'create' ? ' test-panel--create' : ''}`} role="region" aria-label={title} tabIndex={-1}>
      <header className="test-panel__head">
        <button type="button" className="test-panel__back" onClick={requestClose} aria-label="Back to the list">
          <span aria-hidden="true">←</span>
        </button>
        <span className={`test-panel__tile tile--${testTint(draft.test_type)}${mode === 'create' ? ' tile--new' : ''}`} aria-hidden="true">
          {mode === 'create' ? '＋' : testEmoji(draft.test_type)}
        </span>
        <h2 className="test-panel__title">{title}</h2>
        <label className="test-panel__type">
          {TEST_TYPE_LABEL(draft.test_type)}
          <span aria-hidden="true">▾</span>
          <select value={draft.test_type} onChange={(event) => {
            const nextType = event.target.value
            set('test_type', nextType)
            if (mode === 'create') setSections(applyPreset(nextType, sections))
          }} aria-label="Test type">
            {TEST_TYPES.map((type) => (
              <option key={type} value={type}>{TEST_TYPE_LABEL(type)}</option>
            ))}
          </select>
        </label>
        <span className={`test-panel__save${saveError ? ' test-panel__save--error' : ''}`} role="status" aria-live="polite">
          {saveError ? (
            <button type="button" className="test-panel__retry" onClick={flush}>Couldn&apos;t save · Retry</button>
          ) : statusText}
        </span>
        <button type="button" className="test-panel__close" onClick={requestClose} aria-label="Close panel">
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <form className="test-panel__body" onSubmit={submitCreate}>
        <p className="test-section-label">Basics</p>
        <div className="test-grid">
          <div className="test-field">
            <label className="field-label">Test type</label>
            <select className="test-input" value={draft.test_type} onChange={(event) => set('test_type', event.target.value)} onBlur={blur} disabled>
              {TEST_TYPES.map((type) => <option key={type} value={type}>{TEST_TYPE_LABEL(type)}</option>)}
            </select>
          </div>
          {needsExamName(draft.test_type) && (
            <div className="test-field">
              <label className="field-label">Exam name<span className="field-req" aria-hidden="true"> *</span></label>
              <input className={`test-input${errors.national_exam_name ? ' test-input--invalid' : ''}`} value={draft.national_exam_name}
                onChange={(event) => set('national_exam_name', event.target.value.slice(0, 100))}
                onBlur={() => { touch('national_exam_name'); if (mode === 'edit') flush() }}
                maxLength={100} placeholder="e.g. Azerbaijan DIM" />
              {touched.national_exam_name && errors.national_exam_name && <p className="field-error" role="alert">{errors.national_exam_name}</p>}
            </div>
          )}
          <div className="test-field test-span-2">
            <label className="field-label">Status<span className="field-req" aria-hidden="true"> *</span></label>
            <ChipGroup label="Status" value={draft.status || null} onChange={(value) => set('status', value)} options={TEST_STATUSES} singleSelect required />
            {touched.status && errors.status && <p className="field-error" role="alert">{errors.status}</p>}
          </div>
          <div className="test-field">
            <label className="field-label">Test date<span className="field-req" aria-hidden="true"> *</span></label>
            <input className={`test-input${errors.test_date ? ' test-input--invalid' : ''}`} type="date"
              value={draft.test_date} onChange={(event) => {
                set('test_date', event.target.value)
                if (isEnglish && !draft.expires_on) set('expires_on', defaultExpiry(draft.test_type, event.target.value) || '')
              }}
              onBlur={() => { touch('test_date'); if (mode === 'edit') flush() }} />
            {touched.test_date && errors.test_date && <p className="field-error" role="alert">{errors.test_date}</p>}
          </div>
          <div className="test-field">
            <label className="field-label">Expires on</label>
            <div className="test-date-row">
              <input className="test-input" type="date" value={draft.expires_on}
                onChange={(event) => set('expires_on', event.target.value)}
                onBlur={() => { touch('expires_on'); if (mode === 'edit') flush() }} />
              {isEnglish && draft.test_date && !draft.expires_on && (
                <span className="test-hint">Valid for 2 years</span>
              )}
            </div>
            {touched.expires_on && errors.expires_on && <p className="field-error" role="alert">{errors.expires_on}</p>}
          </div>
          <div className="test-field">
            <label className="field-label">{trfLabel}</label>
            <input className={`test-input${errors.trf_number ? ' test-input--invalid' : ''}`} value={draft.trf_number}
              onChange={(event) => set('trf_number', event.target.value.slice(0, 40))}
              onBlur={() => { touch('trf_number'); if (mode === 'edit') flush() }} maxLength={40}
              placeholder={draft.test_type === 'IELTS' ? '26AZ5000127KHUA001A' : 'e.g. 12345678'} />
            {errors.trf_number && <p className="field-error" role="alert">{errors.trf_number}</p>}
          </div>
          <div className="test-field">
            <label className="field-label">Attempt</label>
            <input className="test-input" type="number" min={1} value={draft.attempt_number}
              onChange={(event) => set('attempt_number', event.target.value)}
              onBlur={() => { touch('attempt_number'); if (mode === 'edit') flush() }} />
            {errors.attempt_number && <p className="field-error" role="alert">{errors.attempt_number}</p>}
          </div>
        </div>

        <p className="test-section-label">Scores</p>
        {draft.status !== 'released' && (
          <p className="test-hint test-hint--muted">Scores appear here after release.</p>
        )}
        {draft.status === 'released' && (
          <>
            {overallInput()}
            <div className="test-field test-span-2">
              <div className="test-sections">
                {sections.map((section, index) => (
                  <div key={section.id || index} className="test-section-row">
                    <input className="test-input" value={section.section}
                      onChange={(event) => setSection(index, 'section', event.target.value.slice(0, 60))}
                      placeholder="e.g. Reading & Writing" />
                    <input className="test-input test-input--short" type="number" value={section.score}
                      onChange={(event) => setSection(index, 'score', event.target.value)} placeholder="Score" />
                    <span className="test-slash">/</span>
                    <input className="test-input test-input--short" type="number" value={section.score_max}
                      onChange={(event) => setSection(index, 'score_max', event.target.value)} placeholder="Max" />
                    <button type="button" className="test-remove" onClick={() => removeSection(index)} aria-label="Remove section">×</button>
                  </div>
                ))}
                <button type="button" className="test-add-section" onClick={addSection}>＋ Add section</button>
              </div>
            </div>
          </>
        )}

        <p className="test-section-label">Proof</p>
        <div className="test-grid">
          <div className="test-field test-span-2">
            <label className="field-label">Score report</label>
            <DocumentPicker
              value={draft.report_document_id ? { id: draft.report_document_id, title: 'Score report' } : null}
              category={isEnglish ? 'english_certificate' : 'test_report'}
              userId={userId}
              onChange={(doc) => set('report_document_id', doc.id)} />
          </div>
        </div>

        <label className="test-best">
          <input type="checkbox" checked={Boolean(draft.is_best)}
            onChange={(event) => set('is_best', event.target.checked)} />
          <span aria-hidden="true">★</span> Best {TEST_TYPE_LABEL(draft.test_type)} result
        </label>

        <label className="test-field">
          <span className="field-label">Notes</span>
          <button type="button" className="test-add-note" onClick={() => set('notes', draft.notes || 'Add your note here…')}>Add note</button>
          <textarea className="test-input test-textarea" value={draft.notes} onChange={(event) => set('notes', event.target.value.slice(0, 500))}
            onBlur={() => { touch('notes'); if (mode === 'edit') flush() }} maxLength={500} />
          {errors.notes && <p className="field-error" role="alert">{errors.notes}</p>}
        </label>

        {mode === 'create' && (
          <footer className="test-panel__footer">
            <p className={`test-required${canCreate ? ' test-required--done' : ''}`} role="status">
              {canCreate ? '✓ ' : ''}{completed} of 2 required fields
            </p>
            {createError && <p className="field-error" role="alert">{createError}</p>}
            <div className="test-panel__footer-actions">
              <button type="button" className="test-btn test-btn--ghost" onClick={cancelCreate}>Cancel</button>
              <button type="submit" className="test-btn test-btn--primary" disabled={!canCreate || creating}>
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
