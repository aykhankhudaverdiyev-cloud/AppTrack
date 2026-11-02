/**
 * ============================================================================
 * MyProfileSection — the rebuilt "My Profile" tab (spec §3)
 * ============================================================================
 * Structured, level-aware profile editing. Every card autosaves (debounced)
 * with an explicit dirty marker — no save-on-mount. Sensitive data (§3
 * "Personal") writes to profile_private and is ALWAYS private; a locked badge
 * makes that visible. Parents/Guardians use explicit CRUD with delete
 * confirmation (max 2 parents + 1 guardian).
 * ============================================================================
 */
import { useEffect, useMemo, useState } from 'react'
import {
  fetchProfileV2,
  updateProfileFields,
  upsertProfilePrivate,
  saveParent,
  deleteParent,
} from '../../Services/ProfileServiceV2'
import { useAutosave, useUnsavedGuard } from '../../hooks/useAutosave'
import { ValidatedInput, ValidatedSelect } from '../forms/ValidatedInput'
import ConfirmDialog from '../forms/ConfirmDialog'
import './MyProfileSection.css'

const LEVEL_OPTIONS = [
  { key: 'bachelor_first_year', label: 'Bachelor (first-year)' },
  { key: 'transfer', label: 'Transfer' },
  { key: 'master', label: 'Master' },
  { key: 'phd', label: 'PhD' },
  { key: 'exchange', label: 'Exchange / Visiting' },
]

const GENDER_OPTIONS = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'non_binary', label: 'Non-binary' },
  { key: 'self_describe', label: 'Prefer to self-describe' },
  { key: 'not_say', label: 'Prefer not to say' },
]

const PROFICIENCY_OPTIONS = [
  { key: 'native', label: 'Native' },
  { key: 'fluent', label: 'Fluent' },
  { key: 'intermediate', label: 'Intermediate' },
  { key: 'basic', label: 'Basic' },
]

const YES_NO = [
  { key: 'true', label: 'Yes' },
  { key: 'false', label: 'No' },
]

function yn(v) {
  if (v === true || v === 'true') return true
  if (v === false || v === 'false') return false
  return null
}

/** Small status pill fed by useAutosave. */
function SaveStatus({ saving, savedAt, error }) {
  if (saving) return <span className="mps-status mps-status--saving">Saving…</span>
  if (error) return <span className="mps-status mps-status--error">Save failed</span>
  if (savedAt) return <span className="mps-status mps-status--saved">Saved</span>
  return null
}

/** Card shell used by every section. */
function Card({ title, subtitle, badge, status, children }) {
  return (
    <section className="mps-card">
      <header className="mps-card__head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p className="mps-card__sub">{subtitle}</p>}
        </div>
        <div className="mps-card__meta">
          {badge}
          {status}
        </div>
      </header>
      <div className="mps-card__body">{children}</div>
    </section>
  )
}

function toInputDate(v) {
  return v || ''
}

