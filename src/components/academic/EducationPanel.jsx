/** ============================================================================
 * EducationPanel — the right-hand editing panel of the Education page
 * ============================================================================
 * One panel for both create and edit (like TestPanel / HonorPanel):
 *   BASICS · ACADEMIC RECORD · GRADES · COUNSELOR · PROOF
 * Edit mode autosaves every field (800 ms debounce + blur) as a PATCH of just
 * the fields that changed. Grades save through `saveGrades()`, which deletes
 * emptied cells for real. Errors appear after a field is blurred or after a
 * submit attempt — never on load.
 * ============================================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAutosave } from '../../hooks/useAutosave'
import { usePanelValidation } from '../../hooks/usePanelValidation'
import { ValidationSummary } from '../forms/PanelValidation'
import EducationField from './EducationField'
import { CountrySelect } from './EducationInputs'
import GradeTable from './GradeTable'
import { DatePicker, ProofBlock, TipBox } from '../section'
import { saveGrades } from '../../Services/educationApi'
import { COUNTRIES } from '../../utils/applicationRequirements'
import {
  DEFAULT_FINAL_GRADE, EDUCATION_TYPES, FINAL_GRADE_OPTIONS, GRADING_SCALES, LANGUAGE_OPTIONS,
  QUALIFICATION_OPTIONS, REQUIRED_FIELDS, draftFromEntry, educationType, emptyEntryDraft,
  entryPayload, gradingMaximum, gradeSubjectsFromRows, isUniversity, patchFor,
  savedLabel, showsGrades, validateEducation,
} from '../../utils/education.js'
import './EducationPanel.css'

function SectionLabel({ children, aside }) {
  return (
    <p className="edu-section-label">
      <span>{children}</span>
      {aside}
    </p>
  )
}

function Switch({ checked, onChange, label }) {
  return (
    <label className="edu-switch">
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} />
      <span className="edu-switch__track" aria-hidden="true"><span /></span>
      <span className="edu-switch__text">{label}</span>
    </label>
  )
}

/** The centre of the "Overall average" field: a number plus the "/ 5" suffix. */
function AverageInput({ id, value, maximum, invalid, onChange, onBlur }) {
  return (
    <div className="edu-suffix">
      <input
        id={id} className="edu-input" inputMode="decimal" value={value} autoComplete="off"
        placeholder={maximum ? String(maximum) : ''} aria-invalid={invalid || undefined}
        onChange={(event) => {
          const next = event.target.value.replace(',', '.')
          if (/^\d{0,3}(?:\.\d{0,2})?$/.test(next)) onChange(next)
        }}
        onBlur={onBlur}
      />
      {maximum != null && <span className="edu-suffix__text" aria-hidden="true">/ {maximum}</span>}
    </div>
  )
}

