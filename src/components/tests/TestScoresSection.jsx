/** ============================================================================
 * TestScoresSection — Test Scores page (spec §4)
 * ============================================================================
 * Cards sorted by status then date. No drag. The filter and the open test
 * live in the URL (?type=…&id=…).
 * ============================================================================ */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTests } from '../../hooks/useTests'
import { useUndoToast } from '../../hooks/useUndoToast'
import SectionPage from '../section/SectionPage'
import FilterChips from '../section/FilterChips'
import ListCard from '../section/ListCard'
import TestPanel from './TestPanel'
import { ConfirmDialog } from '../forms'
import {
  TEST_GROUPS, TEST_STATUSES, TEST_TYPE_LABEL, testEmoji, testTint,
} from '../../constants/tests.js'
import {
  testSortKey, testMeta, testScoreText, scoreDraft, draftFromRow,
} from '../../utils/tests.js'
import './TestScoresSection.css'

const STATUS_CLASS = { planned: 'planned', registered: 'registered', taken_waiting: 'waiting', released: 'released' }

// The URL filter only ever holds a *group* key (admission/english/other),
// never a real test_type — map it to one representative type to default a
// new draft to (the header's own type dropdown lets the user change it).
const GROUP_DEFAULT_TYPE = { admission: 'SAT', english: 'IELTS', other: 'OTHER' }

const SHORT = { Listening: 'L', Reading: 'R', Writing: 'W', Speaking: 'S' }

/* ── card menu ──────────────────────────────────────────────────────────── */

function CardMenu({ attempt, onEdit, onDuplicate, onDelete }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (event) => { if (!wrap.current?.contains(event.target)) setOpen(false) }
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (action) => (event) => {
    event.stopPropagation()
    setOpen(false)
    action()
  }

  return (
    <div className="tests-menu" ref={wrap} onClick={(event) => event.stopPropagation()}>
      <button type="button" className="tests-menu__btn" aria-haspopup="menu" aria-expanded={open}
        aria-label={`Actions for ${TEST_TYPE_LABEL(attempt.test_type)}`} onClick={() => setOpen((v) => !v)}>
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <div className="tests-menu__list" role="menu">
          <button type="button" role="menuitem" onClick={pick(onEdit)}>Edit</button>
          <button type="button" role="menuitem" onClick={pick(onDuplicate)}>Duplicate</button>
          <button type="button" role="menuitem" className="tests-menu__danger" onClick={pick(onDelete)}>Delete</button>
        </div>
      )}
    </div>
  )
}

/* ── card ───────────────────────────────────────────────────────────────── */

function TestCard({ attempt, selected, isNew, onOpen, onEdit, onDuplicate, onDelete }) {
  const { big, grey } = testScoreText(attempt)
  const status = attempt.status || 'planned'
  const sections = attempt.sections || []
  const isEnglish = ['IELTS', 'TOEFL', 'DUOLINGO', 'PTE', 'CAMBRIDGE_C1', 'CAMBRIDGE_C2'].includes(attempt.test_type)

  const sectionChips = sections.filter((section) => section.score != null && section.score !== '').map((section) => {
    const label = isEnglish && SHORT[section.section] ? `${SHORT[section.section]} ${section.score}` : `${section.section} ${section.score}`
    return <span key={section.id || section.section} className="tests-chip">{label}</span>
  })

  return (
    <ListCard
      className={`test-card${selected ? ' test-card--selected' : ''}${isNew ? ' test-card--new' : ''}`}
      tile={<span className={`tests-tile tile--${testTint(attempt.test_type)}`} aria-hidden="true">{testEmoji(attempt.test_type)}</span>}
      title={isNew ? 'New test' : (attempt.national_exam_name || TEST_TYPE_LABEL(attempt.test_type))}
      sub={big === '—' ? null : big}
      meta={isNew ? 'Not saved yet' : testMeta(attempt)}
      chips={sectionChips.length > 0 ? <div className="tests-chip-row">{sectionChips}</div> : null}
      pills={!isNew && (
        <>
          <span className={`status-pill status-pill--${STATUS_CLASS[status] || 'planned'}`}>{TEST_STATUSES.find((option) => option.key === status)?.label || status}</span>
          {attempt.is_best && <span className="status-pill status-pill--best" aria-label="Best result">★ Best</span>}
        </>
      )}
      foot={isNew ? <span className="status-pill">Draft</span> : grey && <span className="tests-card__grey">{grey}</span>}
      menu={!isNew && <CardMenu attempt={attempt} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} />}
      selected={selected} isNew={isNew} onClick={isNew ? undefined : () => onOpen(attempt)}
    />
  )
}