/* ------------------------------------------------------------------ */
/* Names                                                               */
/* ------------------------------------------------------------------ */
function NamesCard({ profile }) {
  const [value, setValue] = useState({
    givenName: profile.given_name || '',
    middleName: profile.middle_name || '',
    familyName: profile.family_name || '',
    preferredName: profile.preferred_name || '',
    passportName: profile.passport_name || '',
    nativeScriptName: profile.native_script_name || '',
  })
  const { saving, savedAt, error, markDirty } = useAutosave(value, (v) =>
    updateProfileFields(profile.id, v)
  )
  const set = (patch) => {
    setValue((v) => ({ ...v, ...patch }))
    markDirty()
  }
  useUnsavedGuard(saving)

  return (
    <Card
      title="Name"
      subtitle="Use your legal name exactly as it appears in official documents."
      status={<SaveStatus saving={saving} savedAt={savedAt} error={error} />}
    >
      <div className="mps-grid">
        <ValidatedInput label="Given name" required value={value.givenName} onChange={(v) => set({ givenName: v })} />
        <ValidatedInput label="Middle name" optional value={value.middleName} onChange={(v) => set({ middleName: v })} />
        <ValidatedInput label="Family name" required value={value.familyName} onChange={(v) => set({ familyName: v })} />
        <ValidatedInput label="Preferred name" optional hint="What you would like to be called" value={value.preferredName} onChange={(v) => set({ preferredName: v })} />
        <ValidatedInput
          label="Name exactly as in passport"
          required
          value={value.passportName}
          onChange={(v) => set({ passportName: v })}
          hint="HKU, NTU and most visa processes require the passport name — a mismatch delays enrolment"
        />
        <ValidatedInput label="Name in native script" optional value={value.nativeScriptName} onChange={(v) => set({ nativeScriptName: v })} />
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Personal (private) — profile_private + gender/pronouns on profiles  */
/* ------------------------------------------------------------------ */
function PersonalCard({ profile, privateRow }) {
  const [priv, setPrivState] = useState({
    dateOfBirth: toInputDate(privateRow?.date_of_birth),
    countryOfBirth: privateRow?.country_of_birth || '',
    citizenships: (privateRow?.citizenships || []).join(', '),
    dualCitizenship: privateRow?.dual_citizenship == null ? '' : String(privateRow.dual_citizenship),
    passportNumber: privateRow?.passport_number || '',
    passportExpiry: toInputDate(privateRow?.passport_expiry),
    permanentAddress: privateRow?.permanent_address || '',
    currentAddress: privateRow?.current_address || '',
  })
  const [identity, setIdentity] = useState({
    gender: profile.gender || '',
    pronouns: profile.pronouns || '',
  })

  const startYear = Number((profile.start_term || '').match(/\d{4}/)?.[0]) || null
  const passportWarning = useMemo(() => {
    if (!priv.passportExpiry || !startYear) return null
    const expiry = new Date(priv.passportExpiry)
    const intended = new Date(`${startYear}-09-01`)
    const twelveMonthsLater = new Date(intended.getTime() + 365 * 86400000)
    if (expiry <= twelveMonthsLater) {
      return `⚠️ Your passport expires within 12 months of your intended start (${startYear}). Many visas require at least 6 months validity — consider renewing.`
    }
    return null
  }, [priv.passportExpiry, startYear])

  const privSave = useAutosave(priv, (v) =>
    upsertProfilePrivate(profile.id, {
      dateOfBirth: v.dateOfBirth || null,
      countryOfBirth: v.countryOfBirth || null,
      citizenships: v.citizenships.split(',').map((s) => s.trim()).filter(Boolean),
      dualCitizenship: yn(v.dualCitizenship),
      passportNumber: v.passportNumber || null,
      passportExpiry: v.passportExpiry || null,
      permanentAddress: v.permanentAddress || null,
      currentAddress: v.currentAddress || null,
    })
  )
  const identitySave = useAutosave(identity, (v) => updateProfileFields(profile.id, v))
  useUnsavedGuard(privSave.saving || identitySave.saving)

  const setPriv = (patch) => {
    setPrivState((v) => ({ ...v, ...patch }))
    privSave.markDirty()
  }

  return (
    <Card
      title="Personal"
      subtitle="Date of birth, passport and addresses."
      badge={<span className="mps-locked" title="This section can never be made public">🔒 Always private</span>}
      status={
        <>
          <SaveStatus {...privSave} />
          <SaveStatus {...identitySave} />
        </>
      }
    >
      <div className="mps-grid">
        <ValidatedInput label="Date of birth" type="date" value={priv.dateOfBirth} onChange={(v) => setPriv({ dateOfBirth: v })} />
        <ValidatedInput label="Country of birth" value={priv.countryOfBirth} onChange={(v) => setPriv({ countryOfBirth: v })} />
        <ValidatedInput
          label="Citizenship(s)"
          value={priv.citizenships}
          onChange={(v) => setPriv({ citizenships: v })}
          hint="Comma-separated if more than one"
        />
        <ValidatedSelect label="Dual citizenship" options={YES_NO} value={priv.dualCitizenship} onChange={(v) => setPriv({ dualCitizenship: v ?? '' })} />
        <ValidatedInput label="Passport number" value={priv.passportNumber} onChange={(v) => setPriv({ passportNumber: v })} />
        <ValidatedInput label="Passport expiry date" type="date" value={priv.passportExpiry} onChange={(v) => setPriv({ passportExpiry: v })} />
      </div>
      {passportWarning && <p className="mps-warning" role="alert">{passportWarning}</p>}
      <div className="mps-grid">
        <ValidatedInput label="Permanent address" value={priv.permanentAddress} onChange={(v) => setPriv({ permanentAddress: v })} />
        <ValidatedInput label="Current address" optional hint="Leave empty if same as permanent" value={priv.currentAddress} onChange={(v) => setPriv({ currentAddress: v })} />
        <ValidatedSelect label="Gender" options={GENDER_OPTIONS} value={identity.gender} onChange={(v) => { setIdentity((s) => ({ ...s, gender: v || '' })); identitySave.markDirty() }} />
        <ValidatedInput label="Pronouns" optional placeholder="e.g. she/her, he/him, they/them" value={identity.pronouns} onChange={(v) => { setIdentity((s) => ({ ...s, pronouns: v })); identitySave.markDirty() }} />
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Background — languages + first-generation + household               */
/* ------------------------------------------------------------------ */
function BackgroundCard({ profile, privateRow }) {
  const [languages, setLanguages] = useState(
    (profile.languages || []).map((l) => ({ name: l.name || '', proficiency: l.proficiency || 'fluent' }))
  )
  const [flags, setFlags] = useState({
    firstGeneration: profile.first_generation == null ? '' : String(profile.first_generation),
  })
  const [household, setHousehold] = useState({
    householdSize: privateRow?.household_size ?? '',
    siblings: privateRow?.siblings ?? '',
  })

  const langSave = useAutosave(languages, (v) =>
    updateProfileFields(profile.id, { languages: v.filter((l) => l.name.trim()) })
  )
  const flagsSave = useAutosave(flags, (v) => updateProfileFields(profile.id, { firstGeneration: yn(v.firstGeneration) }))
  const householdSave = useAutosave(household, (v) =>
    upsertProfilePrivate(profile.id, {
      householdSize: v.householdSize === '' ? null : Number(v.householdSize),
      siblings: v.siblings === '' ? null : Number(v.siblings),
    })
  )
  useUnsavedGuard(langSave.saving || flagsSave.saving || householdSave.saving)

  const setLang = (i, patch) => {
    setLanguages((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
    langSave.markDirty()
  }

  return (
    <Card
      title="Background"
      subtitle="Languages and household context. Universities weigh context — this helps your applications."
      status={
        <>
          <SaveStatus {...langSave} />
          <SaveStatus {...flagsSave} />
          <SaveStatus {...householdSave} />
        </>
      }
    >
      <div className="mps-langs">
        {languages.map((row, i) => (
          <div className="mps-lang-row" key={i}>
            <ValidatedInput label={i === 0 ? 'Language' : ''} value={row.name} onChange={(v) => setLang(i, { name: v })} placeholder="e.g. Azerbaijani" />
            <ValidatedSelect label={i === 0 ? 'Proficiency' : ''} options={PROFICIENCY_OPTIONS} value={row.proficiency} onChange={(v) => setLang(i, { proficiency: v || 'fluent' })} />
            <button type="button" className="mps-icon-btn" aria-label={`Remove language ${row.name || i + 1}`} onClick={() => { setLanguages((rows) => rows.filter((_, idx) => idx !== i)); langSave.markDirty() }}>
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="mps-add-btn" onClick={() => { setLanguages((rows) => [...rows, { name: '', proficiency: 'fluent' }]); langSave.markDirty() }}>
          + Add language
        </button>
      </div>
      <div className="mps-grid mps-grid--3">
        <ValidatedSelect label="First-generation student" options={YES_NO} value={flags.firstGeneration} onChange={(v) => { setFlags({ firstGeneration: v ?? '' }); flagsSave.markDirty() }} hint="Neither parent completed a bachelor's degree" />
        <ValidatedInput label="Household size" type="number" validate={(v) => (v == null || (v >= 1 && v <= 30) ? '' : 'Household size is 1–30')} value={household.householdSize} onChange={(v) => { setHousehold((h) => ({ ...h, householdSize: v })); householdSave.markDirty() }} />
        <ValidatedInput label="Number of siblings" type="number" validate={(v) => (v == null || (v >= 0 && v <= 20) ? '' : 'Siblings: 0–20')} value={household.siblings} onChange={(v) => { setHousehold((h) => ({ ...h, siblings: v })); householdSave.markDirty() }} />
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Parents / Guardians — explicit CRUD                                 */
/* ------------------------------------------------------------------ */
const MAX_PARENTS = { mother: 2, father: 2, guardian: 1 }

function ParentsCard({ profile, parents: initialParents, reload }) {
  const [parents, setParents] = useState(initialParents)
  const [editing, setEditing] = useState(null) // {id?, kind, fullName, ...}
  const [confirmId, setConfirmId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const openAdd = (kind) => setEditing({ id: null, kind, fullName: '', isLiving: true, educationLevel: '', occupation: '', employer: '', email: '' })
  const countOfKind = (kind) => parents.filter((p) => p.kind === kind).length

  const save = async () => {
    if (!editing.fullName.trim()) {
      setError('Name is required')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const saved = await saveParent(profile.id, editing)
      setParents((rows) => (editing.id ? rows.map((r) => (r.id === saved.id ? saved : r)) : [...rows, saved]))
      setEditing(null)
      reload?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await deleteParent(profile.id, confirmId)
      setParents((rows) => rows.filter((r) => r.id !== confirmId))
      setConfirmId(null)
      reload?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const parentKinds = [
    { kind: 'mother', label: 'Mother' },
    { kind: 'father', label: 'Father' },
    { kind: 'guardian', label: 'Guardian' },
  ]

  return (
    <Card
      title="Parents / Guardians"
      subtitle="Up to 2 parents and 1 guardian. Used for aid forms and context — never public."
      badge={<span className="mps-locked">🔒 Always private</span>}
    >
      {parents.length === 0 && !editing && (
        <p className="mps-empty">No parents or guardians added yet.</p>
      )}
      <ul className="mps-parents">
        {parents.map((p) => (
          <li key={p.id} className="mps-parent-row">
            <div className="mps-parent-row__main">
              <strong>{p.full_name}</strong>
              <span className="mps-tag">{p.kind}</span>
              {!p.is_living && <span className="mps-tag mps-tag--muted">in memoriam</span>}
              {p.occupation && <span className="mps-parent-row__meta">{p.occupation}{p.employer ? ` · ${p.employer}` : ''}</span>}
            </div>
            <div className="mps-parent-row__actions">
              <button type="button" className="mps-icon-btn" aria-label={`Edit ${p.full_name}`} onClick={() => setEditing({ id: p.id, kind: p.kind, fullName: p.full_name, isLiving: p.is_living, educationLevel: p.education_level || '', occupation: p.occupation || '', employer: p.employer || '', email: p.email || '' })}>
                ✎
              </button>
              <button type="button" className="mps-icon-btn mps-icon-btn--danger" aria-label={`Delete ${p.full_name}`} onClick={() => setConfirmId(p.id)}>
                🗑
              </button>
            </div>
          </li>
        ))}
      </ul>

      {!editing && (
        <div className="mps-add-row">
          {parentKinds.map(({ kind, label }) => (
            <button key={kind} type="button" className="mps-add-btn" disabled={countOfKind(kind) >= MAX_PARENTS[kind]} onClick={() => openAdd(kind)}>
              + Add {label.toLowerCase()}
            </button>
          ))}
        </div>
      )}

      {editing && (
        <div className="mps-parent-form">
          <div className="mps-grid">
            <ValidatedSelect
              label="Relationship"
              required
              options={parentKinds.map(({ kind, label }) => ({ key: kind, label }))}
              value={editing.kind}
              onChange={(v) => setEditing((e) => ({ ...e, kind: v || e.kind }))}
            />
            <ValidatedInput label="Full name" required value={editing.fullName} onChange={(v) => setEditing((e) => ({ ...e, fullName: v }))} />
            <ValidatedSelect label="Living" options={YES_NO} value={String(editing.isLiving)} onChange={(v) => setEditing((e) => ({ ...e, isLiving: yn(v) !== false }))} />
            <ValidatedInput label="Highest education level" optional placeholder="e.g. Bachelor's" value={editing.educationLevel} onChange={(v) => setEditing((e) => ({ ...e, educationLevel: v }))} />
            <ValidatedInput label="Occupation" optional value={editing.occupation} onChange={(v) => setEditing((e) => ({ ...e, occupation: v }))} />
            <ValidatedInput label="Employer" optional value={editing.employer} onChange={(v) => setEditing((e) => ({ ...e, employer: v }))} />
            <ValidatedInput label="Email" type="email" optional value={editing.email} onChange={(v) => setEditing((e) => ({ ...e, email: v }))} />
          </div>
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="mps-form-actions">
            <button type="button" className="mps-btn mps-btn--ghost" onClick={() => { setEditing(null); setError(null) }}>Cancel</button>
            <button type="button" className="mps-btn" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmId}
        title="Delete this entry?"
        message="This removes the parent/guardian from your profile."
        confirmLabel="Delete"
        onCancel={() => setConfirmId(null)}
        onConfirm={remove}
      />
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Goals                                                               */
/* ------------------------------------------------------------------ */
function GoalsCard({ profile, onLevelChange }) {
  const [value, setValue] = useState({
    applyingLevel: profile.applying_level || '',
    startTerm: profile.start_term || '',
    intendedMajor1: profile.intended_major_1 || '',
    intendedMajor2: profile.intended_major_2 || '',
    willApplyFinancialAid: profile.will_apply_financial_aid == null ? '' : String(profile.will_apply_financial_aid),
    gapYearPlanned: profile.gap_year_planned == null ? '' : String(profile.gap_year_planned),
  })
  const { saving, savedAt, error, markDirty } = useAutosave(value, (v) =>
    updateProfileFields(profile.id, {
      applyingLevel: v.applyingLevel || null,
      startTerm: v.startTerm || null,
      intendedMajor1: v.intendedMajor1 || null,
      intendedMajor2: v.intendedMajor2 || null,
      willApplyFinancialAid: yn(v.willApplyFinancialAid),
      gapYearPlanned: yn(v.gapYearPlanned),
    })
  )
  useUnsavedGuard(saving)

  const set = (patch) => {
    setValue((v) => ({ ...v, ...patch }))
    markDirty()
  }

  return (
    <Card
      title="Goals"
      subtitle="Where you are heading. Drives level-specific checklists across the app."
      status={<SaveStatus saving={saving} savedAt={savedAt} error={error} />}
    >
      <div className="mps-grid">
        <ValidatedSelect
          label="Applying for"
          required
          options={LEVEL_OPTIONS}
          value={value.applyingLevel}
          onChange={(v) => {
            set({ applyingLevel: v || '' })
            onLevelChange?.(v || null)
          }}
        />
        <ValidatedInput label="Intended start term" placeholder="e.g. Fall 2027" value={value.startTerm} onChange={(v) => set({ startTerm: v })} />
        <ValidatedInput label="Intended major 1" placeholder={value.applyingLevel === 'phd' ? 'e.g. Machine Learning' : 'e.g. Computer Science'} value={value.intendedMajor1} onChange={(v) => set({ intendedMajor1: v })} />
        <ValidatedInput label="Intended major 2" optional value={value.intendedMajor2} onChange={(v) => set({ intendedMajor2: v })} />
        <ValidatedSelect label="Will apply for financial aid" options={YES_NO} value={value.willApplyFinancialAid} onChange={(v) => set({ willApplyFinancialAid: v ?? '' })} />
        <ValidatedSelect label="Gap year / deferral planned" options={YES_NO} value={value.gapYearPlanned} onChange={(v) => set({ gapYearPlanned: v ?? '' })} />
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Graduate-only                                                       */
/* ------------------------------------------------------------------ */
function GraduateCard({ profile }) {
  const [value, setValue] = useState({
    gradCurrentDegree: profile.grad_current_degree || '',
    gradDegreeStatus: profile.grad_degree_status || '',
    workExperienceYears: profile.work_experience_years ?? '',
    researchInterests: (profile.research_interests || []).join(', '),
    orcid: profile.orcid || '',
    googleScholar: profile.google_scholar || '',
    linkedin: profile.linkedin || '',
  })
  const { saving, savedAt, error, markDirty } = useAutosave(value, (v) =>
    updateProfileFields(profile.id, {
      gradCurrentDegree: v.gradCurrentDegree || null,
      gradDegreeStatus: v.gradDegreeStatus || null,
      workExperienceYears: v.workExperienceYears === '' ? null : Number(v.workExperienceYears),
      researchInterests: v.researchInterests.split(',').map((s) => s.trim()).filter(Boolean),
      orcid: v.orcid || null,
      googleScholar: v.googleScholar || null,
      linkedin: v.linkedin || null,
    })
  )
  useUnsavedGuard(saving)
  const set = (patch) => {
    setValue((v) => ({ ...v, ...patch }))
    markDirty()
  }

  return (
    <Card
      title="Graduate applicant"
      subtitle="Current degree, experience and research identity."
      status={<SaveStatus saving={saving} savedAt={savedAt} error={error} />}
    >
      <div className="mps-grid">
        <ValidatedInput label="Current degree" placeholder="e.g. BSc Computer Engineering" value={value.gradCurrentDegree} onChange={(v) => set({ gradCurrentDegree: v })} />
        <ValidatedInput label="Degree status" placeholder="e.g. Final year / Graduated 2026" value={value.gradDegreeStatus} onChange={(v) => set({ gradDegreeStatus: v })} />
        <ValidatedInput label="Years of work experience" type="number" validate={(v) => (v == null || (v >= 0 && v <= 50) ? '' : 'Years: 0–50')} value={value.workExperienceYears} onChange={(v) => set({ workExperienceYears: v })} />
        <ValidatedInput label="Research interests" placeholder="Comma-separated, e.g. NLP, computer vision" value={value.researchInterests} onChange={(v) => set({ researchInterests: v })} />
        <ValidatedInput label="ORCID" optional value={value.orcid} onChange={(v) => set({ orcid: v })} />
        <ValidatedInput label="Google Scholar" optional value={value.googleScholar} onChange={(v) => set({ googleScholar: v })} />
        <ValidatedInput label="LinkedIn" optional value={value.linkedin} onChange={(v) => set({ linkedin: v })} />
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Root — loads data, renders level-aware                              */
/* ------------------------------------------------------------------ */
export default function MyProfileSection({ profile, onSaved }) {
  const [loaded, setLoaded] = useState(null) // { profile, private, parents }
  const [level, setLevel] = useState(profile?.applying_level || null)
  const [loadError, setLoadError] = useState(null)
  const profileId = profile?.id

  useEffect(() => {
    if (!profileId) return undefined
    let active = true
    fetchProfileV2(profileId)
      .then((data) => {
        if (!active) return
        setLoaded(data)
        setLevel(data.profile.applying_level || null)
      })
      .catch((e) => {
        if (active) setLoadError(e.message)
      })
    return () => {
      active = false
    }
  }, [profileId])

  const reload = async () => {
    if (!profileId) return
    try {
      const data = await fetchProfileV2(profileId)
      setLoaded(data)
      onSaved?.()
    } catch (e) {
      setLoadError(e.message)
    }
  }

  const current = loaded && loaded.profile?.id === profileId ? loaded : null

  if (!profileId) return null
  if (loadError) {
    return (
      <div className="mps">
        <div className="mps-error">Could not load your profile: {loadError}</div>
      </div>
    )
  }
  if (!current) {
    return (
      <div className="mps">
        <div className="mps-loading">Loading profile…</div>
      </div>
    )
  }

  const isGrad = level === 'master' || level === 'phd'

  return (
    <div className="mps">
      <NamesCard profile={current.profile} />
      <PersonalCard profile={current.profile} privateRow={current.private} />
      <BackgroundCard profile={current.profile} privateRow={current.private} />
      <ParentsCard profile={current.profile} parents={current.parents} reload={reload} />
      <GoalsCard profile={current.profile} onLevelChange={setLevel} />
      {isGrad && <GraduateCard profile={current.profile} />}
    </div>
  )
}