export default function EducationPanel({
  mode = 'edit', row, userId, onCreate, onUpdate, onGradesSaved, onClose,
  pendingFiles, onPendingChange, onUploaded, onRequestDiscard, failedFiles, onRetryFile,
}) {
  const [createId] = useState(() => crypto.randomUUID())
  const [localPending, setLocalPending] = useState([])
  const [draft, setDraft] = useState(() => (mode === 'edit' && row ? draftFromEntry(row) : emptyEntryDraft()))
  const [subjects, setSubjects] = useState(() => (mode === 'edit' && row ? gradeSubjectsFromRows(row.grades || []) : []))
  const [now, setNow] = useState(() => Date.now())
  const [creating, setCreating] = useState(false)
  const [showSemesters, setShowSemesters] = useState(false)
  const [createError, setCreateError] = useState('')
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const latest = useRef(draft)
  const dirtyFields = useRef(new Set())

  useEffect(() => { latest.current = draft }, [draft])
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(timer)
  }, [])

  const ruleErrors = useMemo(() => validateEducation(draft), [draft])
  const requiredKeys = useMemo(
    () => REQUIRED_FIELDS.filter((key) => showsGrades(draft) || (key !== 'qualification' && key !== 'grading_scale')),
    [draft],
  )
  const validation = usePanelValidation(
    ruleErrors,
    requiredKeys.map((key) => ({ key, label: key.replace(/_/g, ' ') })),
  )
  const { errors } = validation

  const entryId = row?.id
  const persist = useCallback(async (value) => {
    if (!entryId) return
    const keys = [...dirtyFields.current]
    if (!keys.length) return
    await onUpdate?.(entryId, patchFor(entryPayload(value), keys))
    for (const key of keys) if (latest.current[key] === value[key]) dirtyFields.current.delete(key)
  }, [entryId, onUpdate])

  const { saving, savedAt, error: saveError, isDirty, markDirty, flush, flushAfterCommit } = useAutosave(draft, persist, {
    delay: 800,
    enabled: mode === 'edit',
  })

  const set = (key, value, { save = false } = {}) => {
    dirtyFields.current.add(key)
    if (key === 'grading_scale') dirtyFields.current.add('scale_maximum')
    if (key === 'school_does_not_rank') dirtyFields.current.add('class_rank')
    if (mode === 'edit') { markDirty(); if (save) flushAfterCommit() }
    setDraft((previous) => {
      const next = { ...previous, [key]: value }
      if (key === 'grading_scale') {
        const maximum = gradingMaximum(value)
        if (maximum != null) next.scale_maximum = maximum
      }
      if (key === 'entry_type' && value !== 'secondary_school') next.is_current = false
      return next
    })
  }
  const blur = () => { if (mode === 'edit') flush() }

  const requestClose = useCallback(async () => {
    if (mode === 'create') { if (onRequestDiscard) onRequestDiscard(); else setConfirmDiscard(true); return }
    await flush()
    onClose?.()
  }, [mode, flush, onClose, onRequestDiscard])

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') { event.stopPropagation(); requestClose() } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [requestClose])

  const submitCreate = async (event) => {
    event.preventDefault()
    if (mode !== 'create' || creating) return
    if (!validation.validateSubmit()) return
    setCreating(true)
    setCreateError('')
    try {
      // Keep the panel on screen until the page closes it from the new entry's
      // URL — closing here would let the panel's own autosave flush on unmount.
      await onCreate?.({ ...entryPayload(draft), id: createId }, subjects, pendingFiles ?? localPending)
    } catch (error) {
      setCreateError(error?.message || 'Could not create this entry. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  // Database rows → table model after a grade save: the RPC re-inserts every
  // row with a new id, so the panel must take the saved rows back (otherwise the
  // next edit would still carry the old ids).
  const gradesSaved = useCallback(async (nextSubjects) => {
    if (!entryId) return
    const rows = await saveGrades(userId, entryId, nextSubjects)
    onGradesSaved?.(entryId, rows)
    setSubjects(gradeSubjectsFromRows(rows))
  }, [entryId, userId, onGradesSaved])

  const status = mode === 'create'
    ? 'Not saved yet'
    : saving
      ? 'Saving…'
      : saveError
        ? "Couldn't save · Retry"
        : savedAt
          ? `${savedLabel(savedAt, now)} ✓`
          : isDirty ? 'Unsaved changes' : 'All changes saved'

  const type = educationType(draft.entry_type)
  const title = draft.institution_name || (mode === 'create' ? 'New education entry' : 'Untitled institution')
  const school = showsGrades(draft)
  const maximum = gradingMaximum(draft.grading_scale)

  return (
    <aside className="edu-panel" role="region" aria-label={title} tabIndex={-1}>
      <header className="edu-panel__head">
        <span className={`edu-panel__tile tile--${type.tint}`} aria-hidden="true">{mode === 'create' ? '＋' : type.emoji}</span>
        <h2 className="edu-panel__title" title={title}>{title}</h2>
        <span className={`edu-panel__save${saveError ? ' edu-panel__save--error' : ''}`} role="status" aria-live="polite">
          {saveError
            ? <button type="button" className="edu-panel__retry" onClick={flush}>Couldn&apos;t save · Retry</button>
            : status}
        </span>
        <button type="button" className="edu-panel__close" onClick={requestClose} aria-label="Close panel">
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <form className="edu-panel__body panel-validation" onSubmit={submitCreate} {...validation.formProps}>
        <SectionLabel>Basics</SectionLabel>

        <div className="edu-field" data-form-field="entry_type">
          <span className="edu-label" id="edu-type-label">Type <span className="edu-req" aria-hidden="true">*</span></span>
          <div className="edu-segmented" role="radiogroup" aria-labelledby="edu-type-label">
            {EDUCATION_TYPES.map((option) => (
              <button
                key={option.key} type="button" role="radio"
                aria-checked={draft.entry_type === option.key}
                className={`edu-segmented__item${draft.entry_type === option.key ? ' edu-segmented__item--on' : ''}`}
                onClick={() => set('entry_type', option.key, { save: true })}
              >{option.label}</button>
            ))}
          </div>
        </div>

        <div className="edu-row">
          <EducationField label="Institution name" required error={errors.institution_name}>
            {({ id, invalid, describedBy }) => (
              <input id={id} className="edu-input" value={draft.institution_name} maxLength={160}
                aria-invalid={invalid || undefined} aria-describedby={describedBy}
                onChange={(event) => set('institution_name', event.target.value)} onBlur={blur} />
            )}
          </EducationField>
          <EducationField label="Country" required error={errors.country}>
            {({ id, invalid }) => (
              <CountrySelect id={id} value={draft.country} invalid={invalid} options={COUNTRIES}
                onChange={(value) => set('country', value, { save: true })} onBlur={blur} />
            )}
          </EducationField>
        </div>

        <div className="edu-row">
          <EducationField label="City">
            {({ id }) => (
              <input id={id} className="edu-input" value={draft.city} maxLength={80}
                onChange={(event) => set('city', event.target.value)} onBlur={blur} />
            )}
          </EducationField>
          <EducationField label="School code (CEEB)">
            {({ id }) => (
              <input id={id} className="edu-input" value={draft.ceeb_code} placeholder="Optional" maxLength={12}
                onChange={(event) => set('ceeb_code', event.target.value)} onBlur={blur} />
            )}
          </EducationField>
        </div>

        <div className="edu-row">
          <EducationField label="Language of instruction">
            {({ id }) => (
              <div className="edu-select">
                <select id={id} className={`edu-input${draft.language_of_instruction ? '' : ' edu-input--placeholder'}`}
                  value={draft.language_of_instruction}
                  onChange={(event) => set('language_of_instruction', event.target.value, { save: true })}>
                  <option value="">Select language</option>
                  {LANGUAGE_OPTIONS.map((language) => <option key={language} value={language}>{language}</option>)}
                </select>
                <span className="edu-select__caret" aria-hidden="true">▾</span>
              </div>
            )}
          </EducationField>
          <div aria-hidden="true" />
        </div>

        <div className="edu-row">
          <DatePicker label="Start date" mode="month" required fieldKey="start_date"
            value={draft.start_date} error={errors.start_date}
            onChange={(value) => set('start_date', value)} onBlur={blur} />
          <DatePicker label="Expected graduation" mode="month" required fieldKey="end_date"
            value={draft.end_date} error={errors.end_date}
            min={draft.start_date || undefined}
            hint="The month you finish this school."
            onChange={(value) => set('end_date', value)} onBlur={blur} />
        </div>

        <Switch checked={draft.is_current} label="Currently attending"
          onChange={(value) => set('is_current', value, { save: true })} />

        {school && (
          <>
            <SectionLabel>Academic record</SectionLabel>
            <div className="edu-row">
              <EducationField label="Qualification" required error={errors.qualification}>
                {({ id, invalid }) => (
                  <div className="edu-select">
                    <select id={id} aria-invalid={invalid || undefined}
                      className={`edu-input${draft.qualification ? '' : ' edu-input--placeholder'}${invalid ? ' edu-input--invalid' : ''}`}
                      value={draft.qualification}
                      onChange={(event) => set('qualification', event.target.value, { save: true })}>
                      <option value="">Select qualification</option>
                      {QUALIFICATION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                    <span className="edu-select__caret" aria-hidden="true">▾</span>
                  </div>
                )}
              </EducationField>
              <EducationField label="Grading scale" required error={errors.grading_scale}>
                {({ id, invalid }) => (
                  <div className="edu-select">
                    <select id={id} aria-invalid={invalid || undefined}
                      className={`edu-input${draft.grading_scale ? '' : ' edu-input--placeholder'}${invalid ? ' edu-input--invalid' : ''}`}
                      value={draft.grading_scale}
                      onChange={(event) => set('grading_scale', event.target.value, { save: true })}>
                      <option value="">Select scale</option>
                      {GRADING_SCALES.map((option) => <option key={option.value} value={option.value}>{option.value}</option>)}
                    </select>
                    <span className="edu-select__caret" aria-hidden="true">▾</span>
                  </div>
                )}
              </EducationField>
            </div>

            <div className="edu-row">
              <EducationField label="Overall average">
                {({ id }) => (
                  <AverageInput id={id} value={draft.overall_average} maximum={maximum}
                    onChange={(value) => set('overall_average', value)} onBlur={blur} />
                )}
              </EducationField>
              <EducationField label="Class size">
                {({ id }) => (
                  <input id={id} className="edu-input" inputMode="numeric" value={draft.class_size} autoComplete="off"
                    onChange={(event) => { if (/^\d{0,4}$/.test(event.target.value)) set('class_size', event.target.value) }}
                    onBlur={blur} />
                )}
              </EducationField>
            </div>

            <div className="edu-row edu-row--rank">
              <EducationField label="Class rank" error={errors.class_rank}>
                {({ id }) => (
                  <input id={id} className="edu-input" inputMode="numeric" placeholder="—" autoComplete="off"
                    value={draft.school_does_not_rank ? '' : draft.class_rank}
                    disabled={draft.school_does_not_rank}
                    onChange={(event) => { if (/^\d{0,4}$/.test(event.target.value)) set('class_rank', event.target.value) }}
                    onBlur={blur} />
                )}
              </EducationField>
              <label className="edu-checkbox">
                <input type="checkbox" checked={Boolean(draft.school_does_not_rank)}
                  onChange={(event) => set('school_does_not_rank', event.target.checked, { save: true })} />
                <span>School does not rank</span>
              </label>
            </div>

            <SectionLabel>Grades</SectionLabel>
            <div className="edu-grades__toolbar">
              <label className="edu-inline-select">
                <span>Final grade</span>
                <span className="edu-select">
                  <select className="edu-input" value={draft.final_grade_level || DEFAULT_FINAL_GRADE}
                    onChange={(event) => set('final_grade_level', Number(event.target.value), { save: true })}>
                    {FINAL_GRADE_OPTIONS.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
                  </select>
                  <span className="edu-select__caret" aria-hidden="true">▾</span>
                </span>
              </label>
              <Switch checked={showSemesters} label="Show semesters"
                onChange={setShowSemesters} />
            </div>
            <GradeTable
              subjects={subjects}
              gradingScale={draft.grading_scale}
              finalGradeLevel={draft.final_grade_level}
              showSemesters={showSemesters}
              onChange={setSubjects}
              onSave={gradesSaved}
              onUseAverage={(value) => set('overall_average', value, { save: true })}
              enabled={mode === 'edit'}
            />
            {!showSemesters && subjects.some((subject) => Object.keys(subject.cells || {}).some((key) => key.endsWith(':1') || key.endsWith(':2'))) && (
              <p className="edu-helper">Semester grades are hidden, not deleted.</p>
            )}
          </>
        )}

        {isUniversity(draft) && (
          <>
            <SectionLabel>Degree</SectionLabel>
            <div className="edu-row">
              <EducationField label="Degree">
                {({ id }) => (
                  <input id={id} className="edu-input" value={draft.degree} placeholder="e.g. BSc" autoComplete="off"
                    onChange={(event) => set('degree', event.target.value)} onBlur={blur} />
                )}
              </EducationField>
              <EducationField label="Major">
                {({ id }) => (
                  <input id={id} className="edu-input" value={draft.major} autoComplete="off"
                    onChange={(event) => set('major', event.target.value)} onBlur={blur} />
                )}
              </EducationField>
            </div>
          </>
        )}

        <SectionLabel>Counselor</SectionLabel>
        <div className="edu-row">
          <EducationField label="Counselor name">
            {({ id }) => (
              <input id={id} className="edu-input" value={draft.school_counselor_name} autoComplete="name"
                onChange={(event) => set('school_counselor_name', event.target.value)} onBlur={blur} />
            )}
          </EducationField>
          <EducationField label="Counselor email" error={errors.school_counselor_email}>
            {({ id, invalid, describedBy }) => (
              <input id={id} className={`edu-input${invalid ? ' edu-input--invalid' : ''}`} type="email"
                value={draft.school_counselor_email} placeholder="name@school.az" autoComplete="email"
                aria-invalid={invalid || undefined} aria-describedby={describedBy}
                onChange={(event) => set('school_counselor_email', event.target.value)} onBlur={blur} />
            )}
          </EducationField>
        </div>
        <div className="edu-row">
          <EducationField label="Counselor phone" hint="Used for your recommendation requests.">
            {({ id, describedBy }) => (
              <input id={id} className="edu-input" value={draft.school_counselor_phone}
                placeholder="+994 ..." inputMode="tel" autoComplete="tel" aria-describedby={describedBy}
                onChange={(event) => set('school_counselor_phone', event.target.value)} onBlur={blur} />
            )}
          </EducationField>
          <div aria-hidden="true" />
        </div>

        <SectionLabel>Proof</SectionLabel>
        <ProofBlock section="education" itemId={mode === 'edit' ? entryId : createId} userId={userId}
          title="Transcript and certificates" pendingFiles={mode === 'create' ? (pendingFiles ?? localPending) : null}
          onPendingChange={onPendingChange || setLocalPending} onUploaded={onUploaded}
          failedFiles={failedFiles} onRetryFile={onRetryFile} />

        <TipBox>Tip: many applications ask you to type your grades by year, so keep this table complete.</TipBox>

        {mode === 'create' && (
          <footer className="edu-panel__footer">
            <ValidationSummary validation={validation} className="edu-required" completeClassName="edu-required--done" />
            {createError && <p className="sfield-error" role="alert">{createError}</p>}
            <div className="edu-panel__footer-actions">
              <button type="button" className="edu-btn edu-btn--ghost" onClick={requestClose}>Cancel</button>
              <button type="submit" className="edu-btn edu-btn--primary" disabled={creating}>
                {creating ? 'Creating…' : 'Create entry'}
              </button>
            </div>
          </footer>
        )}
      </form>

      {confirmDiscard && (
        <div className="edu-discard" role="presentation" onClick={() => setConfirmDiscard(false)}>
          <div className="edu-discard__box" role="alertdialog" aria-modal="true" aria-label="Discard this entry?"
            onClick={(event) => event.stopPropagation()}>
            <h3>Discard this entry?</h3>
            <p>{mode === 'create' ? 'Nothing has been saved yet.' : 'Changes that are still saving will be lost.'}</p>
            <div className="edu-discard__actions">
              <button type="button" className="edu-btn edu-btn--ghost" onClick={() => setConfirmDiscard(false)}>Keep editing</button>
              <button type="button" className="edu-btn edu-btn--danger"
                onClick={() => { setConfirmDiscard(false); onClose?.() }}>
                {mode === 'create' ? 'Discard' : 'Close anyway'}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
