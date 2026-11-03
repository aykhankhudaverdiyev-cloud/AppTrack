/**
 * ============================================================================
 * EssaysSection — the Essays tab (spec §10)
 * ============================================================================
 * List → editor. The editor autosaves (debounced) with live word/char counters
 * against the portal limit, keeps manual + automatic version snapshots, shows
 * counselor comments (resolvable), and links the essay to applications with a
 * per-university AI-rules note. Essays are ALWAYS private.
 * ============================================================================
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchEssays,
  createEssay,
  updateEssay,
  deleteEssay,
  fetchEssayVersions,
  saveEssayVersion,
  fetchEssayComments,
  setEssayCommentResolved,
  fetchEssayLinks,
  linkEssayToApplication,
  unlinkEssayFromApplication,
  updateEssayLinkNote,
} from '../../Services/ProfileServiceV2'
import { useAutosave, useUnsavedGuard } from '../../hooks/useAutosave'
import { ValidatedInput, ValidatedSelect } from '../forms/ValidatedInput'
import Field from '../forms/Field'
import CharWordCounter from '../forms/CharWordCounter'
import ConfirmDialog from '../forms/ConfirmDialog'
import { countWords } from '../../utils/text'
import '../profile/MyProfileSection.css'
import './EssaysSection.css'

// [value, label, limitType, limitValue, minValue]
const ESSAY_TYPES = [
  ['common_app_personal', 'Common App Personal Essay', 'words', 650, 250],
  ['supplement', 'Supplement', 'words', 250, null],
  ['short_answer', 'Short answer', 'words', 100, null],
  ['uc_piq', 'UC Personal Insight Question', 'words', 350, null],
  ['ucas_personal_statement', 'UCAS Personal Statement', 'characters', 4000, null],
  ['additional_info', 'Additional information', 'words', 650, null],
  ['personal_statement', 'Personal statement', 'words', 650, null],
  ['study_plan', 'Study plan', 'words', 500, null],
  ['autobiography', 'Autobiography', 'words', 500, null],
  ['statement_of_purpose', 'Statement of purpose', 'words', 1000, null],
  ['personal_history_diversity', 'Personal history / diversity', 'words', 500, null],
  ['research_statement', 'Research statement', 'words', 1000, null],
  ['writing_sample', 'Writing sample', 'none', null, null],
  ['scholarship', 'Scholarship essay', 'words', 500, null],
  ['other', 'Other', 'none', null, null],
]
const TYPE_OPTIONS = ESSAY_TYPES.map(([key, label]) => ({ key, label }))
const typeLabel = (key) => ESSAY_TYPES.find((t) => t[0] === key)?.[1] || key

const STATUSES = [
  { key: 'brainstorm', label: 'Brainstorm' },
  { key: 'draft', label: 'Draft' },
  { key: 'counselor_review', label: 'Counselor review' },
  { key: 'revising', label: 'Revising' },
  { key: 'final', label: 'Final' },
  { key: 'submitted', label: 'Submitted' },
]
const statusLabel = (key) => STATUSES.find((s) => s.key === key)?.label || key
// Status changes that automatically snapshot the current text as a version
const SNAPSHOT_STATUSES = ['counselor_review', 'final', 'submitted']

const LIMIT_TYPES = [
  { key: 'words', label: 'Words' },
  { key: 'characters', label: 'Characters' },
  { key: 'none', label: 'No limit' },
]

const fmtDate = (v) => (v ? new Date(v).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '')

function SaveStatus({ saving, savedAt, error }) {
  if (saving) return <span className="mps-status mps-status--saving">Saving…</span>
  if (error) return <span className="mps-status mps-status--error">Save failed</span>
  if (savedAt) return <span className="mps-status mps-status--saved">Saved</span>
  return null
}

function counterProps(limitType, limitValue, minValue) {
  if (limitType === 'words') return { maxWords: limitValue ?? undefined, minWords: minValue ?? undefined }
  if (limitType === 'characters') return { maxChars: limitValue ?? undefined }
  return {}
}

/* ------------------------------------------------------------------ */
/* Editor                                                              */
/* ------------------------------------------------------------------ */
function EssayEditor({ essay, userId, applications, onBack, onChanged }) {
  const [draft, setDraft] = useState({
    title: essay.title || '',
    essayType: essay.essay_type,
    promptText: essay.prompt_text || '',
    limitType: essay.limit_type || 'words',
    limitValue: essay.limit_value ?? '',
    minValue: essay.min_value ?? '',
    status: essay.status,
    content: essay.content || '',
    notes: essay.notes || '',
  })
  const [versions, setVersions] = useState([])
  const [comments, setComments] = useState([])
  const [links, setLinks] = useState([])
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [previewId, setPreviewId] = useState(null)

  const saveFn = useCallback(
    (v) =>
      updateEssay(userId, essay.id, {
        title: v.title.trim() || 'Untitled essay',
        essayType: v.essayType,
        promptText: v.promptText || null,
        limitType: v.limitType,
        limitValue: v.limitType === 'none' || v.limitValue === '' ? null : Number(v.limitValue),
        minValue: v.limitType !== 'words' || v.minValue === '' ? null : Number(v.minValue),
        status: v.status,
        content: v.content,
        notes: v.notes || null,
      }),
    [userId, essay.id]
  )
  const { saving, savedAt, error, markDirty, flush } = useAutosave(draft, saveFn)
  useUnsavedGuard(saving)

  const set = (patch) => {
    setDraft((d) => ({ ...d, ...patch }))
    markDirty()
  }

  const reloadSide = useCallback(async () => {
    try {
      const [v, c, l] = await Promise.all([
        fetchEssayVersions(essay.id),
        fetchEssayComments(essay.id),
        fetchEssayLinks(essay.id),
      ])
      setVersions(v)
      setComments(c)
      setLinks(l)
    } catch (e) {
      console.error(e)
      setLoadError('Could not load versions, comments or linked applications.')
    }
  }, [essay.id])

  useEffect(() => {
    let alive = true
    Promise.all([fetchEssayVersions(essay.id), fetchEssayComments(essay.id), fetchEssayLinks(essay.id)])
      .then(([v, c, l]) => {
        if (!alive) return
        setVersions(v)
        setComments(c)
        setLinks(l)
      })
      .catch((e) => {
        console.error(e)
        if (alive) setLoadError('Could not load versions, comments or linked applications.')
      })
    return () => { alive = false }
  }, [essay.id])

  const words = countWords(draft.content)
  const chars = draft.content.length
  const latest = versions[0]
  const unsnapped = !latest || latest.content !== draft.content

  const snapshot = async (text) => {
    await saveEssayVersion(userId, essay.id, text, countWords(text), text.length)
    await reloadSide()
  }

  const handleSnapshot = async () => {
    setBusy(true)
    try { await snapshot(draft.content) } catch (e) { console.error(e) } finally { setBusy(false) }
  }

  const handleType = (key) => {
    const preset = ESSAY_TYPES.find((t) => t[0] === key)
    if (!preset) return
    set({
      essayType: key,
      limitType: preset[2],
      limitValue: preset[3] ?? '',
      minValue: preset[4] ?? '',
      title: draft.title || preset[1],
    })
  }

  const handleStatus = async (key) => {
    set({ status: key })
    if (SNAPSHOT_STATUSES.includes(key) && unsnapped && draft.content.trim()) {
      try { await snapshot(draft.content) } catch (e) { console.error(e) }
    }
  }

  const handleRestore = async (v) => {
    setBusy(true)
    try {
      if (unsnapped && draft.content.trim()) await snapshot(draft.content) // never lose the current text
      set({ content: v.content })
      setPreviewId(null)
    } catch (e) { console.error(e) } finally { setBusy(false) }
  }

  const handleBack = async () => {
    await flush()
    onChanged()
    onBack()
  }

  const toggleResolved = async (c) => {
    try {
      await setEssayCommentResolved(c.id, !c.resolved)
      setComments((rows) => rows.map((r) => (r.id === c.id ? { ...r, resolved: !c.resolved } : r)))
    } catch (e) { console.error(e) }
  }

  const toggleLink = async (appId) => {
    const existing = links.find((l) => l.application_id === appId)
    try {
      if (existing) await unlinkEssayFromApplication(existing.id)
      else await linkEssayToApplication(userId, essay.id, appId)
      setLinks(await fetchEssayLinks(essay.id))
    } catch (e) { console.error(e) }
  }

  const preview = versions.find((v) => v.id === previewId)
  const openComments = comments.filter((c) => !c.resolved).length

  return (
    <div className="mps essays">
      <div className="essays__bar">
        <button type="button" className="mps-btn mps-btn--ghost" onClick={handleBack}>← All essays</button>
        <SaveStatus saving={saving} savedAt={savedAt} error={error} />
      </div>

      <section className="mps-card">
        <header className="mps-card__head">
          <div>
            <h3>Essay details</h3>
            <p className="mps-card__sub">Pick the essay type to preload the usual portal limit — you can adjust it.</p>
          </div>
          <div className="mps-card__meta"><span className="mps-locked">🔒 Private</span></div>
        </header>
        <div className="mps-card__body">
          <div className="mps-grid">
            <ValidatedInput label="Title" required value={draft.title} onChange={(v) => set({ title: v })} />
            <ValidatedSelect label="Essay type" required value={draft.essayType} onChange={(v) => v && handleType(v)} options={TYPE_OPTIONS} />
            <ValidatedSelect label="Status" required value={draft.status} onChange={(v) => v && handleStatus(v)} options={STATUSES} />
            <ValidatedSelect label="Limit counted in" value={draft.limitType} onChange={(v) => set({ limitType: v || 'none' })} options={LIMIT_TYPES} placeholder="No limit" hint="Portals differ: Common App essays count words, UCAS counts characters" />
            {draft.limitType !== 'none' && (
              <ValidatedInput
                label={draft.limitType === 'words' ? 'Maximum words' : 'Maximum characters'}
                type="number"
                value={draft.limitValue}
                onChange={(v) => set({ limitValue: v })}
                validate={(v) => (v > 0 && v <= 32767 ? '' : 'Enter a number between 1 and 32767')}
              />
            )}
            {draft.limitType === 'words' && (
              <ValidatedInput
                label="Minimum words"
                type="number"
                value={draft.minValue}
                onChange={(v) => set({ minValue: v })}
                validate={(v) => (v >= 0 && (draft.limitValue === '' || v <= draft.limitValue) ? '' : 'Minimum must be 0 or more and not above the maximum')}
              />
            )}
          </div>
          <Field label="Prompt">
            {({ id }) => (
              <textarea id={id} rows={3} value={draft.promptText} onChange={(e) => set({ promptText: e.target.value })} placeholder="Paste the exact prompt from the portal" />
            )}
          </Field>
        </div>
      </section>

      <section className="mps-card">
        <header className="mps-card__head">
          <div>
            <h3>Writing</h3>
            <p className="mps-card__sub">{words} words · {chars} characters</p>
          </div>
          <div className="mps-card__meta">
            <button type="button" className="mps-btn" onClick={handleSnapshot} disabled={busy || !unsnapped || !draft.content.trim()}>
              💾 Save version
            </button>
          </div>
        </header>
        <div className="mps-card__body">
          <textarea
            className="essays__editor"
            aria-label="Essay text"
            rows={18}
            value={draft.content}
            onChange={(e) => set({ content: e.target.value })}
            placeholder="Start writing here — your draft saves automatically."
          />
          <CharWordCounter value={draft.content} {...counterProps(draft.limitType, draft.limitValue === '' ? null : Number(draft.limitValue), draft.minValue === '' ? null : Number(draft.minValue))} />
          <Field label="Private notes">
            {({ id }) => (
              <textarea id={id} rows={2} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Ideas, brainstorm, things to fix (only you and your counselor see this)" />
            )}
          </Field>
        </div>
      </section>

      {loadError && <div className="mps-warning">{loadError}</div>}

      <section className="mps-card">
        <header className="mps-card__head">
          <div>
            <h3>Counselor comments</h3>
            <p className="mps-card__sub">{comments.length ? `${openComments} open · ${comments.length - openComments} resolved` : 'Comments from your counselor will appear here.'}</p>
          </div>
        </header>
        <div className="mps-card__body">
          {comments.length === 0 ? (
            <div className="mps-empty">💬 No comments yet. Set the status to “Counselor review” to ask for feedback.</div>
          ) : (
            <ul className="essays__list">
              {comments.map((c) => (
                <li key={c.id} className={`essays__comment${c.resolved ? ' essays__comment--resolved' : ''}`}>
                  {c.selected_text && <blockquote>“{c.selected_text}”</blockquote>}
                  <p>{c.comment}</p>
                  {c.suggestion && <p className="essays__suggestion">Suggestion: {c.suggestion}</p>}
                  <div className="essays__row">
                    <small>{fmtDate(c.created_at)}</small>
                    <button type="button" className="mps-add-btn" onClick={() => toggleResolved(c)}>
                      {c.resolved ? 'Reopen' : '✓ Mark resolved'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mps-card">
        <header className="mps-card__head">
          <div>
            <h3>Version history</h3>
            <p className="mps-card__sub">A snapshot is saved automatically when you move to Counselor review, Final or Submitted.</p>
          </div>
        </header>
        <div className="mps-card__body">
          {versions.length === 0 ? (
            <div className="mps-empty">🕘 No versions yet. Use “Save version” to keep a snapshot.</div>
          ) : (
            <ul className="essays__list">
              {versions.map((v) => (
                <li key={v.id} className="essays__version">
                  <div className="essays__row">
                    <span><strong>v{v.version}</strong> · {v.word_count ?? 0} words · {v.char_count ?? 0} chars · <small>{fmtDate(v.created_at)}</small></span>
                    <span className="essays__actions">
                      <button type="button" className="mps-add-btn" onClick={() => setPreviewId(previewId === v.id ? null : v.id)}>{previewId === v.id ? 'Hide' : 'View'}</button>
                      <button type="button" className="mps-add-btn" disabled={busy || v.content === draft.content} onClick={() => handleRestore(v)}>Restore</button>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {preview && <pre className="essays__preview">{preview.content || '(empty)'}</pre>}
        </div>
      </section>

      <section className="mps-card">
        <header className="mps-card__head">
          <div>
            <h3>Used in applications</h3>
            <p className="mps-card__sub">One essay can serve several applications. Note each university’s rules on writing assistance (AI, editors).</p>
          </div>
        </header>
        <div className="mps-card__body">
          {applications.length === 0 ? (
            <div className="mps-empty">📄 Add an application first to link this essay.</div>
          ) : (
            <ul className="essays__list">
              {applications.map((a) => {
                const link = links.find((l) => l.application_id === a.id)
                return (
                  <li key={a.id}>
                    <label className="essays__check">
                      <input type="checkbox" checked={!!link} onChange={() => toggleLink(a.id)} />
                      <span>{a.university || 'Untitled application'}</span>
                    </label>
                    {link && (
                      <input
                        className="essays__note"
                        type="text"
                        aria-label={`AI / writing-assistance rules for ${a.university}`}
                        placeholder="AI / writing-assistance rules for this university"
                        defaultValue={link.ai_rules_note || ''}
                        onBlur={(e) => e.target.value !== (link.ai_rules_note || '') && updateEssayLinkNote(link.id, e.target.value).then(() => setLinks((rows) => rows.map((r) => (r.id === link.id ? { ...r, ai_rules_note: e.target.value || null } : r)))).catch(console.error)}
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* List                                                                */
/* ------------------------------------------------------------------ */
export default function EssaysSection({ userId, applications = [] }) {
  const [essays, setEssays] = useState(null)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [filter, setFilter] = useState('all')

  const load = useCallback(async () => {
    try {
      setEssays(await fetchEssays(userId))
      setError('')
    } catch (e) {
      console.error(e)
      setError('Could not load your essays.')
      setEssays([])
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return undefined
    let alive = true
    fetchEssays(userId)
      .then((rows) => alive && setEssays(rows))
      .catch((e) => {
        console.error(e)
        if (alive) { setError('Could not load your essays.'); setEssays([]) }
      })
    return () => { alive = false }
  }, [userId])

  const visible = useMemo(
    () => (essays || []).filter((e) => filter === 'all' || e.status === filter),
    [essays, filter]
  )

  const handleNew = async () => {
    try {
      const preset = ESSAY_TYPES[0]
      const row = await createEssay(userId, {
        title: 'Untitled essay',
        essayType: preset[0],
        limitType: preset[2],
        limitValue: preset[3],
        minValue: preset[4],
      })
      setEssays((rows) => [row, ...(rows || [])])
      setOpenId(row.id)
    } catch (e) {
      console.error(e)
      setError('Could not create the essay.')
    }
  }

  const handleDelete = async () => {
    const id = confirmId
    setConfirmId(null)
    try {
      await deleteEssay(userId, id)
      setEssays((rows) => rows.filter((r) => r.id !== id))
    } catch (e) {
      console.error(e)
      setError('Could not delete the essay.')
    }
  }

  if (essays === null) return <div className="mps-loading">Loading essays…</div>

  const open = essays.find((e) => e.id === openId)
  if (open) {
    return <EssayEditor key={open.id} essay={open} userId={userId} applications={applications} onBack={() => setOpenId(null)} onChanged={load} />
  }

  return (
    <div className="mps essays">
      <section className="mps-card">
        <header className="mps-card__head">
          <div>
            <h3>Essays</h3>
            <p className="mps-card__sub">Draft, version and track every essay. Essays are always private — only you and your counselor can see them.</p>
          </div>
          <div className="mps-card__meta">
            <button type="button" className="mps-btn" onClick={handleNew}>＋ New essay</button>
          </div>
        </header>
        <div className="mps-card__body">
          {error && <div className="mps-warning">{error}</div>}
          <div className="essays__filters">
            {[{ key: 'all', label: 'All' }, ...STATUSES].map((s) => (
              <button key={s.key} type="button" className={`essays__chip${filter === s.key ? ' essays__chip--active' : ''}`} onClick={() => setFilter(s.key)}>
                {s.label}
              </button>
            ))}
          </div>
          {visible.length === 0 ? (
            <div className="mps-empty">✍️ {essays.length === 0 ? 'No essays yet. Start with your personal statement.' : 'No essays with this status.'}</div>
          ) : (
            <ul className="essays__list">
              {visible.map((e) => {
                const w = countWords(e.content)
                const over = e.limit_type === 'words' ? e.limit_value && w > e.limit_value : e.limit_type === 'characters' ? e.limit_value && e.content.length > e.limit_value : false
                return (
                  <li key={e.id} className="essays__item">
                    <button type="button" className="essays__item-main" onClick={() => setOpenId(e.id)}>
                      <strong>{e.title}</strong>
                      <span>
                        {typeLabel(e.essay_type)} · {w} words
                        {e.limit_type !== 'none' && e.limit_value ? ` / ${e.limit_value} ${e.limit_type === 'words' ? 'words' : 'chars'}` : ''}
                        {over ? ' ⚠️ over limit' : ''}
                      </span>
                      <small>Updated {fmtDate(e.updated_at)}</small>
                    </button>
                    <span className={`essays__status essays__status--${e.status}`}>{statusLabel(e.status)}</span>
                    <button type="button" className="mps-icon-btn mps-icon-btn--danger" aria-label={`Delete ${e.title}`} onClick={() => setConfirmId(e.id)}>🗑</button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>
      <ConfirmDialog
        open={!!confirmId}
        title="Delete this essay?"
        message="The essay, all its versions and comments will be permanently deleted."
        onConfirm={handleDelete}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  )
}
