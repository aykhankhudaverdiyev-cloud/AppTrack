import { useCallback, useEffect, useRef, useState } from 'react'
import { Field, CharWordCounter, ConfirmDialog, SortableList } from '../forms'
import { useAutosave, useUnsavedGuard } from '../../hooks/useAutosave'
import { ACTIVITY_TYPES, ACTIVITY_FILTER_CHIPS, COMMON_APP_LIMITS, UC_LIMITS } from '../../constants/activityTypes'
import * as rules from '../../utils/academicRules'
import { saveEducationEntry, saveTestAttempt, saveHonor, saveActivity, saveProject, savePublication, deleteAcademicRow, syncGradeRows, syncSectionScores, saveScoreSending, newApplicationRowId } from '../../Services/ProfileServiceV2'
import '../profile/MyProfileSection.css'
import './AcademicSection.css'

const label = (s) => String(s).replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
const opt = (key, title, options, extra = {}) => ({ key, title, options, ...extra })
const field = (key, title, type = 'text', extra = {}) => ({ key, title, type, ...extra })
const grades = [9, 10, 11, 12, 13]
const config = {
  education_entries: { title: 'Education', singular: 'education entry', required: 'institution_name', save: saveEducationEntry, defaults: { entry_type: 'secondary_school' }, fields: [
    opt('entry_type', 'Entry type', rules.EDUCATION_TYPES), field('institution_name', 'Institution name', 'text', { required: true }), field('country', 'Country'), field('city', 'City'), field('ceeb_code', 'CEEB code'), field('language_of_instruction', 'Language of instruction'), field('start_date', 'Start date', 'date'), field('end_date', 'End or expected graduation date', 'date'), field('is_current', 'Currently studying here', 'checkbox'),
    ...['qualification', 'grading_scale', 'overall_average', 'scale_maximum', 'class_rank', 'class_size', 'school_does_not_rank', 'current_year_courses', 'predicted_grades', 'mid_year_grades', 'school_counselor_name', 'school_counselor_email', 'school_counselor_phone'].map(k => field(k, label(k), ['overall_average', 'scale_maximum', 'class_rank', 'class_size'].includes(k) ? 'number' : k === 'school_does_not_rank' ? 'checkbox' : ['current_year_courses', 'predicted_grades', 'mid_year_grades'].includes(k) ? 'textarea' : 'text', { when: 'school' })),
    ...['degree', 'major', 'minor', 'gpa', 'gpa_scale', 'credits_completed', 'honours_classification', 'rank_percentile', 'thesis_title', 'thesis_supervisor', 'thesis_abstract'].map(k => field(k, label(k), ['gpa', 'gpa_scale', 'credits_completed', 'rank_percentile'].includes(k) ? 'number' : k === 'thesis_abstract' ? 'textarea' : 'text', { when: 'university' })),
    opt('credential_eval_status', 'Credential evaluation status', rules.CREDENTIAL_EVALUATION_STATUSES, { when: 'university' }), field('credential_eval_provider', 'Evaluation provider', 'text', { when: 'university' }), field('credential_eval_number', 'Evaluation number', 'text', { when: 'university' }),
  ] },
  test_attempts: { title: 'Test Scores', singular: 'test attempt', required: 'test_type', save: saveTestAttempt, defaults: { test_type: 'SAT', status: 'planned', attempt_number: 1 }, fields: [
    opt('test_type', 'Test', rules.TEST_TYPES), opt('status', 'Status', rules.TEST_STATUSES), field('attempt_number', 'Attempt number', 'number', { min: 1 }), field('test_date', 'Test date', 'date'), field('overall_score', 'Overall score', 'number'), field('overall_max', 'Maximum score', 'number'), field('trf_number', 'IELTS TRF number'), field('national_exam_name', 'National exam name'), field('is_home_edition', 'Home edition', 'checkbox'), field('is_mybest', 'TOEFL MyBest', 'checkbox'), field('is_best', 'Best attempt', 'checkbox'), field('notes', 'Private notes', 'textarea'),
  ] },
  honors: { title: 'Honors & Awards', singular: 'honor', required: 'title', save: saveHonor, defaults: {}, fields: [
    field('title', 'Title', 'text', { required: true, max: 100 }), field('levels', 'Recognition levels', 'multi', { options: rules.HONOR_LEVELS }), field('grade_levels', 'Grade levels', 'multi', { options: grades }), field('received_month', 'Received month', 'number', { min: 1, maxValue: 12 }), field('received_year', 'Received year', 'number'), opt('category', 'Category', rules.HONOR_CATEGORIES), opt('result', 'Result', rules.HONOR_RESULTS), field('subject', 'Subject'), field('issuer', 'Issuer'), field('participants_context', 'Participants / context'), field('description', 'Description', 'textarea'), field('verification_url', 'Verification URL', 'url'), field('is_top5_commonapp', 'Include in Common App Top 5', 'checkbox'),
  ] },
  activities: { title: 'Activities & Experiences', singular: 'activity', required: null, save: saveActivity, defaults: { activity_type: 'other_club' }, fields: [
    opt('activity_type', 'Activity type', ACTIVITY_TYPES.map(x => ({ value: x.key, text: x.label }))), field('position', 'Position / leadership', 'text', { max: 50 }), field('organization_name', 'Organisation', 'text', { max: 100 }), field('description', 'Common App description', 'textarea', { max: 150 }), field('long_description', 'Long description (UC / CV)', 'textarea', { counter: 350 }), field('grade_levels', 'Grade levels', 'multi', { options: grades }), opt('timing', 'Timing', rules.ACTIVITY_TIMINGS), field('hours_per_week', 'Hours per week', 'number', { min: 0, maxValue: 168 }), field('weeks_per_year', 'Weeks per year', 'number', { min: 0, maxValue: 52 }), field('start_date', 'Start date', 'date'), field('end_date', 'End date', 'date'), field('ongoing', 'Ongoing', 'checkbox'), field('city', 'City'), field('country', 'Country'), opt('participation_mode', 'Participation mode', rules.PARTICIPATION_MODES), field('supervisor_name', 'Supervisor name (private)'), field('supervisor_email', 'Supervisor email (private)', 'email'), field('is_paid', 'Paid', 'checkbox'), opt('employment_type', 'Employment type', rules.EMPLOYMENT_TYPES), field('industry', 'Industry'), field('earnings_for_family', 'Earnings support family', 'checkbox'), field('research_mentor', 'Research mentor (private)'), field('research_institution', 'Research institution'), field('research_question', 'Research question', 'textarea'), opt('output_status', 'Research output status', rules.RESEARCH_OUTPUT_STATUSES), field('plan_to_continue', 'Plan to continue research', 'checkbox'), field('impact_metrics', 'Impact metrics (one value: label per line)', 'metrics'),
  ] },
  projects: { title: 'Projects & Research', singular: 'project', required: 'title', save: saveProject, defaults: { visibility: 'private', status: 'in_progress' }, fields: [
    field('title', 'Title', 'text', { required: true }), opt('project_type', 'Project type', rules.PROJECT_TYPES), opt('role_type', 'Role', rules.PROJECT_ROLES), field('team_size', 'Team size', 'number', { min: 1 }), field('my_contribution', 'My contribution (required for team projects)', 'textarea'), field('start_date', 'Start date', 'date'), field('end_date', 'End date', 'date'), opt('status', 'Status', rules.PROJECT_STATUSES), field('short_description', 'Short description', 'textarea'), field('problem', 'Problem', 'textarea'), field('method', 'Method', 'textarea'), field('result', 'Result', 'textarea'), field('result_metrics', 'Result metrics'), field('tech_tags', 'Technology tags (comma separated)', 'tags'), ...['github_url', 'demo_url', 'video_url', 'paper_url', 'link'].map(k => field(k, label(k), 'url')), field('mentor_name', 'Mentor name (private)'), opt('related_activity_id', 'Related activity', 'activities'), opt('related_honor_id', 'Related honor', 'honors'), opt('visibility', 'Visibility', rules.PROJECT_VISIBILITIES),
  ] },
  publications: { title: 'Publications', singular: 'publication', required: 'title', save: savePublication, defaults: { status: 'in_preparation' }, fields: [
    field('title', 'Title', 'text', { required: true }), field('authors', 'Authors (comma separated)', 'tags'), field('my_author_position', 'My author position', 'number', { min: 1 }), field('venue', 'Venue'), field('pub_year', 'Publication year', 'number'), field('doi_url', 'DOI URL', 'url'), opt('pub_type', 'Publication type', rules.PUBLICATION_TYPES), field('peer_reviewed', 'Peer reviewed', 'checkbox'), opt('status', 'Status', rules.PUBLICATION_STATUSES),
  ] },
}

