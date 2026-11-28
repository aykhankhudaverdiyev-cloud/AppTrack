/** ============================================================================
 * AcademicCollection — the generic "one card per row" academic collection
 * ============================================================================
 * Education, Test Scores and Honors & Awards each have their own page now
 * (EducationSection, TestScoresSection, HonorsSection). What is left here is
 * the collection Projects still uses to show graduate Publications inside its
 * "Publications (optional)" disclosure:
 *
 *   <AcademicCollection table="publications" userId={id} library={rows} />
 *
 * It keeps the original autosaving form: every edit is debounced and saved
 * with the whitelisted columns of its table (see ProfileServiceV2), and child
 * rows (grade rows, section scores) sync through `syncGradeRows` /
 * `syncSectionScores`.
 * ============================================================================ */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Field, CharWordCounter, ConfirmDialog } from '../forms'
import DatePicker from '../section/DatePicker'
import { useAutosave, useUnsavedGuard } from '../../hooks/useAutosave'
import * as rules from '../../utils/academicRules'
import {
  savePublication, deleteAcademicRow, syncGradeRows, syncSectionScores,
  saveScoreSending, newApplicationRowId,
} from '../../Services/ProfileServiceV2'
import '../profile/MyProfileSection.css'
import './AcademicSection.css'

const label = (s) => String(s).replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
const opt = (key, title, options, extra = {}) => ({ key, title, options, ...extra })
const field = (key, title, type = 'text', extra = {}) => ({ key, title, type, ...extra })
const grades = [9, 10, 11, 12, 13]

const config = {
  test_attempts: { title: 'Test Scores', singular: 'test attempt', required: 'test_type', save: null, defaults: { test_type: 'SAT', status: 'planned', attempt_number: 1 }, fields: [
    opt('test_type', 'Test', rules.TEST_TYPES), opt('status', 'Status', rules.TEST_STATUSES), field('attempt_number', 'Attempt number', 'number', { min: 1 }), field('test_date', 'Test date', 'date'), field('overall_score', 'Overall score', 'number'), field('overall_max', 'Maximum score', 'number'), field('trf_number', 'IELTS TRF number'), field('national_exam_name', 'National exam name'), field('is_home_edition', 'Home edition', 'checkbox'), field('is_mybest', 'TOEFL MyBest', 'checkbox'), field('is_best', 'Best attempt', 'checkbox'), field('notes', 'Private notes', 'textarea'),
  ] },
  honors: { title: 'Honors & Awards', singular: 'honor', required: 'title', save: null, defaults: {}, fields: [
    field('title', 'Title', 'text', { required: true, max: 100 }), field('levels', 'Recognition levels', 'multi', { options: rules.HONOR_LEVELS }), field('grade_levels', 'Grade levels', 'multi', { options: grades }), field('received_month', 'Received month', 'number', { min: 1, maxValue: 12 }), field('received_year', 'Received year', 'number'), opt('category', 'Category', rules.HONOR_CATEGORIES), opt('result', 'Result', rules.HONOR_RESULTS), field('subject', 'Subject'), field('issuer', 'Issuer'), field('participants_context', 'Participants / context'), field('description', 'Description', 'textarea'), field('verification_url', 'Verification URL', 'url'), field('is_top5_commonapp', 'Include in Common App Top 5', 'checkbox'),
  ] },
  publications: { title: 'Publications', singular: 'publication', required: 'title', save: savePublication, defaults: { status: 'in_preparation' }, fields: [
    field('title', 'Title', 'text', { required: true }), field('authors', 'Authors (comma separated)', 'tags'), field('my_author_position', 'My author position', 'number', { min: 1 }), field('venue', 'Venue'), field('pub_year', 'Publication year', 'number'), field('doi_url', 'DOI URL', 'url'), opt('pub_type', 'Publication type', rules.PUBLICATION_TYPES), field('peer_reviewed', 'Peer reviewed', 'checkbox'), opt('status', 'Status', rules.PUBLICATION_STATUSES),
  ] },
}

