/**
 * ============================================================================
 * ApplicationModal — Phase 3 (spec §11) — full application workspace
 * ----------------------------------------------------------------------------
 * Legacy fields (university, program, major, term, deadline, status, decision,
 * recommendation, notes, visibility) are KEPT and still written by the store.
 * On top of them, this modal edits every additive Phase 3 column and the five
 * child tables:
 *   application_choices      — ranked programmes (HKU 3 / NTU 5)
 *   application_deadlines    — many deadlines, ORIGINAL zone + Baku conversion
 *   application_requirements — generated checklist → progress_percent cache
 *   interviews               — repeatable, timezone-aware
 *   application_essays       — links to Phase 2 essays + AI-rules notes
 *
 * Top-level fields autosave (debounced); list rows save on discrete actions and
 * on blur, with an explicit "Save changes" fallback in every list. Deadlines
 * keep the legacy `applications.deadline` DATE in sync (original zone date).
 * Portal passwords are NEVER stored — URL + login email + applicant ID only.
 * ============================================================================
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  saveApplication, mapApplicationRow, APPLICATION_COLUMNS, notifyDataChanged,
} from '../store/studentsStore'
import {
  Field, ValidatedInput, ValidatedSelect, CharWordCounter, ConfirmDialog, SortableList,
} from './forms'
import { useAutosave } from '../hooks/useAutosave'
import {
  describeStoredDeadline, utcToZonedInput, zonedInputToUtcIso,
  getStudentTimeZone, defaultTimeZoneForCountry, COMMON_TIME_ZONES,
} from '../utils/timezone'
import { defaultApplicationForm, applicationFormToPayload } from '../utils/applicationPayload'
import {
  DEGREE_LEVELS, TERM_SEASONS, PLATFORMS, ROUNDS, FIT_OPTIONS, DEADLINE_KINDS,
  INTERVIEW_TYPES, REQUIREMENT_STATUSES, AID_POLICIES, AID_PERIODS, CURRENCIES,
  COUNTRIES, labelOf, statusLabel, getProgramChoiceLimit, generateRequirements,
  computeRequirementProgress, essayStatusToRequirementStatus,
} from '../utils/applicationRequirements'
import {
  searchUniversities, fetchUniversityById, fetchApplicationWorkspace,
  newApplicationRowId, saveApplicationChoices, saveApplicationDeadlines,
  saveApplicationRequirements, saveApplicationInterviews, saveApplicationEssayLinks,
} from '../Services/ProfileServiceV2'
import './profile/MyProfileSection.css'
import './ApplicationModal.css'

const TABS = [
  { key: 'basics', label: '📋 Basics' },
  { key: 'portal', label: '🔐 Portal & fee' },
  { key: 'fit', label: '🎯 Fit & research' },
  { key: 'programs', label: '🎓 Programmes' },
  { key: 'deadlines', label: '⏰ Deadlines' },
  { key: 'checklist', label: '✅ Checklist' },
  { key: 'interviews', label: '🎙️ Interviews' },
  { key: 'decision', label: '🏁 Decision & aid' },
]

const STATUS_OPTIONS = ['Not Started', 'In Progress', 'Submitted', 'Accepted', 'Rejected', 'Deferred', 'Waitlisted']
const DECISION_OPTIONS = ['Pending', 'Accepted', 'Rejected', 'Deferred', 'Waitlisted']
const RECOMMENDATION_OPTIONS = ['Pending', 'Submitted', 'Not Required']
const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ key: c, label: c }))
const SEASON_OPTIONS = TERM_SEASONS.map((s) => ({ key: s, label: s }))

const urlError = (v) => (v && !/^https?:\/\/\S+\.\S+/.test(v) ? 'Enter a full URL starting with https://' : '')
const emailError = (v) => (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Enter a valid email address' : '')
const yearError = (v) => (v && (!/^\d{4}$/.test(String(v)) || Number(v) < 2000 || Number(v) > 2100) ? 'Use a 4-digit year between 2000 and 2100' : '')
const rateError = (v) => (v !== '' && v != null && (Number(v) < 0 || Number(v) > 100) ? 'Acceptance rate is a percentage between 0 and 100' : '')
const moneyError = (v) => (v !== '' && v != null && Number(v) < 0 ? 'Amount cannot be negative' : '')

function rowToForm(row) {
  const b = mapApplicationRow(row)
  const reply = b.replyDeadlineAt
    ? utcToZonedInput(b.replyDeadlineAt, b.replyDeadlineTz || 'UTC')
    : { date: '', time: '' }
  return {
    ...defaultApplicationForm(),
    ...b,
    decisionAtDate: b.decisionAt ? String(b.decisionAt).slice(0, 10) : '',
    committedAtDate: b.committedAt ? String(b.committedAt).slice(0, 10) : '',
    replyDeadlineDate: reply.date,
    replyDeadlineTime: reply.time,
    replyDeadlineTz: b.replyDeadlineTz || '',
    country: '',
  }
}

const choiceFromRow = (r) => ({
  id: r.id, programName: r.program_name || '', programCode: r.program_code || '',
  major: r.major || '', minor: r.minor || '',
})
const deadlineFromRow = (r) => {
  const p = utcToZonedInput(r.due_at, r.original_timezone || 'UTC')
  return {
    id: r.id, kind: r.kind || 'application', label: r.label || '',
    date: p.date, time: p.time, originalTimezone: r.original_timezone || 'UTC',
    dueAtIso: r.due_at || null,
  }
}
const requirementFromRow = (r) => ({
  id: r.id, reqKey: r.req_key, label: r.label, status: r.status || 'not_started',
  meta: r.meta || {}, sortOrder: r.sort_order || 0,
})
const interviewFromRow = (r) => {
  const p = r.scheduled_at
    ? utcToZonedInput(r.scheduled_at, r.original_timezone || 'UTC')
    : { date: '', time: '' }
  return {
    id: r.id, date: p.date, time: p.time,
    originalTimezone: r.original_timezone || 'UTC',
    interviewType: r.interview_type || '', interviewer: r.interviewer || '',
    prepNotes: r.prep_notes || '', thankYouSentOn: r.thank_you_sent_on || '',
  }
}
const linkFromRow = (r) => ({
  id: r.id, essayId: r.essay_id, aiRulesNote: r.ai_rules_note || '',
})

const countryKey = (id) => `apptrack.app_country.${id}`
function readCountry(id) {
  try { return localStorage.getItem(countryKey(id)) || '' } catch { return '' }
}
function writeCountry(id, value) {
  try { localStorage.setItem(countryKey(id), value || '') } catch { /* private mode */ }
}