function StructuredText({ id, type, value, onCommit }) {
  const encode = useCallback(v => type === 'tags' ? (v || []).join(', ') : (v || []).map(item => `${item.value}: ${item.label}`).join('\n'), [type])
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
  return save.saving ? <span className="mps-status mps-status--saving">Saving…</span> : save.error ? <span className="mps-status mps-status--error" title={save.error.message}>Save failed</span> : save.savedAt ? <span className="mps-status mps-status--saved">Saved</span> : null
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
    if (table === 'projects' && value.role_type === 'team' && !String(value.my_contribution || '').trim()) throw new Error('Describe your contribution to the team project.')
    if (table === 'honors' && value.is_top5_commonapp && library.honors.filter(h => h.is_top5_commonapp && h.id !== value.id).length >= 5) throw new Error('Only five honors can be selected for Common App.')
    const keys = [...dirty.current]
    const patch = Object.fromEntries(keys.map(key => [key, value[key]]))
    if (table === 'test_attempts' && (keys.includes('test_type') || keys.includes('test_date'))) {
      patch.test_type = value.test_type
      patch.test_date = value.test_date || null
    }
    if (table === 'projects' && (keys.includes('role_type') || keys.includes('my_contribution'))) {
      patch.role_type = value.role_type || null
      patch.my_contribution = value.my_contribution || null
    }
    await cfg.save(userId, { id: value.id, ...patch })
    for (const key of keys) if (latest.current[key] === value[key]) dirty.current.delete(key)
  }, [cfg, userId, table, library.honors]))
  useUnsavedGuard(save.isDirty)
  const set = (key, value) => { dirty.current.add(key); save.markDirty(); setDraft(old => ({ ...old, [key]: value })) }
  const remove = async () => { try { await deleteAcademicRow(table, userId, row.id); setConfirm(false) } catch (e) { setError(e.message) } }
  const visible = spec => !spec.when || (spec.when === 'university' ? draft.entry_type === 'university' : draft.entry_type !== 'university')
  const expiry = table === 'test_attempts' && rules.scoreExpiryDate(draft.test_type, draft.test_date)
  const expiryDays = expiry ? Math.round((new Date(`${expiry}T00:00:00Z`) - new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)) / 86400000) : null
  return <section className="mps-card academic-card">
    <header className="mps-card__head"><div><h3>{draft.title || draft.institution_name || draft.position || draft.organization_name || draft.test_type || cfg.singular}</h3><p className="mps-card__sub">{table === 'projects' ? 'Public visibility does not bypass the existing approval flow.' : '🔒 Private to you and your assigned counselor.'}</p></div><div className="mps-card__meta"><Status save={save} /><button type="button" className="mps-btn mps-btn--ghost" onClick={() => setConfirm(true)}>Delete</button></div></header>
    {(save.error || error) && <p className="academic-error" role="alert">{save.error?.message || error} <button type="button" onClick={() => save.flush()}>Retry save</button></p>}
    {expiry && <p>Score expiry: {expiry}{expiryDays < 0 ? ' — expired' : expiryDays <= 90 ? ' — expires soon' : ''}</p>}
    {table === 'publications' && draft.my_author_position > 0 && <p>⭐ Your author position: {draft.my_author_position}{draft.authors?.[draft.my_author_position - 1] ? ` — ${draft.authors[draft.my_author_position - 1]}` : ''}</p>}
    <div className="mps-grid">{cfg.fields.filter(visible).map(spec => <Input key={spec.key} spec={spec} value={draft[spec.key]} set={set} library={library} />)}</div>
    {['education_entries', 'test_attempts'].includes(table) && <ChildRows key={row.id} userId={userId} row={row} table={table} library={library} />}
    {table === 'test_attempts' && <ScoreSending userId={userId} attempt={row} library={library} />}
    {['test_attempts', 'honors', 'projects', 'publications'].includes(table) && <p className="mps-card__sub">Document attachment picker will be available in Phase 5.</p>}
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
  return <div className="academic-child"><h4>{isGrade ? 'Subject grades' : 'Section scores'}</h4><p className="mps-card__sub">{isGrade ? 'Enter subject, grade level (9–14) and semester (1–3) for each cell.' : 'SAT sections: 200–800 in steps of 10.'} Changes save automatically.</p>
    {isGrade && [...new Set(rows.map(r => r.subject).filter(Boolean))].length > 0 && <div className="academic-grid-scroll"><table className="academic-grade-grid"><thead><tr><th>Subject</th>{[9, 10, 11, 12, 13, 14].flatMap(grade => [1, 2, 3].map(semester => <th key={`${grade}-${semester}`}>G{grade} S{semester}</th>))}</tr></thead><tbody>{[...new Set(rows.map(r => r.subject).filter(Boolean))].map(subject => <tr key={subject}><th>{subject}</th>{[9, 10, 11, 12, 13, 14].flatMap(grade => [1, 2, 3].map(semester => {
      const cell = rows.find(r => r.subject === subject && r.grade_level === grade && r.semester === semester)
      return <td key={`${grade}-${semester}`}><input aria-label={`${subject}, grade ${grade}, semester ${semester}`} value={cell?.grade || ''} onChange={e => {
        if (cell) update(cell.id, 'grade', e.target.value)
        else { save.markDirty(); setRows(old => [...old, { id: newApplicationRowId(), subject, grade_level: grade, semester, grade: e.target.value }]) }
      }} /></td>
    }))}</tr>)}</tbody></table></div>}
    {rows.map(r => <div className="academic-child-row" key={r.id}>
      <label>{isGrade ? 'Subject' : 'Section'}<input value={r[isGrade ? 'subject' : 'section'] || ''} onChange={e => update(r.id, isGrade ? 'subject' : 'section', e.target.value)} /></label>
      {isGrade && <><label>Grade level<input type="number" min="9" max="14" value={r.grade_level ?? ''} onChange={e => update(r.id, 'grade_level', e.target.value ? Number(e.target.value) : null)} /></label><label>Semester<input type="number" min="1" max="3" value={r.semester ?? ''} onChange={e => update(r.id, 'semester', e.target.value ? Number(e.target.value) : null)} /></label></>}
      <label>{isGrade ? 'Grade' : 'Score'}<input type={isGrade ? 'text' : 'number'} value={r[isGrade ? 'grade' : 'score'] ?? ''} onChange={e => update(r.id, isGrade ? 'grade' : 'score', e.target.value === '' ? null : isGrade ? e.target.value : Number(e.target.value))} /></label>
      {isGrade ? <label><input type="checkbox" checked={!!r.is_predicted} onChange={e => update(r.id, 'is_predicted', e.target.checked)} /> Predicted</label> : <label>Maximum<input type="number" value={r.score_max ?? ''} onChange={e => update(r.id, 'score_max', e.target.value ? Number(e.target.value) : null)} /></label>}
      <button type="button" onClick={() => setRemoveId(r.id)}>Delete</button>
    </div>)}
    <div className="academic-actions"><button type="button" className="mps-btn mps-btn--ghost" onClick={() => setRows(old => [...old, { id: newApplicationRowId() }])}>＋ Add {isGrade ? 'grade' : 'section'}</button><button type="button" className="mps-btn" onClick={save.flush}>Save {isGrade ? 'grades' : 'sections'}</button><Status save={save} />{save.error && <span className="academic-error" role="alert">{save.error.message}</span>}</div>
    <ConfirmDialog open={!!removeId} title="Delete this row?" message="This cannot be undone." onCancel={() => setRemoveId(null)} onConfirm={() => { save.markDirty(); setRows(old => old.filter(r => r.id !== removeId)); setRemoveId(null) }} />
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
    <label>Sent on <input type="date" value={value.sent_on || ''} onChange={e => set('sent_on', e.target.value || null)} /></label>
    {save.error && <p className="academic-error" role="alert">{save.error.message} <button type="button" onClick={save.flush}>Retry</button></p>}
  </div>
}
function ScoreSending({ userId, attempt, library }) {
  return <div className="academic-child"><h4>Score sending by application</h4>{!library.applications.length && <p>Add an application to track score sending.</p>}{library.applications.map(app => <SendingRow key={app.id} userId={userId} attempt={attempt} application={app} existing={(library.score_sending || []).find(s => s.attempt_id === attempt.id && s.application_id === app.id)} />)}</div>
}

