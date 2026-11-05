/**
 * ============================================================================
 * AdmissionsOverview — Phase 3, Overview widgets (spec §2 / §11)
 * ----------------------------------------------------------------------------
 * Phase 1 leftovers that need real application data:
 *   • next-deadline card (original zone + student's local zone + countdown)
 *   • application pipeline (counts by status + checklist progress)
 *   • upcoming deadlines (top 5, day-shift warnings for US/Asia conversions)
 * Uses the owner's application_deadlines rows; legacy date-only applications
 * are still listed with a "add a time zone" hint so nothing disappears.
 * ============================================================================
 */
import { useMemo } from 'react'
import { describeStoredDeadline, getStudentTimeZone } from '../../utils/timezone'
import { DEADLINE_KINDS, labelOf } from '../../utils/applicationRequirements'
import '../profile/MyProfileSection.css'

const PIPELINE_GROUPS = [
  { key: 'not_started', label: 'Not started', color: '#94a3b8', match: (a) => a.status === 'Not Started' },
  { key: 'in_progress', label: 'In progress', color: '#0ea5e9', match: (a) => a.status === 'In Progress' },
  { key: 'submitted', label: 'Submitted / in review', color: '#10b981', match: (a) => ['Submitted', 'In Review', 'Closed'].includes(a.status) },
  { key: 'decision', label: 'Decision received', color: '#7c3aed', match: (a) => ['Accepted', 'Rejected', 'Deferred', 'Waitlisted'].includes(a.status) },
]

function DeadlineDetail({ row, studentTz, now, compact = false }) {
  const d = describeStoredDeadline(row, studentTz, now)
  if (!d) return <p className="ao-muted">Time zone not recognised — edit this deadline.</p>
  return (
    <div className={compact ? 'ao-dl ao-dl--compact' : 'ao-dl'}>
      <span>🏫 <b>{d.originalText}</b></span>
      <span>📍 {d.localText} <em>(your time)</em></span>
      <span className={d.isUrgent ? 'ao-urgent' : ''}>⏳ {d.countdownText}</span>
      {d.dayShift !== 0 && (
        <span className="mps-warning">⚠️ {d.dayShift > 0 ? 'Next day' : 'Previous day'} in your time zone — submit by the ORIGINAL time.</span>
      )}
    </div>
  )
}

export default function AdmissionsOverview({
  applications = [], deadlines = [], onOpenApplications, onOpenApplication,
  profileTimeZone, now,
}) {
  const studentTz = useMemo(() => getStudentTimeZone(profileTimeZone), [profileTimeZone])
  const byApp = useMemo(
    () => new Map(applications.map((a) => [a.id, a])),
    [applications]
  )

  const future = useMemo(() => deadlines
    .filter((d) => new Date(d.due_at).getTime() >= now.getTime() - 60_000)
    .sort((a, b) => new Date(a.due_at) - new Date(b.due_at)), [deadlines, now])

  const legacyDates = useMemo(() => applications
    .filter((a) => a.deadline && !deadlines.some((d) => d.application_id === a.id))
    .map((a) => ({ app: a, deadline: a.deadline })), [applications, deadlines])

  const pipeline = useMemo(() => PIPELINE_GROUPS.map((g) => ({
    ...g, count: applications.filter(g.match).length,
  })), [applications])

  const avgProgress = useMemo(() => {
    if (!applications.length) return 0
    return Math.round(applications.reduce((s, a) => s + (Number(a.progressPercent) || 0), 0) / applications.length)
  }, [applications])

  const next = future[0]
  const nextApp = next ? byApp.get(next.application_id) : null
  const total = applications.length || 1

  return (
    <div className="mps-card ao-card">
      <div className="mps-card__head">
        <div>
          <h3>🎓 Admissions pulse</h3>
          <p className="mps-card__sub">Next deadline, pipeline and everything coming up — in your time zone.</p>
        </div>
        <div className="mps-card__meta">
          <button type="button" className="mps-btn mps-btn--ghost" onClick={onOpenApplications}>
            View applications →
          </button>
        </div>
      </div>

      <div className="ao-grid">
        {/* ── Next deadline ── */}
        <section className="ao-panel ao-panel--next">
          <p className="ao-panel__label">NEXT DEADLINE</p>
          {next ? (
            <>
              <h4>{nextApp?.university || 'Application'}</h4>
              <p className="ao-kind">{labelOf(DEADLINE_KINDS, next.kind)}{next.label ? ` · ${next.label}` : ''}</p>
              <DeadlineDetail row={next} studentTz={studentTz} now={now} />
              <button type="button" className="ao-link" onClick={() => onOpenApplication?.(next.application_id)}>
                Open this application →
              </button>
            </>
          ) : (
            <>
              <h4>Nothing due 🎉</h4>
              <p className="ao-muted">
                {legacyDates.length
                  ? `${legacyDates.length} legacy date-only deadline${legacyDates.length === 1 ? '' : 's'} below — add a time zone for exact local times.`
                  : 'Add deadlines to an application to see the countdown here.'}
              </p>
              <button type="button" className="ao-link" onClick={onOpenApplications}>Go to applications →</button>
            </>
          )}
        </section>

        {/* ── Pipeline ── */}
        <section className="ao-panel">
          <p className="ao-panel__label">APPLICATION PIPELINE</p>
          <div className="ao-pipeline">
            {pipeline.map((g) => (
              <div key={g.key} className="ao-pipeline__row">
                <div className="ao-pipeline__top">
                  <span>{g.label}</span><b>{g.count}</b>
                </div>
                <div className="ao-bar">
                  <div className="ao-bar__fill" style={{ width: `${(g.count / total) * 100}%`, background: g.color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="ao-progress">
            <div className="ao-pipeline__top"><span>Checklist progress</span><b>{avgProgress}%</b></div>
            <div className="ao-bar">
              <div className="ao-bar__fill" style={{ width: `${avgProgress}%`, background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }} />
            </div>
            <p className="ao-muted">Average across {applications.length} application{applications.length === 1 ? '' : 's'}.</p>
          </div>
        </section>

        {/* ── Upcoming deadlines ── */}
        <section className="ao-panel">
          <p className="ao-panel__label">UPCOMING DEADLINES</p>
          {future.length === 0 && legacyDates.length === 0 && (
            <p className="ao-muted">No deadlines yet. Add them from the Deadlines tab of an application.</p>
          )}
          <ul className="ao-list">
            {future.slice(0, 5).map((row) => {
              const app = byApp.get(row.application_id)
              const d = describeStoredDeadline(row, studentTz, now)
              return (
                <li key={row.id} className="ao-list__item">
                  <button type="button" onClick={() => onOpenApplication?.(row.application_id)}>
                    <span className="ao-list__title">{app?.university || 'Application'} · {labelOf(DEADLINE_KINDS, row.kind)}</span>
                    <span className="ao-list__time">{d?.localText || '—'}{d?.dayShift ? ' ⚠️' : ''}</span>
                    <span className={d?.isUrgent ? 'ao-urgent' : 'ao-muted'}>{d?.countdownText || ''}</span>
                  </button>
                </li>
              )
            })}
            {legacyDates.slice(0, 3).map(({ app, deadline }) => (
              <li key={`legacy-${app.id}`} className="ao-list__item">
                <button type="button" onClick={() => onOpenApplication?.(app.id)}>
                  <span className="ao-list__title">{app.university} · legacy date</span>
                  <span className="ao-list__time">📅 {deadline}</span>
                  <span className="ao-muted">Date only — add a time zone</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
