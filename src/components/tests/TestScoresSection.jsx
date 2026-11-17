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
  TEST_GROUPS, TEST_TYPE_LABEL, TEST_PRESETS, testEmoji, testTint,
} from '../../constants/tests.js'
import {
  testSortKey, testMeta, testScoreText,
} from '../../utils/tests.js'
import './TestScoresSection.css'

const STATUS_CLASS = { planned: 'planned', registered: 'registered', taken_waiting: 'waiting', released: 'released' }

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
  const status = attempt.status
  const sections = attempt.sections || []
  const isEnglish = ['IELTS', 'TOEFL', 'DUOLINGO', 'PTE', 'CAMBRIDGE_C1', 'CAMBRIDGE_C2'].includes(attempt.test_type)

  const sectionChips = sections.map((section) => {
    const label = isEnglish && SHORT[section.section] ? `${SHORT[section.section]} ${section.score}` : `${section.section} ${section.score}`
    return <span key={section.section} className="tests-chip">{label}</span>
  })

  return (
    <ListCard
      className={`test-card${selected ? ' test-card--selected' : ''}${isNew ? ' test-card--new' : ''}`}
      tile={<span className={`tests-tile tile--${testTint(attempt.test_type)}`} aria-hidden="true">{testEmoji(attempt.test_type)}</span>}
      title={isNew ? 'New test' : (attempt.national_exam_name || TEST_TYPE_LABEL(attempt.test_type))}
      sub={big === '—' ? null : big}
      meta={testMeta(attempt)}
      chips={sectionChips.length > 0 ? <div className="tests-chip-row">{sectionChips}</div> : null}
      pills={
        <>
          <span className={`status-pill status-pill--${STATUS_CLASS[status] || 'planned'}`}>{status.replace(/_/g, ' ')}</span>
          {attempt.is_best && <span className="status-pill status-pill--best" aria-label="Best result">★ Best</span>}
        </>
      }
      selected={selected} isNew={isNew} onClick={() => onOpen(attempt)}
    >
      <div className="tests-card__foot">
        {grey && <span className="tests-card__grey">{grey}</span>}
        {!isNew && <CardMenu attempt={attempt} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} />}
      </div>
    </ListCard>
  )
}

/* ── section ────────────────────────────────────────────────────────────── */

export default function TestScoresSection({ userId }) {
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

  const openRow = useCallback((row) => { setAdding(false); setParams({ type: row.test_type, id: row.id }) }, [setParams])

  const closePanel = useCallback(() => { setAdding(false); setParams({ id: null }) }, [setParams])

  const startAdd = useCallback(() => {
    setAdding(true)
    setParams({ type: filter === 'all' ? 'SAT' : filter, id: null })
  }, [filter, setParams])


  const handleCreate = useCallback(async (draft) => {
    const sameType = items.filter((i) => i.test_type === draft.test_type && i.national_exam_name === draft.national_exam_name)
    const attemptNumber = sameType.length ? Math.max(...sameType.map((i) => Number(i.attempt_number || 1))) + 1 : 1
    let overall = draft.overall_score
    let overallMax = draft.overall_max
    const preset = TEST_PRESETS[draft.test_type] || TEST_PRESETS.OTHER
    if (preset.overall === 'sum-auto') {
      const nums = draft.sections.map((s) => Number(s.score)).filter((n) => Number.isFinite(n))
      if (nums.length === draft.sections.length && draft.sections.length > 0) {
        overall = nums.reduce((a, b) => a + b, 0)
        overallMax = preset.overallMax
      }
    }
    let isBest = Boolean(draft.is_best)
    if (draft.status === 'released' && !items.some((i) => i.test_type === draft.test_type && i.national_exam_name === draft.national_exam_name && i.is_best)) {
      isBest = true
    }
    const row = await actions.create({ ...draft, attempt_number: attemptNumber, overall_score: overall, overall_max: overallMax, is_best: isBest })
    await actions.saveSections(row.id, draft.sections)
    setAdding(false)
    setParams({ type: row.test_type, id: row.id })
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
  }, [actions, items, setParams, showToast, hideToast])

  const handleSave = useCallback(async (draft, sections) => {
    if (!selected) return
    await actions.update(selected.id, draft)
    await actions.saveSections(selected.id, sections)
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
        action={{ label: 'Add test', onClick: startAdd }}
        chips={<FilterChips items={chips} total={items.length} value={filter} onChange={(value) => setParams({ type: value, id: null })} />}
        counter={items.length > 0 ? items.length + ' tests' : null}
      >
      <div className="tests-columns">
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
              <TestCard attempt={{ test_type: filter === 'all' ? 'SAT' : filter }} isNew selected onClick={() => {}} />
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
            defaultTestType={filter === 'all' ? 'SAT' : filter}
            onSave={adding ? undefined : handleSave}
            onCreate={adding ? handleCreate : undefined}
            onClose={closePanel}
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