function Collection({ table, userId, library, activeTab }) {
  const cfg = config[table]
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ volunteering: 'volunteering', experience: 'work', projects: 'projects' })
  const filter = filters[activeTab] || 'all'
  const setFilter = value => setFilters(old => ({ ...old, [activeTab]: value }))
  const all = [...(library[table] || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  const chip = ACTIVITY_FILTER_CHIPS.find(c => c.key === filter)
  const items = table === 'activities' && chip?.types ? all.filter(a => chip.types.includes(a.activity_type)) : all
  const add = async () => {
    if (!newTitle.trim()) { setError('Enter a name first.'); return }
    const initial = { ...cfg.defaults, ...(cfg.required ? { [cfg.required]: newTitle.trim() } : { position: newTitle.trim().slice(0, 50), long_description: newTitle.trim().length > 50 ? newTitle.trim() : null }), sort_order: all.length }
    if (table === 'activities' && chip?.types?.length) initial.activity_type = chip.types[0]
    if (table === 'test_attempts') { initial.test_type = rules.TEST_TYPES.includes(newTitle.trim().toUpperCase()) ? newTitle.trim().toUpperCase() : 'OTHER'; if (initial.test_type === 'OTHER') initial.notes = `Test name: ${newTitle.trim()}` }
    setAdding(true); setError('')
    try { await cfg.save(userId, initial); setNewTitle('') } catch (e) { setError(e.message) } finally { setAdding(false) }
  }
  const reorder = async (ordered, top) => {
    setError('')
    try { for (let i = 0; i < ordered.length; i++) await cfg.save(userId, { id: ordered[i].id, ...(top ? { top5_order: i } : { sort_order: i }) }) } catch (e) { setError(e.message) }
  }
  const topHonors = table === 'honors' ? all.filter(x => x.is_top5_commonapp).sort((a, b) => (a.top5_order ?? 999) - (b.top5_order ?? 999)) : []
  return <div className="mps academic-section"><div className="section-head section-head--stack"><div><h3>{cfg.title}</h3><p className="section-head__sub">Saved securely to your academic library.</p></div></div>
    {table === 'activities' && <><div className="academic-chips">{ACTIVITY_FILTER_CHIPS.map(c => <button key={c.key} type="button" className={filter === c.key ? 'active' : ''} onClick={() => setFilter(c.key)}>{c.emoji} {c.label}</button>)}</div><p>Common App: first {COMMON_APP_LIMITS.maxEntries} · UC: up to {UC_LIMITS.maxEntries} activities; UC description limit {UC_LIMITS.description} characters. {all.length} entries.</p>{all.length > UC_LIMITS.maxEntries && <p className="academic-error">More than 20 entries; select which to copy to UC.</p>}</>}
    {table === 'honors' && topHonors.length > 0 && <section className="mps-card"><h3>Common App Top 5</h3><SortableList items={topHonors} onReorder={next => reorder(next, true)} renderItem={r => r.title} /></section>}
    {table === 'activities' && all.length > 0 && <details className="mps-card"><summary>Order activities for Common App / UC</summary><SortableList items={all} onReorder={next => reorder(next, false)} renderItem={(r, i) => <span>{r.position || r.organization_name || label(r.activity_type)} {i < 10 ? '· Common App' : ''}</span>} /></details>}
    <div className="mps-card academic-add"><label htmlFor={`add-${table}`}>{table === 'test_attempts' ? 'Test name (e.g. SAT, IELTS)' : `New ${cfg.singular} name`}</label><div className="academic-actions"><input id={`add-${table}`} value={newTitle} onChange={e => setNewTitle(e.target.value)} maxLength={table === 'honors' ? 100 : undefined} /><button className="mps-btn" type="button" disabled={adding} onClick={add}>＋ Add</button></div>{error && <p className="academic-error" role="alert">{error}</p>}</div>
    {!items.length && <div className="mps-card">No {cfg.title.toLowerCase()} yet.</div>}
    {all.map(row => <div key={row.id} hidden={!items.some(item => item.id === row.id)}><AcademicCard row={row} table={table} userId={userId} library={library} /></div>)}
  </div>
}

export default function AcademicSection({ activeTab, userId, library, loading, error, onRetry, level }) {
  const sections = [ ['education', 'education_entries'], ['test_scores', 'test_attempts'], ['honors', 'honors'], ['projects', 'projects'], ['projects', 'publications'] ]
  const academicTabs = ['education', 'test_scores', 'honors', 'volunteering', 'experience', 'projects']
  return <div hidden={!academicTabs.includes(activeTab)}>
    {error && <div className="mps-error" role="alert">{error} <button type="button" onClick={onRetry}>Retry</button></div>}
    {loading ? <div className="mps-loading">Loading academic library…</div> : !library.education_entries ? null : <>
      {sections.map(([tab, table]) => <div key={`${tab}-${table}`} hidden={tab !== activeTab}>
        {table === 'publications' && !rules.isGraduateLevel(level) ? <details><summary>Publications (optional)</summary><Collection table={table} userId={userId} library={library} activeTab={activeTab} /></details> : <Collection table={table} userId={userId} library={library} activeTab={activeTab} />}
      </div>)}
      <div hidden={!['volunteering', 'experience', 'projects'].includes(activeTab)}><Collection table="activities" userId={userId} library={library} activeTab={activeTab} /></div>
    </>}
  </div>
}
