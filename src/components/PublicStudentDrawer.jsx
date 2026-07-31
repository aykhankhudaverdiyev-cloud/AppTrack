import { useState } from 'react'
import Avatar from './Avatar'
import './Avatar.css'
import DocumentGroup from './DocumentGroup'

function VisibilityChip({ value }) {
  return (
    <span className={`vis-chip ${value === 'public' ? 'vis-chip--public' : 'vis-chip--private'}`}>
      {value === 'public' ? 'Public' : 'Private'}
    </span>
  )
}

function StatusBadge({ children, variant = 'slate' }) {
  return <span className={`status-badge status-badge--${variant}`}>{children}</span>
}

function statusVariant(status) {
  const s = (status || '').toLowerCase()
  if (s.includes('accept') || s.includes('submit') || s.includes('receiv')) return 'green'
  if (s.includes('review') || s.includes('progress')) return 'orange'
  if (s.includes('reject') || s.includes('close')) return 'red'
  if (s.includes('pending') || s.includes('not started')) return 'slate'
  return 'purple'
}

const DOC_CATEGORIES = [
  { key: 'application', label: 'Applications', hint: 'Submitted application forms', emoji: '🗂️', color: '#6d28d9', tint: 'rgba(124,58,237,0.12)' },
  { key: 'transcript', label: 'Transcripts', hint: 'Official & unofficial transcripts', emoji: '📊', color: '#0e7490', tint: 'rgba(6,182,212,0.14)' },
  { key: 'recommendation', label: 'Recommendation Letters', hint: 'Letters from recommenders', emoji: '✉️', color: '#b45309', tint: 'rgba(249,115,22,0.14)' },
  { key: 'other', label: 'Other Required PDFs', hint: 'Essays, CV, financials, etc.', emoji: '', color: '#15803d', tint: 'rgba(34,197,94,0.14)' },
]