const nextRow = (list, index, patch) => list.map((r, i) => (i === index ? { ...r, ...patch } : r))
const without = (list, index) => list.filter((_, i) => i !== index)

/* ─────────────────────────── small presentational pieces ───────────────── */

function Card({ title, sub, actions, children }) {
  return (
    <section className="mps-card am-card">
      {(title || actions) && (
        <div className="mps-card__head">
          <div><h3>{title}</h3>{sub && <p className="mps-card__sub">{sub}</p>}</div>
          {actions && <div className="mps-card__meta">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

function SaveStatus({ saving, savedAt, error }) {
  if (error) return <span className="mps-status mps-status--error" title={String(error.message || error)}>Save failed</span>
  if (saving) return <span className="mps-status mps-status--saving">Saving…</span>
  if (savedAt) return <span className="mps-status mps-status--saved">Saved</span>
  return <span className="mps-status mps-status--idle">Autosave on</span>
}

function Check({ label, checked, onChange, hint }) {
  return (
    <label className="am-check">
      <input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
      {hint && <small>{hint}</small>}
    </label>
  )
}

function Area({ label, value, onChange, rows = 3, hint, counter, placeholder }) {
  return (
    <Field label={label} hint={hint}>
      {({ id }) => (
        <>
          <textarea id={id} value={value || ''} rows={rows} placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)} />
          {counter && <CharWordCounter value={value || ''} compact />}
        </>
      )}
    </Field>
  )
}

function ZoneField({ label, value, onChange, onBlur }) {
  return (
    <Field label={label} hint="Original university time zone (IANA), e.g. Asia/Hong_Kong">
      {({ id }) => (
        <input id={id} list="am-tz-list" value={value || ''} placeholder="Asia/Baku"
          onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
      )}
    </Field>
  )
}

function DeadlineSummary({ row, studentTz }) {
  const dueAt = zonedInputToUtcIso(row.date, row.time, row.originalTimezone || 'UTC')
  if (!dueAt) return <p className="am-hint">Add a date and time to see the Baku conversion.</p>
  const d = describeStoredDeadline({ due_at: dueAt, original_timezone: row.originalTimezone || 'UTC' }, studentTz)
  if (!d) return <p className="am-hint">Check the time zone — this one is not recognised.</p>
  return (
    <div className="am-dl-summary">
      <span>🏫 {d.originalText}</span>
      <span>📍 {d.localText} <b>(your time)</b></span>
      <span className={d.isUrgent ? 'am-urgent' : ''}>⏳ {d.countdownText}</span>
      {d.dayShift !== 0 && (
        <span className="mps-warning">⚠️ Different day in your time zone ({d.dayShift > 0 ? 'next day' : 'previous day'}) — plan around the ORIGINAL time.</span>
      )}
    </div>
  )
}

function ListFooter({ state, onSave, label = 'Save changes' }) {
  return (
    <div className="am-list-foot">
      <button type="button" className="mps-btn mps-btn--ghost" onClick={onSave}>
        {state?.saving ? 'Saving…' : label}
      </button>
      {state?.error && <span className="am-error">{state.error}</span>}
      {!state?.error && state?.savedAt && <span className="mps-status mps-status--saved">Saved</span>}
    </div>
  )
}

/* ───────────────────────────────── modal ───────────────────────────────── */

export default function ApplicationModal({
  open, userId, studentId, application, onClose, onSave, profileTimeZone,
  applyingLevel = '', financialAid = false, initialTab = 'basics',
}) {
  const ownerId = userId || studentId || ''
  const [appId, setAppId] = useState(application?.id || null)
  const [tab, setTab] = useState('basics')
  const [form, setForm] = useState(defaultApplicationForm)
  const [loadedFor, setLoadedFor] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const [matches, setMatches] = useState([])

  const [choices, setChoices] = useState([])
  const [deadlines, setDeadlines] = useState([])
  const [requirements, setRequirements] = useState([])
  const [interviews, setInterviews] = useState([])
  const [essayLinks, setEssayLinks] = useState([])
  const [essayOptions, setEssayOptions] = useState([])
  const [listState, setListState] = useState({})
  const [confirm, setConfirm] = useState(null)

  const studentTz = useMemo(() => getStudentTimeZone(profileTimeZone), [profileTimeZone])
  const loadKey = appId || 'new'
  const loaded = loadedFor === loadKey
  const choiceRule = useMemo(() => getProgramChoiceLimit(form.university), [form.university])
  const progress = useMemo(() => computeRequirementProgress(requirements), [requirements])

  /* ---- load the whole workspace (all setState inside async callbacks) ---- */
  useEffect(() => {
    if (!open || !ownerId) return undefined
    let alive = true
    const key = appId || 'new'
    const task = appId
      ? Promise.all([
        supabase.from('applications').select(APPLICATION_COLUMNS)
          .eq('id', appId).eq('student_id', ownerId).single(),
        fetchApplicationWorkspace(ownerId, appId),
      ]).then(async ([rowRes, workspace]) => {
        if (rowRes.error) throw rowRes.error
        const f = rowToForm(rowRes.data)
        let country = readCountry(appId)
        if (f.universityId) {
          const uni = await fetchUniversityById(f.universityId)
          if (uni?.country) country = uni.country
        }
        return { f, country: country || '', workspace }
      })
      : Promise.resolve({
        f: { ...defaultApplicationForm(), degreeLevel: applyingLevel || '', country: '' },
        country: '',
        workspace: { choices: [], deadlines: [], requirements: [], interviews: [], essayLinks: [], essayOptions: [] },
      })
    task
      .then(({ f, country, workspace }) => {
        if (!alive) return
        setForm({ ...f, country })
        setChoices(workspace.choices.map(choiceFromRow))
        setDeadlines(workspace.deadlines.map(deadlineFromRow))
        setRequirements(workspace.requirements.map(requirementFromRow))
        setInterviews(workspace.interviews.map(interviewFromRow))
        setEssayLinks(workspace.essayLinks.map(linkFromRow))
        setEssayOptions(workspace.essayOptions || [])
        setLoadError('')
        setActionError('')
        setListState({})
        setTab(appId ? (initialTab || 'basics') : 'basics')
        setLoadedFor(key)
      })
      .catch((e) => {
        if (!alive) return
        setLoadError(e.message || 'Could not load this application.')
        setLoadedFor(key)
      })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ownerId, appId])

  /* ---- university autocomplete (public reference table) ---- */
  useEffect(() => {
    if (!open) return undefined
    let alive = true
    const timer = setTimeout(() => {
      searchUniversities(form.university, 25)
        .then((rows) => { if (alive) setMatches(rows) })
        .catch(() => { if (alive) setMatches([]) })
    }, 250)
    return () => { alive = false; clearTimeout(timer) }
  }, [open, form.university])

  /* ---- top-level autosave ---- */
  const saveForm = useCallback(async (f) => {
    if (!appId || !ownerId) return
    await saveApplication(ownerId, applicationFormToPayload(f, appId))
  }, [appId, ownerId])
  const { saving, savedAt, error: autosaveError, markDirty, flush } =
    useAutosave(form, saveForm, { enabled: Boolean(open && appId && loaded) })

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    markDirty()
    if (key === 'country' && appId) writeCountry(appId, value)
  }

  const handleUniversityChange = (value) => {
    const exact = matches.find((u) => u.name.toLowerCase() === value.trim().toLowerCase())
    setForm((f) => ({
      ...f,
      university: value,
      universityId: exact?.id || null,
      country: exact?.country || f.country,
    }))
    markDirty()
    if (exact?.country && appId) writeCountry(appId, exact.country)
  }

  const handleRound = (value) => {
    const round = ROUNDS.find((r) => r.key === value)
    setForm((f) => ({ ...f, round: value || '', isBinding: round?.binding ?? f.isBinding }))
    markDirty()
  }

  /* ---- child list persistence ---- */
  const setListStatus = (kind, patch) =>
    setListState((s) => ({ ...s, [kind]: { ...(s[kind] || {}), ...patch } }))

  const persist = useCallback(async (kind, rows) => {
    if (!appId || !ownerId) return
    setListStatus(kind, { saving: true, error: '' })
    try {
      if (kind === 'choices') {
        await saveApplicationChoices(ownerId, appId, rows, choiceRule.limit)
      } else if (kind === 'deadlines') {
        const { legacyDeadline } = await saveApplicationDeadlines(ownerId, appId, rows)
        setForm((f) => ({ ...f, deadline: legacyDeadline || '' }))
      } else if (kind === 'requirements') {
        const { progress: pct } = await saveApplicationRequirements(ownerId, appId, rows)
        setForm((f) => ({ ...f, progressPercent: pct }))
      } else if (kind === 'interviews') {
        await saveApplicationInterviews(ownerId, appId, rows)
      } else if (kind === 'links') {
        await saveApplicationEssayLinks(ownerId, appId, rows)
      }
      setListStatus(kind, { saving: false, savedAt: Date.now(), error: '' })
      notifyDataChanged()
    } catch (e) {
      setListStatus(kind, { saving: false, error: e.message || 'Save failed' })
    }
  }, [appId, ownerId, choiceRule.limit])

  const addRow = (kind, row) => {
    const setters = {
      choices: setChoices, deadlines: setDeadlines, requirements: setRequirements,
      interviews: setInterviews, links: setEssayLinks,
    }
    const lists = { choices, deadlines, requirements, interviews, links: essayLinks }
    const next = [...lists[kind], row]
    setters[kind](next)
    if (kind !== 'deadlines') persist(kind, next)
    else if (row.date && row.time) persist(kind, next)
  }

  const editRow = (kind, index, patch, commit = false) => {
    const lists = { choices, deadlines, requirements, interviews, links: essayLinks }
    const setters = {
      choices: setChoices, deadlines: setDeadlines, requirements: setRequirements,
      interviews: setInterviews, links: setEssayLinks,
    }
    const next = nextRow(lists[kind], index, patch)
    setters[kind](next)
    if (commit) persist(kind, next)
  }

  const removeRow = (kind, index, name) => {
    setConfirm({
      title: 'Delete this row?',
      message: `${name || 'This entry'} will be removed from this application.`,
      onConfirm: () => {
        const lists = { choices, deadlines, requirements, interviews, links: essayLinks }
        const setters = {
          choices: setChoices, deadlines: setDeadlines, requirements: setRequirements,
          interviews: setInterviews, links: setEssayLinks,
        }
        const next = without(lists[kind], index)
        setters[kind](next)
        persist(kind, next)
      },
    })
  }

  const saveAllLists = () => {
    persist('choices', choices)
    persist('deadlines', deadlines)
    persist('requirements', requirements)
    persist('interviews', interviews)
    persist('links', essayLinks)
  }

  /* ---- create / close ---- */
  const handleCreate = async () => {
    if (!form.university.trim()) { setActionError('University is required.'); return }
    setBusy(true)
    setActionError('')
    try {
      const saved = await onSave(applicationFormToPayload(form, null))
      if (!saved?.id) throw new Error('Application was created but no id was returned.')
      setAppId(saved.id)
      setTab('basics')
      notifyDataChanged()
    } catch (e) {
      setActionError(e.message || 'Could not create the application.')
    } finally {
      setBusy(false)
    }
  }

  const handleClose = async () => {
    // Clicking any button blurs the focused input first, so list rows already
    // committed; only the debounced top-level form still needs flushing.
    if (appId) await flush()
    onClose?.()
  }

  /* ---- checklist generation ---- */
  const generate = () => {
    const ctx = {
      degreeLevel: form.degreeLevel, platform: form.platform, country: form.country,
      universityName: form.university, financialAid: Boolean(financialAid),
    }
    const generated = generateRequirements(ctx)
    const existing = new Map(requirements.map((r) => [r.reqKey, r]))
    const merged = generated.map((g, index) => {
      const old = existing.get(g.req_key)
      return {
        id: old?.id || newApplicationRowId(),
        reqKey: g.req_key,
        label: old?.label || g.label,
        status: old?.status || g.status,
        meta: { ...g.meta, ...(old?.meta || {}), generated: true },
        sortOrder: index,
      }
    })
    const custom = requirements.filter((r) => !r.meta?.generated).map((r, i) => ({
      ...r, sortOrder: merged.length + i,
    }))
    const next = [...merged, ...custom]
    setRequirements(next)
    persist('requirements', next)
  }

  const syncEssayStatuses = () => {
    const byId = new Map(essayOptions.map((e) => [e.id, e]))
    const next = requirements.map((r) => {
      const essay = byId.get(r.meta?.essayId)
      return essay ? { ...r, status: essayStatusToRequirementStatus(essay.status) } : r
    })
    setRequirements(next)
    persist('requirements', next)
  }

  /* ------------------------------------------------------------------ */
  /* Tab renderers                                                       */
  /* ------------------------------------------------------------------ */

  const renderBasics = () => (
    <div className="am-stack">
      <Card title="University & programme" sub="Autocomplete uses the 123-university reference table. Free text is always allowed.">
        <div className="mps-grid">
          <Field label="University" required hint="Pick a suggestion to link it to the reference table and auto-fill the country.">
            {({ id }) => (
              <>
                <input id={id} list="am-uni-list" value={form.university} required
                  placeholder="Start typing a university name"
                  onChange={(e) => handleUniversityChange(e.target.value)} />
                <datalist id="am-uni-list">
                  {matches.map((u) => (
                    <option key={u.id} value={u.name}>{u.country}{u.city ? ` · ${u.city}` : ''}</option>
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <ValidatedSelect label="Country (for checklist rules)" value={form.country}
            onChange={(v) => setField('country', v || '')} options={COUNTRIES}
            hint="Used only to generate the right checklist; stored with the app locally." />
          <ValidatedInput label="Programme" value={form.program} onChange={(v) => setField('program', v)} placeholder="e.g. MSc Computer Science" />
          <ValidatedInput label="Major" value={form.major} onChange={(v) => setField('major', v)} placeholder="e.g. Computer Science" />
          <ValidatedInput label="Campus" value={form.campus} onChange={(v) => setField('campus', v)} placeholder="e.g. Main campus, Satellite" />
          <ValidatedSelect label="Degree level" value={form.degreeLevel}
            onChange={(v) => setField('degreeLevel', v || '')} options={DEGREE_LEVELS}
            hint="Drives the generated requirements checklist." />
        </div>
        {form.universityId && <p className="am-hint">🔗 Linked to the universities reference table.</p>}
      </Card>

      <Card title="Term & round" sub="Legacy text fields stay in sync for the admin and public views.">
        <div className="mps-grid">
          <ValidatedSelect label="Term season" value={form.termSeason}
            onChange={(v) => setField('termSeason', v || '')} options={SEASON_OPTIONS} />
          <ValidatedInput label="Term year" value={form.termYear} onChange={(v) => setField('termYear', v)}
            validate={yearError} placeholder="2027" inputMode="numeric" />
          <ValidatedInput label="Legacy term text" value={form.term} onChange={(v) => setField('term', v)}
            hint="Auto-filled from season + year; edit freely for old records." placeholder="Fall 2027" />
          <ValidatedSelect label="Application platform" value={form.platform}
            onChange={(v) => setField('platform', v || '')} options={PLATFORMS} />
          <ValidatedSelect label="Round / deadline type" value={form.round}
            onChange={handleRound} options={ROUNDS} />
          <div className="am-check-stack">
            <Check label="Deferred entry" checked={form.deferredEntry} onChange={(v) => setField('deferredEntry', v)} />
            <Check label="Binding commitment" checked={form.isBinding} onChange={(v) => setField('isBinding', v)}
              hint="Early Decision is binding — you must attend if admitted." />
          </div>
        </div>
        {['ed1', 'ed2'].includes(form.round) && (
          <div className="mps-warning">⚠️ Early Decision is binding: withdraw all other applications if admitted.</div>
        )}
        {form.round === 'uk_oct15' && (
          <div className="mps-warning">🇬🇧 15 October deadline applies to Oxford, Cambridge, medicine, dentistry and veterinary courses.</div>
        )}
      </Card>

      <Card title="Tracking" sub="These legacy columns power StatusBadge, the visibility flow and the Overview stats.">
        <div className="mps-grid">
          <ValidatedSelect label="Status" value={form.status} onChange={(v) => setField('status', v || 'Not Started')} options={STATUS_OPTIONS} />
          <ValidatedSelect label="Decision" value={form.decision} onChange={(v) => setField('decision', v || 'Pending')} options={DECISION_OPTIONS} />
          <ValidatedSelect label="Recommendation" value={form.recommendation} onChange={(v) => setField('recommendation', v || 'Pending')} options={RECOMMENDATION_OPTIONS} />
          <ValidatedSelect label="Visibility" value={form.visibility} onChange={(v) => setField('visibility', v || 'private')}
            options={[{ key: 'private', label: 'Private' }, { key: 'public', label: 'Public (admin approval)' }]} />
          <ValidatedInput label="Legacy deadline (date)" type="date" value={form.deadline}
            onChange={(v) => setField('deadline', v)}
            hint="Kept automatically from the main deadline in the Deadlines tab." />
        </div>
        <Area label="Notes" value={form.notes} onChange={(v) => setField('notes', v)} rows={3} counter
          placeholder="Internal notes about this application" />
      </Card>
    </div>
  )

  const renderPortal = () => (
    <div className="am-stack">
      <Card title="Portal access" sub="Only the URL, login email and applicant ID are stored.">
        <div className="mps-grid">
          <ValidatedInput label="Portal URL" value={form.portalUrl} onChange={(v) => setField('portalUrl', v)}
            validate={urlError} placeholder="https://apply.university.edu" />
          <ValidatedInput label="Login email" value={form.portalEmail} onChange={(v) => setField('portalEmail', v)}
            validate={emailError} placeholder="you@example.com" />
          <ValidatedInput label="Applicant ID / reference" value={form.applicantId}
            onChange={(v) => setField('applicantId', v)} placeholder="e.g. 2027-123456" />
          <div className="am-check-stack">
            <Check label="Portal activated" checked={form.portalActivated} onChange={(v) => setField('portalActivated', v)} />
          </div>
        </div>
        <div className="mps-warning">🔒 Passwords are NEVER stored in AppTrack. Keep them in your own password manager.</div>
      </Card>

      <Card title="Application fee" sub="Fee waivers and payment dates.">
        <div className="mps-grid">
          <ValidatedInput label="Fee amount" type="number" value={form.feeAmount}
            onChange={(v) => setField('feeAmount', v)} validate={moneyError} placeholder="75" inputMode="decimal" />
          <ValidatedSelect label="Currency" value={form.feeCurrency}
            onChange={(v) => setField('feeCurrency', v || '')} options={CURRENCY_OPTIONS} />
          <ValidatedInput label="Fee paid on" type="date" value={form.feePaidOn}
            onChange={(v) => setField('feePaidOn', v)} />
          <div className="am-check-stack">
            <Check label="Fee waiver requested" checked={form.feeWaiverRequested} onChange={(v) => setField('feeWaiverRequested', v)} />
            <Check label="Fee waiver granted" checked={form.feeWaiverGranted} onChange={(v) => setField('feeWaiverGranted', v)} />
          </div>
        </div>
      </Card>
    </div>
  )

  const renderFit = () => (
    <div className="am-stack">
      <Card title="Fit assessment" sub="Reach / target / likely, with the reasoning behind it.">
        <div className="mps-grid">
          <ValidatedSelect label="Fit" value={form.fit} onChange={(v) => setField('fit', v || '')} options={FIT_OPTIONS} />
          <ValidatedInput label="Published acceptance rate (%)" type="number" value={form.acceptanceRate}
            onChange={(v) => setField('acceptanceRate', v)} validate={rateError} placeholder="12" inputMode="decimal" />
        </div>
        <Area label="Why this fit?" value={form.fitReason} onChange={(v) => setField('fitReason', v)} counter
          placeholder="Grades, test scores, cohort profile, admit rate for internationals…" />
      </Card>
      <Card title="Why this university?" sub="Structured research notes — useful for essays and interviews.">
        <div className="mps-grid">
          <Area label="Courses" value={form.whyCourses} onChange={(v) => setField('whyCourses', v)} counter />
          <Area label="Professors / faculty" value={form.whyProfessors} onChange={(v) => setField('whyProfessors', v)} counter />
          <Area label="Programmes / labs" value={form.whyPrograms} onChange={(v) => setField('whyPrograms', v)} counter />
          <Area label="Useful links" value={form.whyLinks} onChange={(v) => setField('whyLinks', v)} counter
            placeholder="One URL per line" />
        </div>
      </Card>
    </div>
  )

  const renderPrograms = () => (
    <Card title="Ranked programme choices" sub={choiceRule.rule}
      actions={<span className="am-count">{choices.length}/{choiceRule.limit}</span>}>
      {choices.length === 0 && <p className="mps-empty">No programme choices yet. Rank them in the exact order the portal expects.</p>}
      <SortableList items={choices} onReorder={(next) => { setChoices(next); persist('choices', next) }}
        renderItem={(item, i) => (
          <div className="am-row-grid am-row-grid--choice">
            <input aria-label="Programme name" value={item.programName} placeholder="Programme name *"
              onChange={(e) => editRow('choices', i, { programName: e.target.value })}
              onBlur={() => persist('choices', choices)} />
            <input aria-label="Programme code" value={item.programCode} placeholder="Code"
              onChange={(e) => editRow('choices', i, { programCode: e.target.value })}
              onBlur={() => persist('choices', choices)} />
            <input aria-label="Major" value={item.major} placeholder="Major"
              onChange={(e) => editRow('choices', i, { major: e.target.value })}
              onBlur={() => persist('choices', choices)} />
            <input aria-label="Minor" value={item.minor} placeholder="Minor"
              onChange={(e) => editRow('choices', i, { minor: e.target.value })}
              onBlur={() => persist('choices', choices)} />
            <button type="button" className="mps-icon-btn mps-icon-btn--danger" aria-label="Delete choice"
              onClick={() => removeRow('choices', i, item.programName)}>🗑</button>
          </div>
        )} />
      <div className="am-list-foot">
        <button type="button" className="mps-add-btn" disabled={choices.length >= choiceRule.limit}
          onClick={() => addRow('choices', { id: newApplicationRowId(), programName: '', programCode: '', major: '', minor: '' })}>
          ＋ Add programme
        </button>
        <ListFooter state={listState.choices} onSave={() => persist('choices', choices)} />
      </div>
    </Card>
  )

  const renderDeadlines = () => (
    <Card title="Deadlines in the ORIGINAL time zone"
      sub="Enter the date/time printed by the university. AppTrack shows both the original and your local time."
      actions={<span className="am-count">{deadlines.length}</span>}>
      <div className="mps-warning">🇭🇰 HK 12:00 → 🇦🇿 Baku 08:00 · 🇺🇸 New York 23:59 → 🇦🇿 Baku 08:59 <b>the next day</b>. Never convert deadlines by hand.</div>
      {deadlines.length === 0 && <p className="mps-empty">No deadlines yet — add the application, supplements, documents and aid dates.</p>}
      <div className="am-stack am-stack--tight">
        {deadlines.map((row, i) => (
          <div key={row.id} className="am-row-card">
            <div className="am-row-grid am-row-grid--deadline">
              <select aria-label="Deadline kind" value={row.kind}
                onChange={(e) => editRow('deadlines', i, { kind: e.target.value }, true)}>
                {DEADLINE_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
              </select>
              <input aria-label="Label" value={row.label} placeholder="Label (optional)"
                onChange={(e) => editRow('deadlines', i, { label: e.target.value })}
                onBlur={() => persist('deadlines', deadlines)} />
              <input type="date" aria-label="Original date" value={row.date}
                onChange={(e) => editRow('deadlines', i, { date: e.target.value })}
                onBlur={() => persist('deadlines', deadlines)} />
              <input type="time" aria-label="Original time" value={row.time}
                onChange={(e) => editRow('deadlines', i, { time: e.target.value })}
                onBlur={() => persist('deadlines', deadlines)} />
              <input list="am-tz-list" aria-label="Original time zone" value={row.originalTimezone}
                onChange={(e) => editRow('deadlines', i, { originalTimezone: e.target.value })}
                onBlur={() => persist('deadlines', deadlines)} />
              <button type="button" className="mps-icon-btn mps-icon-btn--danger" aria-label="Delete deadline"
                onClick={() => removeRow('deadlines', i, row.label || labelOf(DEADLINE_KINDS, row.kind))}>🗑</button>
            </div>
            <DeadlineSummary row={row} studentTz={studentTz} />
          </div>
        ))}
      </div>
      <div className="am-list-foot">
        <button type="button" className="mps-add-btn" onClick={() => addRow('deadlines', {
          id: newApplicationRowId(), kind: 'application', label: '', date: '', time: '23:59',
          originalTimezone: defaultTimeZoneForCountry(form.country),
        })}>＋ Add deadline</button>
        <ListFooter state={listState.deadlines} onSave={() => persist('deadlines', deadlines)} />
      </div>
      <p className="am-hint">The main “Application” deadline keeps the legacy date column in sync for older views and the admin dashboard.</p>
    </Card>
  )

  const renderChecklist = () => {
    const linkedEssayOptions = essayLinks.map((l) => ({
      key: l.essayId,
      label: essayOptions.find((e) => e.id === l.essayId)?.title || 'Linked essay',
    }))
    return (
      <div className="am-stack">
        <Card title="Requirements checklist"
          sub="Generated from level + platform + country, then fully editable. Progress is cached on the application."
          actions={<span className="am-count">{progress}% complete</span>}>
          <div className="new-progress-bar"><div className="new-progress-bar__fill new-progress-bar__fill--sky" style={{ width: `${progress}%` }} /></div>
          <div className="am-list-foot">
            <button type="button" className="mps-btn mps-btn--ghost"
              onClick={() => setConfirm({
                title: 'Regenerate the checklist?',
                message: 'Generated items are refreshed from the current level, platform and country. Your statuses and custom items are kept.',
                onConfirm: generate,
              })}>♻️ {requirements.length ? 'Regenerate' : 'Generate'} checklist</button>
            <button type="button" className="mps-btn mps-btn--ghost" onClick={syncEssayStatuses}
              disabled={!requirements.some((r) => r.meta?.essayId)}>🔄 Sync essay statuses</button>
            <button type="button" className="mps-add-btn" onClick={() => addRow('requirements', {
              id: newApplicationRowId(), reqKey: `custom_${newApplicationRowId().slice(0, 8)}`,
              label: 'New requirement', status: 'not_started',
              meta: { generated: false }, sortOrder: requirements.length,
            })}>＋ Add item</button>
            <ListFooter state={listState.requirements} onSave={() => persist('requirements', requirements)} />
          </div>
          {requirements.length === 0 && <p className="mps-empty">No checklist yet. Click “Generate checklist” to start.</p>}
          <div className="am-stack am-stack--tight">
            {requirements.map((r, i) => (
              <div key={r.id} className="am-row-card">
                <div className="am-row-grid am-row-grid--req">
                  <input aria-label="Requirement label" value={r.label}
                    onChange={(e) => editRow('requirements', i, { label: e.target.value })}
                    onBlur={() => persist('requirements', requirements)} />
                  <select aria-label="Requirement status" value={r.status}
                    onChange={(e) => editRow('requirements', i, { status: e.target.value }, true)}>
                    {REQUIREMENT_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  <button type="button" className="mps-icon-btn mps-icon-btn--danger" aria-label="Delete requirement"
                    onClick={() => removeRow('requirements', i, r.label)}>🗑</button>
                </div>
                <div className="am-req-meta">
                  <span className={`am-status am-status--${r.status}`}>{statusLabel(r.status)}</span>
                  {r.meta?.note && <span>📎 {r.meta.note}</span>}
                  {r.meta?.essayType && (
                    <label className="am-inline-select">
                      ✍️ Essay:
                      <select value={r.meta?.essayId || ''} onChange={(e) =>
                        editRow('requirements', i, { meta: { ...r.meta, essayId: e.target.value || null } }, true)}>
                        <option value="">Not linked</option>
                        {linkedEssayOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                      </select>
                    </label>
                  )}
                  {!r.meta?.generated && <span className="am-tag">Custom</span>}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Linked essays" sub="Phase 2 essays attached to this university, with its AI-assistance rules."
          actions={<span className="am-count">{essayLinks.length}</span>}>
          {essayLinks.length === 0 && <p className="mps-empty">No essays linked. Link an essay to mark its checklist item complete.</p>}
          <div className="am-stack am-stack--tight">
            {essayLinks.map((l, i) => {
              const essay = essayOptions.find((e) => e.id === l.essayId)
              return (
                <div key={l.id} className="am-row-card">
                  <div className="am-row-grid am-row-grid--essay">
                    <select aria-label="Essay" value={l.essayId}
                      onChange={(e) => editRow('links', i, { essayId: e.target.value }, true)}>
                      {essayOptions.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
                    </select>
                    <span className={`am-status am-status--${essay?.status || 'draft'}`}>{essay?.status || 'unknown'}</span>
                    <button type="button" className="mps-icon-btn mps-icon-btn--danger" aria-label="Unlink essay"
                      onClick={() => removeRow('links', i, essay?.title)}>🗑</button>
                  </div>
                  <input aria-label="AI rules note" value={l.aiRulesNote}
                    placeholder="AI-assistance policy for this university (e.g. no generative AI for supplements)"
                    onChange={(e) => editRow('links', i, { aiRulesNote: e.target.value })}
                    onBlur={() => persist('links', essayLinks)} />
                </div>
              )
            })}
          </div>
          <div className="am-list-foot">
            <select aria-label="Essay to link" className="am-link-select" value=""
              onChange={(e) => { if (e.target.value) addRow('links', { id: newApplicationRowId(), essayId: e.target.value, aiRulesNote: '' }) }}>
              <option value="">＋ Link an essay…</option>
              {essayOptions.filter((e) => !essayLinks.some((l) => l.essayId === e.id))
                .map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
            <ListFooter state={listState.links} onSave={() => persist('links', essayLinks)} />
          </div>
          {essayOptions.length === 0 && <p className="am-hint">Create essays in the Essays tab first; they will appear here automatically.</p>}
        </Card>
      </div>
    )
  }

  const renderInterviews = () => (
    <Card title="Interviews" sub="Repeatable, timezone-aware. Prep notes and thank-you tracking included."
      actions={<span className="am-count">{interviews.length}</span>}>
      {interviews.length === 0 && <p className="mps-empty">No interviews scheduled.</p>}
      <div className="am-stack am-stack--tight">
        {interviews.map((row, i) => (
          <div key={row.id} className="am-row-card">
            <div className="am-row-grid am-row-grid--deadline">
              <input type="date" aria-label="Interview date" value={row.date}
                onChange={(e) => editRow('interviews', i, { date: e.target.value })}
                onBlur={() => persist('interviews', interviews)} />
              <input type="time" aria-label="Interview time" value={row.time}
                onChange={(e) => editRow('interviews', i, { time: e.target.value })}
                onBlur={() => persist('interviews', interviews)} />
              <input list="am-tz-list" aria-label="Original time zone" value={row.originalTimezone}
                onChange={(e) => editRow('interviews', i, { originalTimezone: e.target.value })}
                onBlur={() => persist('interviews', interviews)} />
              <select aria-label="Interview type" value={row.interviewType}
                onChange={(e) => editRow('interviews', i, { interviewType: e.target.value }, true)}>
                <option value="">Type…</option>
                {INTERVIEW_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              <input aria-label="Interviewer" value={row.interviewer} placeholder="Interviewer"
                onChange={(e) => editRow('interviews', i, { interviewer: e.target.value })}
                onBlur={() => persist('interviews', interviews)} />
              <button type="button" className="mps-icon-btn mps-icon-btn--danger" aria-label="Delete interview"
                onClick={() => removeRow('interviews', i, row.interviewer || 'Interview')}>🗑</button>
            </div>
            {row.date && row.time && <DeadlineSummary row={{ date: row.date, time: row.time, originalTimezone: row.originalTimezone }} studentTz={studentTz} />}
            <div className="mps-grid">
              <Area label="Prep notes" value={row.prepNotes} rows={2} counter
                onChange={(v) => { editRow('interviews', i, { prepNotes: v }) }} />
              <ValidatedInput label="Thank-you sent on" type="date" value={row.thankYouSentOn}
                onChange={(v) => editRow('interviews', i, { thankYouSentOn: v }, true)} />
            </div>
          </div>
        ))}
      </div>
      <div className="am-list-foot">
        <button type="button" className="mps-add-btn" onClick={() => addRow('interviews', {
          id: newApplicationRowId(), date: '', time: '10:00',
          originalTimezone: defaultTimeZoneForCountry(form.country),
          interviewType: '', interviewer: '', prepNotes: '', thankYouSentOn: '',
        })}>＋ Add interview</button>
        <ListFooter state={listState.interviews} onSave={() => persist('interviews', interviews)} />
      </div>
    </Card>
  )

  const renderDecision = () => {
    const replyRow = { date: form.replyDeadlineDate, time: form.replyDeadlineTime, originalTimezone: form.replyDeadlineTz || 'UTC' }
    return (
      <div className="am-stack">
        <Card title="Decision" sub="Offer conditions, reply deadline and commitment.">
          <div className="mps-grid">
            <ValidatedSelect label="Decision" value={form.decision} onChange={(v) => setField('decision', v || 'Pending')} options={DECISION_OPTIONS} />
            <ValidatedInput label="Decision received on" type="date" value={form.decisionAtDate}
              onChange={(v) => setField('decisionAtDate', v)} />
            <ValidatedInput label="Committed on" type="date" value={form.committedAtDate}
              onChange={(v) => setField('committedAtDate', v)} />
            <ValidatedSelect label="Aid policy" value={form.aidPolicy}
              onChange={(v) => setField('aidPolicy', v || '')} options={AID_POLICIES} />
          </div>
          <Area label="Conditions" value={form.decisionConditions} counter
            onChange={(v) => setField('decisionConditions', v)}
            placeholder="e.g. IELTS 7.0 overall, A*AA, final transcript by 31 July" />
          <div className="mps-grid">
            <ValidatedInput label="Reply deadline (original date)" type="date"
              value={form.replyDeadlineDate} onChange={(v) => setField('replyDeadlineDate', v)} />
            <ValidatedInput label="Reply deadline (original time)" type="time"
              value={form.replyDeadlineTime} onChange={(v) => setField('replyDeadlineTime', v)} />
            <ZoneField label="Reply deadline time zone" value={form.replyDeadlineTz}
              onChange={(v) => setField('replyDeadlineTz', v)} />
          </div>
          {form.replyDeadlineDate && form.replyDeadlineTime && <DeadlineSummary row={replyRow} studentTz={studentTz} />}
          <p className="am-hint">The decision-letter attachment moves to the Documents library in Phase 5.</p>
        </Card>

        <Card title="Aid result" sub="Scholarship / aid awarded and the real net cost.">
          <div className="mps-grid">
            <ValidatedInput label="Scholarship / award name" value={form.aidScholarshipName}
              onChange={(v) => setField('aidScholarshipName', v)} />
            <ValidatedInput label="Amount" type="number" value={form.aidAmount}
              onChange={(v) => setField('aidAmount', v)} validate={moneyError} inputMode="decimal" />
            <ValidatedSelect label="Currency" value={form.aidCurrency}
              onChange={(v) => setField('aidCurrency', v || '')} options={CURRENCY_OPTIONS} />
            <ValidatedSelect label="Period" value={form.aidPeriod}
              onChange={(v) => setField('aidPeriod', v || '')} options={AID_PERIODS} />
            <ValidatedInput label="Net cost per year" type="number" value={form.netCostPerYear}
              onChange={(v) => setField('netCostPerYear', v)} validate={moneyError} inputMode="decimal" />
          </div>
          <Area label="Renewal conditions" value={form.aidRenewalConditions} counter
            onChange={(v) => setField('aidRenewalConditions', v)}
            placeholder="e.g. GPA 3.3+, 30 credits per year, annual application" />
        </Card>
      </div>
    )
  }

  const renderTab = () => {
    if (!appId) return renderBasics()
    switch (tab) {
      case 'portal': return renderPortal()
      case 'fit': return renderFit()
      case 'programs': return renderPrograms()
      case 'deadlines': return renderDeadlines()
      case 'checklist': return renderChecklist()
      case 'interviews': return renderInterviews()
      case 'decision': return renderDecision()
      default: return renderBasics()
    }
  }

  if (!open) return null

  return (
    <div className="am-backdrop" onClick={handleClose} role="presentation">
      <div className="am-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Application details">
        <div className="am-head">
          <div className="am-head__text">
            <p className="modal__eyebrow">University applications</p>
            <h3>{appId ? (form.university || 'Application details') : 'New application'}</h3>
            <p className="am-head__sub">
              {appId
                ? `${labelOf(PLATFORMS, form.platform, 'Platform not set')} · ${form.status} · ${progress}% checklist`
                : 'Create the application first, then add deadlines, choices and the checklist.'}
            </p>
          </div>
          <div className="am-head__actions">
            {appId && <SaveStatus saving={saving} savedAt={savedAt} error={autosaveError} />}
            <button type="button" className="drawer-close" aria-label="Close" onClick={handleClose}>×</button>
          </div>
        </div>

        {appId && (
          <div className="am-tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
                className={`am-tab ${tab === t.key ? 'am-tab--active' : ''}`}
                onClick={() => setTab(t.key)}>{t.label}</button>
            ))}
          </div>
        )}

        <div className="am-body">
          <datalist id="am-tz-list">
            {COMMON_TIME_ZONES.map((z) => <option key={z.key} value={z.key}>{z.label}</option>)}
          </datalist>
          {!loaded && <p className="mps-loading">Loading application…</p>}
          {loadError && <p className="mps-error">{loadError}</p>}
          {actionError && <p className="mps-error">{actionError}</p>}
          {loaded && renderTab()}
        </div>

        <div className="am-foot">
          <div className="am-foot__hint">
            {appId ? 'Changes save automatically · list rows save on blur' : 'University is required'}
          </div>
          <div className="am-foot__actions">
            <button type="button" className="mps-btn mps-btn--ghost" onClick={handleClose}>
              {appId ? 'Done' : 'Cancel'}
            </button>
            {!appId && (
              <button type="button" className="mps-btn" disabled={busy} onClick={handleCreate}>
                {busy ? 'Creating…' : 'Create application'}
              </button>
            )}
            {appId && (
              <button type="button" className="mps-btn" onClick={async () => { await flush(); saveAllLists() }}>
                Save everything
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog open={Boolean(confirm)} title={confirm?.title}
        message={confirm?.message} onCancel={() => setConfirm(null)}
        onConfirm={() => { const fn = confirm?.onConfirm; setConfirm(null); fn?.() }} />
    </div>
  )
}