function StructuredText({ id, type, value, onCommit }) {
  const encode = useCallback(v => (type === 'tags'
    ? (v || []).join(', ')
    : (v || []).map(item => `${item.value}: ${item.label}`).join('\n')), [type])
  const [text, setText] = useState(() => encode(value))
  return <textarea id={id} rows={3} value={text} onChange={e => setText(e.target.value)} onBlur={() => {
    if (type === 'tags') onCommit(text.split(',').map(v => v.trim()).filter(Boolean))
    else onCommit(text.split('\n').filter(Boolean).map(line => { const [first, ...rest] = line.split(':'); return { value: first.trim(), label: rest.join(':').trim() } }))
  }} />
}

function Input({ spec, value, set, library }) {
  const { key, title, type = 'text', max, counter, required } = spec
  const options = typeof spec.options === 'string' ? (library[spec.options] || []).map(r => ({ value: r.id, text: r.title || r.position || r.organization_name || 'Activity' })) : spec.options
  if (type === 'checkbox') return <label className="academic-check"><input type="checkbox" checked={!!value} onChange={e => set(key, e.target.checked)} /> {title}</label>
  if (type === 'multi') return <fieldset className="academic-multi"><legend>{title}</legend>{options.map(v => <label key={v}><input type="checkbox" checked={(value || []).includes(v)} onChange={e => set(key, e.target.checked ? [...(value || []), v] : (value || []).filter(x => x !== v))} /> {typeof v === 'string' ? label(v) : v}</label>)}</fieldset>
  const display = type === 'tags' ? (value || []).join(', ') : type === 'metrics' ? (value || []).map(v => `${v.value}: ${v.label}`).join('\n') : value ?? ''
  const change = e => {
    const v = e.target.value
    if (type === 'number') set(key, v === '' ? null : Number(v))
    else if (type === 'tags') set(key, v.split(',').map(x => x.trim()).filter(Boolean))
    else if (type === 'metrics') set(key, v.split('\n').filter(Boolean).map(x => { const [n, ...rest] = x.split(':'); return { value: n.trim(), label: rest.join(':').trim() } }))
    else set(key, v || (options ? null : ''))
  }
  return <Field label={title} required={required}>{({ id }) => <>
    {['tags', 'metrics'].includes(type) ? <StructuredText id={id} type={type} value={value} onCommit={v => set(key, v)} /> : options ? <select id={id} value={display} onChange={change}><option value="">Select…</option>{options.map(o => { const v = typeof o === 'object' ? o.value : o; return <option key={v} value={v}>{typeof o === 'object' ? o.text : label(o)}</option> })}</select>
      : ['textarea', 'metrics'].includes(type) ? <textarea id={id} value={display} onChange={change} maxLength={max} rows={3} />
        : <input id={id} type={type === 'tags' ? 'text' : type} value={display} onChange={change} maxLength={max} min={spec.min} max={spec.maxValue} step={type === 'number' ? 'any' : undefined} />}
    {(max || counter) && <CharWordCounter value={display} maxChars={max || counter} compact />}
  </>}</Field>
}

function Status({ save }) {
  return save.saving
    ? <span className="mps-status mps-status--saving">Saving…</span>
    : save.error
      ? <span className="mps-status mps-status--error" title={save.error.message}>Save failed</span>
      : save.savedAt ? <span className="mps-status mps-status--saved">Saved</span> : null
}