export default function PublicStudentDrawer({
  student,
  activeTab = 'profile',
  setActiveTab,
  onClose,
  expandedApplications = [],
  onToggleApplicationExpanded,
  licenses,
  readOnly = false,
}) {
  const [activePdf, setActivePdf] = useState(null)
  if (!student) return null

  const safeSetTab = setActiveTab || (() => {})
  const safeExpanded = expandedApplications || []
  const safeLicenses = licenses || student.licenses || []

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose}></div>

      <aside className="admin-drawer">
        <div className="admin-drawer__header">
          <div>
            <p className="admin-drawer__eyebrow">
              {readOnly ? 'Public student profile' : 'Private admin access'}
            </p>
            <h2>{student.fullName}</h2>
            <span className="admin-drawer__subtext">{student.major}</span>
          </div>

          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>

        <div className="admin-drawer__hero-block">
          <div className="student-photo-card">
            <div className="student-photo-preview">
              <Avatar
                name={student.fullName}
                photoUrl={student.photoUrl}
                size="xl"
                className="student-photo-avatar"
              />
            </div>
          </div>

          <div className="admin-drawer__hero-main">
            <div className="admin-drawer__hero--compact">
              <div className="hero-stat">
                <span>Email</span>
                <strong>{student.email || 'Private'}</strong>
              </div>
              <div className="hero-stat">
                <span>Phone</span>
                <strong>{student.phone || 'Private'}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="drawer-tabs">
          {['profile', 'applications', 'licenses'].map((tab) => (
            <button
              key={tab}
              className={`drawer-tab ${activeTab === tab ? 'drawer-tab--active' : ''}`}
              onClick={() => safeSetTab(tab)}
            >
              {tab === 'profile' && 'Profile'}
              {tab === 'applications' && 'Applications'}
              {tab === 'licenses' && 'Licenses & Certifications'}
            </button>
          ))}
        </div>

        <div className="admin-drawer__content">
          {activeTab === 'profile' && (
            <div className="drawer-panel">
              <div className="section-head section-head--stack">
                <div>
                  <h3>Student Profile</h3>
                  <p className="section-head__sub">
                    Public information shared by this student.
                  </p>
                </div>
              </div>

              <div className="info-grid">
                <div className="info-card">
                  <span>Full Name</span>
                  <strong>{student.fullName}</strong>
                </div>
                <div className="info-card">
                  <span>Major</span>
                  <strong>{student.major}</strong>
                </div>
                <div className="info-card">
                  <span>University</span>
                  <strong>{student.university}</strong>
                </div>
                <div className="info-card">
                  <span>Gender</span>
                  <strong>{student.gender}</strong>
                </div>
                <div className="info-card">
                  <span>Email</span>
                  <strong>{student.email || 'Private'}</strong>
                </div>
                <div className="info-card">
                  <span>Phone</span>
                  <strong>{student.phone || 'Private'}</strong>
                </div>
              </div>

              <div className="notes-block">
                <div className="section-head">
                  <h3>Notes</h3>
                </div>

                <div className="notes-box">
                  <textarea value={student.notes || ''} readOnly rows={8}></textarea>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'applications' && (
            <div className="drawer-panel">
              <div className="section-head section-head--stack">
                <div>
                  <h3>University Applications</h3>
                  <p className="section-head__sub">
                    Public applications and documents shared by this student.
                  </p>
                </div>
              </div>

              <div className="application-list">
                {(student.applications || []).map((application) => {
                  const expanded = safeExpanded.includes(application.id)

                  return (
                    <div
                      key={application.id}
                      className={`application-card ${expanded ? 'application-card--open' : ''}`}
                    >
                      <button
                        type="button"
                        className="application-card__top"
                        onClick={() => onToggleApplicationExpanded?.(application.id)}
                      >
                        <div className="application-card__id">
                          <div className="application-card__logo">
                            {application.university?.[0] || 'U'}
                          </div>

                          <div className="application-card__id-text">
                            <h4>{application.university}</h4>
                            <p>{application.program || application.major}</p>
                          </div>
                        </div>

                        <div className="application-card__top-meta">
                          <VisibilityChip value={application.visibility} />
                          <StatusBadge variant={statusVariant(application.status)}>
                            {application.status}
                          </StatusBadge>
                          <span className="chevron">{expanded ? '▾' : '▸'}</span>
                        </div>
                      </button>

                      {expanded && (
                        <div className="application-card__expand">
                          <div className="info-grid">
                            <div className="info-card">
                              <span>Program</span>
                              <strong>{application.program}</strong>
                            </div>
                            <div className="info-card">
                              <span>Major</span>
                              <strong>{application.major}</strong>
                            </div>
                            <div className="info-card">
                              <span>Term</span>
                              <strong>{application.term}</strong>
                            </div>
                            <div className="info-card">
                              <span>Decision</span>
                              <strong>{application.decision}</strong>
                            </div>
                          </div>

                          <div className="docs-grid">
                            {DOC_CATEGORIES.map((category) => (
                              <DocumentGroup
                                studentId={student.id}
                                application={application}
                                category={category}
                                readOnly={true}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                {!student.applications?.length && (
                  <div className="empty-state empty-state--cert">
                    <div className="empty-state__icon">🎓</div>
                    <h4>No public applications yet</h4>
                    <p>This student has not shared any applications publicly.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'licenses' && (
            <div className="drawer-panel">
              <div className="section-head section-head--stack">
                <div>
                  <h3>Licenses & Certifications</h3>
                  <p className="section-head__sub">
                    Public credentials shared by this student.
                  </p>
                </div>
              </div>

              <div className="cert-list">
                {safeLicenses.map((license) => (
                  <div key={license.id} className="cert-item">
                    <div className="cert-item__head">
                      <div>
                        <h4>{license.name}</h4>
                        <p>{license.issuer}</p>
                      </div>
                      <VisibilityChip value={license.visibility} />
                    </div>

                    <div className="cert-item__body">
                      {license.score && <p className="cert-item__score">Score: {license.score}</p>}
                      {license.credentialId && (
                        <p className="cert-item__cred">Credential ID {license.credentialId}</p>
                      )}

                      <div className="cert-item__foot">
                        {license.credentialUrl && (
                          <a
                            className="pill-link"
                            href={license.credentialUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Show credential →
                          </a>
                        )}
                        {(license.media || []).map((m) => (
                          <span key={m.id} className="pill-link pill-link--file">
                            {m.url ? (
                              <a href={m.url} target="_blank" rel="noreferrer">
                                📄 {m.name}
                              </a>
                            ) : (
                              <>📄 {m.name}</>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                {!safeLicenses.length && (
                  <div className="empty-state empty-state--cert">
                    <div className="empty-state__icon">🎓</div>
                    <h4>No public licenses or certifications yet</h4>
                    <p>This student has not shared any credentials publicly.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}