/* ── section ────────────────────────────────────────────────────────────── */

export default function TestScoresSection({ userId, onOpenApplications }) {
  const actions = useTests(userId)
  const { items, loading, error } = actions
  const { toast, showToast, hideToast } = useUndoToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const toastTimer = useRef(null)

  const typeParam = searchParams.get('type') || 'all'
  const filter = TEST_GROUPS.some((g) => g.key === typeParam) ? typeParam : 'all'
  const selectedId = searchParams.get('id')
  const selected = useMemo(() => items.find((item) => item.id === selectedId) || null, [items, selectedId])
  const sorted = useMemo(() => [...items].sort((a, b) => testSortKey(a).localeCompare(testSortKey(b))), [items])

  const typeCounts = useMemo(() => {
    const counts = { all: items.length, admission: 0, english: 0, other: 0 }
    for (const item of items) {
      if (['IELTS', 'TOEFL', 'DUOLINGO', 'PTE', 'CAMBRIDGE_C1', 'CAMBRIDGE_C2'].includes(item.test_type)) counts.english++
      else if (['SAT', 'ACT', 'PSAT', 'AP', 'IB', 'ALEVEL', 'GRE', 'GMAT', 'NATIONAL_EXAM'].includes(item.test_type)) counts.admission++
      else counts.other++
    }
    return counts
  }, [items])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const setParams = useCallback((patch) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const [key, value] of Object.entries(patch)) {
        if (!value || value === 'all') next.delete(key)
        else next.set(key, value)
      }
      return next
    }, { replace: true })
  }, [setSearchParams])

  const openRow = useCallback((row) => { setAdding(false); setParams({ id: row.id }) }, [setParams])

  const closePanel = useCallback(() => { setAdding(false); setParams({ id: null }) }, [setParams])

  const startAdd = useCallback(() => {
    // Keep the URL's group filter untouched — it only ever holds a group key
    // (admission/english/other), never a single test type, and the new
    // draft's default type is derived locally from `filter` below.
    setAdding(true)
    setParams({ id: null })
  }, [setParams])


  const handleCreate = useCallback(async (draft) => {
    const row = await actions.create(scoreDraft(draft, draft.sections))
    try {
      if (draft.status === 'released' && draft.sections.length) await actions.saveSections(row.id, draft.sections)
      if (draft.is_best && draft.status === 'released') await actions.setBest(row.id, true)
    } catch (cause) {
      // Don't leave an orphaned, section-less attempt behind on a partial
      // failure — roll back the row we just created and surface the error.
      await actions.remove(row.id).catch((rollbackCause) => {
        console.error('Failed to roll back a partially saved test attempt:', rollbackCause)
      })
      throw cause
    }
    setAdding(false)
    setParams({ id: row.id })
    showToast(`${TEST_TYPE_LABEL(row.test_type)} added`, {
      label: 'Undo',
      run: async () => {
        try {
          await actions.remove(row.id)
          setParams({ id: null })
          hideToast()
        } catch (cause) {
          showToast(cause?.message || 'Could not undo that.')
        }
      },
    })
  }, [actions, setParams, showToast, hideToast])

  const handleSave = useCallback(async (draft, sections) => {
    if (!selected) return
    await actions.update(selected.id, scoreDraft(draft, sections))
    if (draft.status === 'released' && JSON.stringify(sections) !== JSON.stringify(draftFromRow(selected, selected.sections).sections)) {
      await actions.saveSections(selected.id, sections)
    }
    if (Boolean(selected.is_best) !== draft.is_best) await actions.setBest(selected.id, draft.is_best)
  }, [actions, selected])

  const handleDelete = useCallback(async (attempt) => {
    try {
      await actions.remove(attempt.id)
      setParams({ id: null })
      showToast(`${TEST_TYPE_LABEL(attempt.test_type)} deleted`, {
        label: 'Undo',
        run: async () => {
          try {
            await actions.restore(attempt)
            showToast('Restored')
          } catch (cause) {
            showToast(cause?.message || 'Could not restore that test.')
          }
        },
      })
    } catch (cause) {
      showToast(cause?.message || 'Could not delete that test.')
    }
  }, [actions, setParams, showToast])

  const handleDuplicate = useCallback(async (attempt) => {
    try {
      const copy = await actions.duplicate(attempt.id)
      showToast(`${TEST_TYPE_LABEL(copy.test_type)} created`, { label: 'Edit', run: () => openRow(copy) })
    } catch (cause) {
      showToast(cause?.message || 'Could not duplicate that test.')
    }
  }, [actions, openRow, showToast])

  const filtered = filter === 'all' ? sorted : sorted.filter((item) => {
    const groups = { admission: ['SAT', 'ACT', 'PSAT', 'AP', 'IB', 'ALEVEL', 'GRE', 'GMAT', 'NATIONAL_EXAM'], english: ['IELTS', 'TOEFL', 'DUOLINGO', 'PTE', 'CAMBRIDGE_C1', 'CAMBRIDGE_C2'], other: ['OTHER'] }
    return groups[filter].includes(item.test_type)
  })

  const chips = TEST_GROUPS.map((group) => ({
    key: group.key, label: group.label, count: typeCounts[group.key] || 0,
  })).filter((group) => group.count > 0 || filter === group.key)

  const panelOpen = adding || Boolean(selected)

  return (
    <>
      <SectionPage
        title="Test Scores"
        subtitle="Every exam in one place. Mark your best result for each test."
        action={{ label: 'Add test', onClick: startAdd, disabled: adding || loading || Boolean(error) }}
        chips={<FilterChips items={chips} total={items.length} value={filter} onChange={(value) => setParams({ type: value, id: null })} />}
        counter={items.length > 0 ? items.length + ' tests' : null}
      >
      <div className={`tests-columns${panelOpen ? ' tests-columns--panel' : ''}`}>
        <div className="tests-main">
          {error ? (
            <div className="tests-state tests-state--error">
              <p>Couldn&apos;t load your test scores</p>
              <button type="button" className="tests-btn tests-btn--retry" onClick={actions.retry}>Retry</button>
            </div>
          ) : loading ? (
            <div className="tests-skeleton" aria-hidden="true">
              {[0, 1, 2].map((key) => <div key={key} className="tests-skeleton__card" />)}
            </div>
          ) : adding ? (
            <div className="tests-cards">
              <TestCard attempt={{ test_type: GROUP_DEFAULT_TYPE[filter] || 'SAT' }} isNew selected />
            </div>
          ) : items.length === 0 ? (
            <div className="tests-empty">
              <div className="tests-empty__tiles" aria-hidden="true">
                <span className="tests-tile tile--butter">📝</span>
                <span className="tests-tile tile--sky">🗣️</span>
                <span className="tests-tile tile--lilac">📚</span>
              </div>
              <p>Add your first test. Planned tests count too, so you never miss a registration.</p>
              <button type="button" className="tests-btn tests-btn--primary" onClick={startAdd}>
                <span aria-hidden="true">＋</span> Add test
              </button>
            </div>
          ) : (
            <div className="tests-cards">
              {filtered.map((attempt) => (
                <TestCard
                  key={attempt.id} attempt={attempt} selected={attempt.id === selectedId}
                  onOpen={openRow} onEdit={() => openRow(attempt)}
                  onDuplicate={() => handleDuplicate(attempt)} onDelete={() => setDeleting(attempt)}
                />
              ))}
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <button type="button" className="tests-add-link" onClick={startAdd} disabled={adding}>
              <span aria-hidden="true">＋</span> Add test
            </button>
          )}
          {!loading && !error && items.length > 0 && (
            <p className="tests-footnote">Changes are saved automatically.</p>
          )}
        </div>

        {panelOpen && (
          <TestPanel
            key={adding ? 'new' : selected?.id}
            mode={adding ? 'create' : 'edit'}
            row={adding ? undefined : selected}
            userId={userId}
            defaultTestType={GROUP_DEFAULT_TYPE[filter] || 'SAT'}
            onSave={adding ? undefined : handleSave}
            onCreate={adding ? handleCreate : undefined}
            onClose={closePanel}
            onOpenApplications={onOpenApplications}
          />
        )}
      </div>
    </SectionPage>

    <>
      {deleting && (
        <ConfirmDialog
          open={Boolean(deleting)}
          title={`Delete ${deleting?.national_exam_name || TEST_TYPE_LABEL(deleting.test_type)}?`}
          message="This cannot be undone."
          confirmLabel="Delete"
          onCancel={() => setDeleting(null)}
          onConfirm={() => { const attempt = deleting; setDeleting(null); if (attempt) handleDelete(attempt) }}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          <span>{toast.message}</span>
          {toast.action && (
            <button type="button" onClick={() => { hideToast(); toast.action.run() }}>
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </>
    </>
  )
}