function AcademicCard({ table, row, userId, library }) {
  const cfg = config[table]
  const [draft, setDraft] = useState(row)
  const [confirm, setConfirm] = useState(false)
  const dirty = useRef(new Set())
  const latest = useRef(draft)
  useEffect(() => { latest.current = draft }, [draft])
  useEffect(() => {
    setDraft(old => {
      const next = { ...row }
      for (const key of dirty.current) next[key] = old[key]
      return next
    })
  }, [row])
  const [error, setError] = useState('')
  const save = useAutosave(draft, useCallback(async value => {
    if (cfg.required && !String(value[cfg.required] || '').trim()) throw new Error('This field is required.')
    if (table === 'honors' && value.is_top5_commonapp && library.honors.filter(h => h.is_top5_commonapp && h.id !== value.id).length >= 5) throw new Error('Only five honors can be selected for Common App.')
    const keys = [...dirty.current]
    const patch = Object.fromEntries(keys.map(key => [key, value[key]]))
    if (table === 'test_attempts' && (keys.includes('test_type') || keys.includes('test_date'))) {
      patch.test_type = value.test_type
      patch.test_date = value.test_date || null
    }
    await cfg.save(userId, { id: value.id, ...patch })
    for (const key of keys) if (latest.current[key] === value[key]) dirty.current.delete(key)
  }, [cfg, userId, table, library.honors]))
  useUnsavedGuard(save.isDirty)
  const set = (key, value) => { dirty.current.add(key); save.markDirty(); setDraft(old => ({ ...old, [key]: value })) }
  const remove = async () => { try { await deleteAcademicRow(table, userId, row.id); setConfirm(false) } catch (e) { setError(e.message) } }
  return <section className="mps-card academic-card">
    <header className="mps-card__head">
      <div>
        <h3>{draft.title || draft.institution_name || draft.position || draft.organization_name || draft.test_type || cfg.singular}</h3>
        <p className="mps-card__sub">🔒 Private to you and your assigned counselor.</p>
      </div>
      <div className="mps-card__meta"><Status save={save} /><button type="button" className="mps-btn mps-btn--ghost" onClick={() => setConfirm(true)}>Delete</button></div>
    </header>
    {(save.error || error) && <p className="academic-error" role="alert">{save.error?.message || error} <button type="button" onClick={() => save.flush()}>Retry save</button></p>}
    <div className="mps-grid">{cfg.fields.map(spec => <Input key={spec.key} spec={spec} value={draft[spec.key]} set={set} library={library} />)}</div>
    {table === 'test_attempts' && <ChildRows key={row.id} userId={userId} row={row} table={table} library={library} />}
    {table === 'test_attempts' && <ScoreSending userId={userId} attempt={row} library={library} />}
    <ConfirmDialog open={confirm} title={`Delete this ${cfg.singular}?`} message="This cannot be undone." onCancel={() => setConfirm(false)} onConfirm={remove} />
  </section>
}

function ChildRows({ userId, row, table, library }) {
  const isGrade = table === 'education_entries'
  const tableName = isGrade ? 'grade_rows' : 'test_section_scores'
  const parentKey = isGrade ? 'entry_id' : 'attempt_id'
  const [rows, setRows] = useState(() => (library[tableName] || []).filter(r => r[parentKey] === row.id).sort((a, b) => a.sort_order - b.sort_order))
  const [removeId, setRemoveId] = useState(null)
  const save = useAutosave(rows, useCallback(async values => {
    if (values.some(r => !String(r[isGrade ? 'subject' : 'section'] || '').trim())) throw new Error('Enter a subject or section for every row.')
    await (isGrade ? syncGradeRows : syncSectionScores)(userId, row.id, values)
  }, [userId, row.id, isGrade]))
  useUnsavedGuard(save.isDirty)
  const update = (id, key, value) => { save.markDirty(); setRows(old => old.map(r => r.id === id ? { ...r, [key]: value } : r)) }
  return <div className="academic-child">
    <h4>{isGrade ? 'Subject grades' : 'Section scores'}</h4>
    <p className="mps-card__sub">{isGrade ? 'Enter subject, grade level (9–14) and semester (1–3) for each cell.' : 'SAT sections: 200–800 in steps of 10.'} Changes save automatically.</p>
    {rows.map(r => <div className="academic-child-row" key={r.id}>
      <label>{isGrade ? 'Subject' : 'Section'}<input value={r[isGrade ? 'subject' : 'section'] || ''} onChange={e => update(r.id, isGrade ? 'subject' : 'section', e.target.value)} /></label>
      {isGrade && <><label>Grade level<input type="number" min="9" max="14" value={r.grade_level ?? ''} onChange={e => update(r.id, 'grade_level', e.target.value ? Number(e.target.value) : null)} /></label><label>Semester<input type="number" min="1" max="3" value={r.semester ?? ''} onChange={e => update(r.id, 'semester', e.target.value ? Number(e.target.value) : null)} /></label></>}
      <label>{isGrade ? 'Grade' : 'Score'}<input type={isGrade ? 'text' : 'number'} value={r[isGrade ? 'grade' : 'score'] ?? ''} onChange={e => update(r.id, isGrade ? 'grade' : 'score', e.target.value === '' ? null : isGrade ? e.target.value : Number(e.target.value))} /></label>
      {isGrade ? <label><input type="checkbox" checked={!!r.is_predicted} onChange={e => update(r.id, 'is_predicted', e.target.checked)} /> Predicted</label> : <label>Maximum<input type="number" value={r.score_max ?? ''} onChange={e => update(r.id, 'score_max', e.target.value ? Number(e.target.value) : null)} /></label>}
      <button type="button" onClick={() => setRemoveId(r.id)}>Delete</button>
    </div>)}
    <div className="academic-actions">
      <button type="button" className="mps-btn mps-btn--ghost" onClick={() => setRows(old => [...old, { id: newApplicationRowId() }])}>＋ Add {isGrade ? 'grade' : 'section'}</button>
      <button type="button" className="mps-btn" onClick={save.flush}>Save {isGrade ? 'grades' : 'sections'}</button>
      <Status save={save} />
      {save.error && <span className="academic-error" role="alert">{save.error.message}</span>}
    </div>
    <ConfirmDialog open={!!removeId} title="Delete this row?" message="This cannot be undone." onCancel={() => setRemoveId(null)}
      onConfirm={() => { save.markDirty(); setRows(old => old.filter(r => r.id !== removeId)); setRemoveId(null) }} />
  </div>
}

function SendingRow({ userId, attempt, application, existing }) {
  const [value, setValue] = useState(() => existing || { application_id: application.id, attempt_id: attempt.id, requirement: 'required', self_reported: true, official_sent: false, delivery_confirmed: false })
  const save = useAutosave(value, useCallback(v => saveScoreSending(userId, v), [userId]))
  useUnsavedGuard(save.isDirty)
  const set = (key, v) => { save.markDirty(); setValue(old => ({ ...old, [key]: v })) }
  return <div className="academic-send"><strong>{application.university}</strong> <Status save={save} />
    <label>Requirement <select value={value.requirement} onChange={e => set('requirement', e.target.value)}>{rules.SCORE_REQUIREMENTS.map(v => <option key={v} value={v}>{label(v)}</option>)}</select></label>
    {[['self_reported', 'Self-reported'], ['official_sent', 'Official sent'], ['delivery_confirmed', 'Delivery confirmed']].map(([k, t]) => <label key={k}><input type="checkbox" checked={!!value[k]} onChange={e => set(k, e.target.checked)} /> {t}</label>)}
    <DatePicker mode="day" label="Sent on" value={value.sent_on || ''} onChange={v => set('sent_on', v || null)} />
    {save.error && <p className="academic-error" role="alert">{save.error.message} <button type="button" onClick={save.flush}>Retry</button></p>}
  </div>
}

function ScoreSending({ userId, attempt, library }) {
  return <div className="academic-child">
    <h4>Score sending by application</h4>
    {!library.applications.length && <p>Add an application to track score sending.</p>}
    {library.applications.map(app => <SendingRow key={app.id} userId={userId} attempt={attempt} application={app}
      existing={(library.score_sending || []).find(s => s.attempt_id === attempt.id && s.application_id === app.id)} />)}
  </div>
}

/** One collection: an "add" card, then one autosaving form card per row. */
export function AcademicCollection({ table, userId, library }) {
  const cfg = config[table]
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const all = [...(library[table] || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  const add = async () => {
    if (!newTitle.trim()) { setError('Enter a name first.'); return }
    const initial = { ...cfg.defaults, ...(cfg.required ? { [cfg.required]: newTitle.trim() } : {}), sort_order: all.length }
    setAdding(true); setError('')
    try { await cfg.save(userId, initial); setNewTitle('') } catch (e) { setError(e.message) } finally { setAdding(false) }
  }
  return <div className="mps academic-section">
    <div className="section-head section-head--stack">
      <div>
        <h3>{cfg.title}</h3>
        <p className="section-head__sub">Saved securely to your academic library.</p>
      </div>
    </div>
    <div className="mps-card academic-add">
      <label htmlFor={`add-${table}`}>{`New ${cfg.singular} name`}</label>
      <div className="academic-actions">
        <input id={`add-${table}`} value={newTitle} onChange={e => setNewTitle(e.target.value)} maxLength={table === 'honors' ? 100 : undefined} />
        <button className="mps-btn" type="button" disabled={adding} onClick={add}>＋ Add</button>
      </div>
      {error && <p className="academic-error" role="alert">{error}</p>}
    </div>
    {!all.length && <div className="mps-card">No {cfg.title.toLowerCase()} yet.</div>}
    {all.map(row => <AcademicCard key={row.id} row={row} table={table} userId={userId} library={library} />)}
  </div>
}

export default AcademicCollection
