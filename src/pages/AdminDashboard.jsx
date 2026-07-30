import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './AdminDashboard.css'
import Avatar from '../components/Avatar'
import '../components/Avatar.css'
import { useAuth } from '../context/AuthContext'
import PublicStudentDrawer from '../components/PublicStudentDrawer'
import {
  useStudents,
  setProfile,
  setPhoto,
  removePhoto,
  setVisibility,
  updateNotes,
  saveApplication,
  deleteApplication,
  setApplicationVisibility,
  uploadApplicationFile,
  removeApplicationFile,
  saveLicense,
  deleteLicense,
  setLicenseVisibility,
  uploadLicenseMediaFile,
  deleteLicenseMediaFile,
  fileToDataUrl,
  deleteStudent,
  notifyDataChanged,
} from '../store/studentsStore'

// Tiny localStorage helpers for the admin-only notification inbox / preferences.
function loadPersisted(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw)
  } catch {
    // storage unavailable — use fallback
  }
  return fallback
}

function savePersisted(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage full / blocked — ignore
  }
}

const PIE_COLORS = ['#7c3aed', '#06b6d4', '#22c55e', '#f97316', '#ef4444', '#8b5cf6', '#14b8a6']

// Document categories shown inside every application
const DOC_CATEGORIES = [
  { key: 'application', label: 'Applications', hint: 'Submitted application forms', emoji: '🗂️', color: '#6d28d9', tint: 'rgba(124,58,237,0.12)' },
  { key: 'transcript', label: 'Transcripts', hint: 'Official & unofficial transcripts', emoji: '📊', color: '#0e7490', tint: 'rgba(6,182,212,0.14)' },
  { key: 'recommendation', label: 'Recommendation Letters', hint: 'Letters from recommenders', emoji: '✉️', color: '#b45309', tint: 'rgba(249,115,22,0.14)' },
  { key: 'other', label: 'Other Required PDFs', hint: 'Essays, CV, financials, etc.', emoji: '', color: '#15803d', tint: 'rgba(34,197,94,0.14)' },
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const YEARS = Array.from({ length: 16 }, (_, i) => String(2030 - i))
const GENDERS = ['Female', 'Male', 'Other']
const APP_STATUS = ['Not Started', 'In Progress', 'Submitted', 'In Review', 'Closed']
const APP_DECISION = ['Pending', 'Accepted', 'Rejected', 'Waitlisted']
const APP_RECOMMENDATION = ['Pending', 'Requested', 'Received']

// Configurable notification types — admin chooses which alerts to receive.
const NOTIFICATION_TYPES = [
  { key: 'visibility_request', label: 'Visibility requests', hint: 'When a student asks to make a field public or private', emoji: '👁️' },
  { key: 'deadline', label: 'Approaching deadlines', hint: 'When an application deadline is near', emoji: '⏰' },
  { key: 'recommendation_declined', label: 'Declined recommendations', hint: 'When a recommender declines a request', emoji: '✉️' },
  { key: 'other', label: 'Other important issues', hint: 'Exceptions and system alerts', emoji: '⚠️' },
]

// Dummy inbox — shape matches the student side's visibility requests so both dashboards
// can share one Supabase `notifications` table.
const INITIAL_NOTIFICATIONS = [
  { id: 'n2', type: 'visibility_request', status: 'pending', studentId: 3, studentName: 'Carla Nunez', field: 'profile', current: 'private', requested: 'public', message: 'Carla Nunez requested to make Profile public.' },
  { id: 'n3', type: 'deadline', status: 'unread', studentName: 'Alice Zhang', message: 'MIT application deadline is in 5 days (2026-12-21).' },
  { id: 'n4', type: 'recommendation_declined', status: 'unread', studentName: 'Bob Smith', message: 'A recommender declined the recommendation request.' },
  { id: 'n5', type: 'other', status: 'read', studentName: 'System', message: 'Monthly export completed successfully.' },
]

function emptyLicense() {
  return {
    name: '', issuer: '', issueMonth: '', issueYear: '', expireMonth: '', expireYear: '',
    credentialId: '', credentialUrl: '', score: '', visibility: 'private', media: [],
  }
}

function emptyApplication() {
  return {
    university: '', program: '', major: '', term: '', deadline: '',
    status: 'Not Started', decision: 'Pending', recommendation: 'Pending',
    notes: '', visibility: 'private', documents: {},
  }
}

function getDocs(application, key) {
  const docs = application.documents
  if (!docs || Array.isArray(docs)) return []
  return docs[key] || []
}

function formatSize(bytes) {
  if (!bytes) return 'PDF file'
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

function statusVariant(status) {
  const s = (status || '').toLowerCase()
  if (s.includes('accept') || s.includes('submit') || s.includes('receiv')) return 'green'
  if (s.includes('review') || s.includes('progress')) return 'orange'
  if (s.includes('reject') || s.includes('close')) return 'red'
  if (s.includes('pending') || s.includes('not started')) return 'slate'
  return 'purple'
}

function toPercentMap(countsObj) {
  const entries = Object.entries(countsObj)
  const total = entries.reduce((sum, [, value]) => sum + value, 0)

  return entries.map(([label, value], index) => ({
    label,
    value,
    percent: total ? Math.round((value / total) * 100) : 0,
    color: PIE_COLORS[index % PIE_COLORS.length],
  }))
}

function buildCounts(list, key) {
  return list.reduce((acc, item) => {
    const value = item[key]
    acc[value] = (acc[value] || 0) + 1
    return acc
  }, {})
}

function VisibilityToggle({ value, onChange }) {
  const isPublic = value === 'public'
  return (
    <button
      type="button"
      className={`vis-toggle ${isPublic ? 'vis-toggle--public' : 'vis-toggle--private'}`}
      onClick={() => onChange(isPublic ? 'private' : 'public')}
      title={isPublic ? 'Public — visible to other students' : 'Private — admins only'}
    >
      <span className="vis-toggle__icon">{isPublic ? '🌐' : '🔒'}</span>
      {isPublic ? 'Public' : 'Private'}
    </button>
  )
}

function VisibilityChip({ value }) {
  const isPublic = value === 'public'
  return (
    <span className={`vis-chip ${isPublic ? 'vis-chip--public' : 'vis-chip--private'}`}>
      {isPublic ? '🌐 Public' : '🔒 Private'}
    </span>
  )
}

function PieChartCard({ title, data }) {
  const gradient = data.length
    ? `conic-gradient(${data
        .map((item, index) => {
          const previous = data
            .slice(0, index)
            .reduce((sum, current) => sum + current.percent, 0)
          const currentEnd = previous + item.percent
          return `${item.color} ${previous}% ${currentEnd}%`
        })
        .join(', ')})`
    : '#e5e7eb'

  return (
    <div className="stat-card">
      <div className="stat-card__header">
        <h3>{title}</h3>
      </div>

      <div className="chart-card__content">
        <div className="pie-wrap">
          <div className="pie-chart" style={{ background: gradient }}>
            <div className="pie-chart__center"></div>

            {data.map((item, index) => {
              const previous = data
                .slice(0, index)
                .reduce((sum, current) => sum + current.percent, 0)
              const mid = previous + item.percent / 2
              const angle = (mid / 100) * 360 - 90
              const radius = 92
              const x = Math.cos((angle * Math.PI) / 180) * radius
              const y = Math.sin((angle * Math.PI) / 180) * radius
              return (
                <span
                  key={item.label}
                  className="pie-chart__label"
                  style={{
                    left: `calc(50% + ${x}px)`,
                    top: `calc(50% + ${y}px)`,
                  }}
                >
                  {item.percent}%
                </span>
              )
            })}
          </div>
        </div>

        <div className="chart-legend">
          {data.map((item) => (
            <div key={item.label} className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: item.color }}></span>
              <span className="legend-text">
                {item.label} <strong>{item.percent}%</strong>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TotalStudentsCard({ total }) {
  return (
    <div className="total-card">
      <span className="total-card__label">Total Students</span>
      <span className="total-card__value">{total}</span>
    </div>
  )
}

function StudentCard({ student, onOpen }) {
  const publicCount =
    (student.visibility?.profile === 'public' ? 1 : 0) +
    (student.applications || []).filter((a) => a.visibility === 'public').length +
    (student.licenses || []).filter((l) => l.visibility === 'public').length

  const profilePublic = student.visibility?.profile === 'public'

  return (
    <button className="student-card" onClick={() => onOpen(student)}>
      <div className="student-card__media">
        <Avatar
          name={student.fullName}
          photoUrl={student.photoUrl}
          size="lg"
          className="student-card__avatar-el"
        />
        <span className={`vis-chip ${profilePublic ? 'vis-chip--public' : 'vis-chip--private'} student-card__vis`}>
          {profilePublic ? '🌐 Public' : '🔒 Private'}
        </span>
        {publicCount > 0 && (
          <span className="student-card__public-tag">🌐 {publicCount} public</span>
        )}
      </div>

      <div className="student-card__body">
        <h4>{student.fullName}</h4>
        <p>{student.major}</p>
      </div>
    </button>
  )
}

function Pagination({ currentPage, totalPages, setCurrentPage }) {
  const pages = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages]
    }

    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    }

    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages]
  }, [currentPage, totalPages])

  return (
    <div className="pagination">
      <button
        className="page-btn"
        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
        disabled={currentPage === 1}
      >
        Previous
      </button>

      {pages.map((page, index) =>
        page === '...' ? (
          <span key={`ellipsis-${index}`} className="page-ellipsis">
            ...
          </span>
        ) : (
          <button
            key={page}
            className={`page-btn ${currentPage === page ? 'page-btn--active' : ''}`}
            onClick={() => setCurrentPage(page)}
          >
            {page}
          </button>
        )
      )}

      <button
        className="page-btn"
        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
        disabled={currentPage === totalPages}
      >
        Next
      </button>
    </div>
  )
}

function StatusBadge({ children, variant = 'default' }) {
  return <span className={`status-badge status-badge--${variant}`}>{children}</span>
}

function DocumentGroup({ student, application, category, onUpload, onRemove, onOpenInline }) {
  const docs = getDocs(application, category.key)
  const inputId = `doc-${student.id}-${application.id}-${category.key}`

  return (
    <section className="doc-group">
      <header className="doc-group__head">
        <div className="doc-group__title">
          <span className="doc-group__icon" style={{ background: category.tint, color: category.color }}>
            {category.emoji}
          </span>
          <div className="doc-group__label">
            <h5>{category.label}</h5>
            <p>{category.hint}</p>
          </div>
        </div>
        <span className="doc-group__count">{docs.length}</span>
      </header>

      <div className="doc-group__body">
        {docs.map((doc) => (
          <div key={doc.id} className="doc-chip">
            <span className="doc-chip__file">📄</span>

            <div className="doc-chip__info">
              <strong title={doc.name}>{doc.name}</strong>
              <span>{formatSize(doc.size)}</span>
            </div>

            <div className="doc-chip__actions">
              {doc.url && (
                <>
                  <button
                    type="button"
                    className="mini-btn"
                    onClick={() => onOpenInline(doc)}
                  >
                    View
                  </button>

                  <a
                    className="mini-btn"
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open tab
                  </a>
                </>
              )}

              <button
                type="button"
                className="mini-btn mini-btn--danger"
                onClick={() => onRemove(student.id, application.id, category.key, doc.id)}
              >
                Remove
              </button>
            </div>
          </div>
        ))}

        <label htmlFor={inputId} className="doc-drop">
          <span className="doc-drop__plus">+</span>
          <span className="doc-drop__text">
            Upload PDF
            <small>Click to browse — PDF only</small>
          </span>
        </label>

        <input
          id={inputId}
          type="file"
          accept="application/pdf"
          className="file-input-hidden"
          onChange={(e) => {
            onUpload(student.id, application.id, category.key, e.target.files?.[0] || null)
            e.target.value = ''
          }}
        />
      </div>
    </section>
  )
}

function ProfileModal({ open, student, onClose, onSave }) {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', major: '', university: '', gender: '' })

  useEffect(() => {
    if (open && student) {
      setForm({
        fullName: student.fullName || '',
        email: student.email || '',
        phone: student.phone || '',
        major: student.major || '',
        university: student.university || '',
        gender: student.gender || '',
      })
    }
  }, [open, student])

  if (!open || !student) return null

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  function submit(event) {
    event.preventDefault()
    if (!form.fullName.trim()) return
    onSave(student.id, form)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <p className="modal__eyebrow">Student profile</p>
            <h3>Edit profile</h3>
          </div>
          <button type="button" className="drawer-close" onClick={onClose}>✕</button>
        </div>

        <form className="modal__form" onSubmit={submit}>
          <label className="field">
            <span>Full name *</span>
            <input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} required />
          </label>

          <div className="field-row">
            <label className="field">
              <span>Email</span>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </label>
            <label className="field">
              <span>Phone</span>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span>Major</span>
              <input value={form.major} onChange={(e) => set('major', e.target.value)} />
            </label>
            <label className="field">
              <span>University</span>
              <input value={form.university} onChange={(e) => set('university', e.target.value)} />
            </label>
          </div>

          <label className="field">
            <span>Gender</span>
            <select value={form.gender} onChange={(e) => set('gender', e.target.value)}>
              <option value="">Select</option>
              {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>

          <div className="modal__foot">
            <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="solid-btn">Save changes</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ApplicationModal({ open, studentId, application, onClose, onSave }) {
  const [form, setForm] = useState(emptyApplication())

  useEffect(() => {
    if (open) {
      setForm(application ? { ...emptyApplication(), ...application } : emptyApplication())
    }
  }, [open, application])

  if (!open) return null

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  function submit(event) {
    event.preventDefault()
    if (!form.university.trim()) return
    onSave(studentId, form)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <p className="modal__eyebrow">University application</p>
            <h3>{application ? 'Edit application' : 'New application'}</h3>
          </div>
          <button type="button" className="drawer-close" onClick={onClose}>✕</button>
        </div>

        <form className="modal__form" onSubmit={submit}>
          <div className="field-row">
            <label className="field">
              <span>University *</span>
              <input
                value={form.university}
                onChange={(e) => set('university', e.target.value)}
                placeholder="Ex: Stanford"
                required
              />
            </label>
            <label className="field">
              <span>Program</span>
              <input
                value={form.program}
                onChange={(e) => set('program', e.target.value)}
                placeholder="Ex: MS Computer Science"
              />
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span>Major</span>
              <input
                value={form.major}
                onChange={(e) => set('major', e.target.value)}
                placeholder="Ex: Computer Science"
              />
            </label>
            <label className="field">
              <span>Term</span>
              <input
                value={form.term}
                onChange={(e) => set('term', e.target.value)}
                placeholder="Ex: Fall 2026"
              />
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span>Status</span>
              <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                {APP_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Deadline</span>
              <input type="date" value={form.deadline} onChange={(e) => set('deadline', e.target.value)} />
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span>Decision</span>
              <select value={form.decision} onChange={(e) => set('decision', e.target.value)}>
                {APP_DECISION.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Recommendation</span>
              <select value={form.recommendation} onChange={(e) => set('recommendation', e.target.value)}>
                {APP_RECOMMENDATION.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>

          <label className="field">
            <span>Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={4}
              placeholder="Internal notes about this application"
            />
          </label>

          <div className="field field--inline">
            <span>Visibility</span>
            <VisibilityToggle value={form.visibility} onChange={(v) => set('visibility', v)} />
          </div>

          <div className="modal__foot">
            <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="solid-btn">
              {application ? 'Save changes' : 'Create application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function LicenseModal({ open, studentId, license, onClose, onSave, onLicenseMediaUpload, onLicenseMediaRemove }) {
  const [form, setForm] = useState(emptyLicense())

  useEffect(() => {
    if (open) {
      setForm(license ? { ...emptyLicense(), ...license } : emptyLicense())
    }
  }, [open, license])

  if (!open) return null

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  function submit(event) {
    event.preventDefault()
    if (!form.name.trim()) return
    onSave(studentId, form)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <p className="modal__eyebrow">Licenses &amp; Certifications</p>
            <h3>{license ? 'Edit certification' : 'Add certification'}</h3>
          </div>
          <button type="button" className="drawer-close" onClick={onClose}>✕</button>
        </div>

        <form className="modal__form" onSubmit={submit}>
          <label className="field">
            <span>Name *</span>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Ex: IELTS Academic"
              required
            />
          </label>

          <label className="field">
            <span>Issuing organization</span>
            <input
              value={form.issuer}
              onChange={(e) => set('issuer', e.target.value)}
              placeholder="Ex: British Council"
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span>Issue month</span>
              <select value={form.issueMonth} onChange={(e) => set('issueMonth', e.target.value)}>
                <option value="">Month</option>
                {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Issue year</span>
              <select value={form.issueYear} onChange={(e) => set('issueYear', e.target.value)}>
                <option value="">Year</option>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span>Expiry month</span>
              <select value={form.expireMonth} onChange={(e) => set('expireMonth', e.target.value)}>
                <option value="">Month</option>
                {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Expiry year</span>
              <select value={form.expireYear} onChange={(e) => set('expireYear', e.target.value)}>
                <option value="">Year</option>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>

          <div className="field-row">
            <label className="field">
              <span>Credential ID</span>
              <input
                value={form.credentialId}
                onChange={(e) => set('credentialId', e.target.value)}
                placeholder="Optional"
              />
            </label>
            <label className="field">
              <span>Score</span>
              <input
                value={form.score}
                onChange={(e) => set('score', e.target.value)}
                placeholder="Ex: 7.5"
              />
            </label>
          </div>

          <label className="field">
            <span>Credential URL</span>
            <input
              value={form.credentialUrl}
              onChange={(e) => set('credentialUrl', e.target.value)}
              placeholder="https://"
            />
          </label>

          <div className="field field--inline">
            <span>Visibility</span>
            <VisibilityToggle value={form.visibility} onChange={(v) => set('visibility', v)} />
          </div>

          <div className="modal__foot">
            <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="solid-btn">
              {license ? 'Save changes' : 'Add certification'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}



function NotificationsPanel({
  open,
  onClose,
  notifications,
  settings,
  onToggleSetting,
  onApproveRequest,
  onDeclineRequest,
  onMarkRead,
  onClearResolved,
}) {
  if (!open) return null

  const visible = notifications.filter((n) => settings[n.type])
  const typeMeta = (key) => NOTIFICATION_TYPES.find((t) => t.key === key) || { emoji: '🔔', label: key }

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose}></div>

      <aside className="admin-drawer notif-drawer">
        <div className="admin-drawer__header">
          <div>
            <p className="admin-drawer__eyebrow">Notification Center</p>
            <h2>Notifications</h2>
            <span className="admin-drawer__subtext">Manage alerts and student visibility requests</span>
          </div>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>

        <section className="notif-settings">
          <div className="section-head">
            <h3>Alert preferences</h3>
            <span className="count-pill">
              {Object.values(settings).filter(Boolean).length}/{NOTIFICATION_TYPES.length}
            </span>
          </div>
          <p className="section-head__sub">Choose which alerts you want to receive.</p>

          <div className="notif-settings__list">
            {NOTIFICATION_TYPES.map((type) => {
              const on = !!settings[type.key]
              return (
                <label key={type.key} className="notif-pref">
                  <span className="notif-pref__icon">{type.emoji}</span>
                  <span className="notif-pref__text">
                    <strong>{type.label}</strong>
                    <small>{type.hint}</small>
                  </span>
                  <button
                    type="button"
                    className={`switch ${on ? 'switch--on' : ''}`}
                    role="switch"
                    aria-checked={on}
                    onClick={() => onToggleSetting(type.key)}
                  >
                    <span className="switch__dot" />
                  </button>
                </label>
              )
            })}
          </div>
        </section>

        <section className="notif-inbox">
          <div className="section-head">
            <h3>Inbox</h3>
            <button type="button" className="mini-btn" onClick={onClearResolved}>Clear resolved</button>
          </div>

          <div className="notif-list">
            {visible.length ? (
              visible.map((n) => {
                const meta = typeMeta(n.type)
                const isRequest = n.type === 'visibility_request'
                const resolved = n.status === 'approved' || n.status === 'declined'
                return (
                  <article key={n.id} className={`notif-item notif-item--${n.status}`}>
                    <div className="notif-item__icon">{meta.emoji}</div>
                    <div className="notif-item__body">
                      <div className="notif-item__top">
                        <strong>{n.studentName}</strong>
                        <StatusBadge
                          variant={statusVariant(
                            n.type === 'recommendation_declined' ? 'reject' : n.status,
                          )}
                        >
                          {meta.label}
                        </StatusBadge>
                      </div>
                      <p className="notif-item__msg">{n.message}</p>

                      {isRequest && !resolved && (
                        <div className="notif-item__actions">
                          <VisibilityChip value={n.current} />
                          <span className="notif-arrow">→</span>
                          <VisibilityChip value={n.requested} />
                          <div className="notif-item__buttons">
                            <button
                              type="button"
                              className="solid-btn solid-btn--sm"
                              onClick={() => onApproveRequest(n)}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="mini-btn mini-btn--danger"
                              onClick={() => onDeclineRequest(n)}
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      )}

                      {isRequest && resolved && (
                        <div className="notif-item__actions">
                          <span
                            className={`vis-chip ${
                              n.status === 'approved' ? 'vis-chip--public' : 'vis-chip--private'
                            }`}
                          >
                            {n.status === 'approved' ? '✓ Approved' : '✕ Declined'}
                          </span>
                        </div>
                      )}

                      {!isRequest && n.status !== 'read' && (
                        <div className="notif-item__actions">
                          <button
                            type="button"
                            className="mini-btn"
                            onClick={() => onMarkRead(n.id)}
                          >
                            Mark as read
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                )
              })
            ) : (
              <div className="empty-state empty-state--cert">
                <div className="empty-state__icon">🔔</div>
                <h4>No notifications</h4>
                <p>Enabled alerts will appear here.</p>
              </div>
            )}
          </div>
        </section>
      </aside>
    </>
  )
}

// ---- MAIN COMPONENT WITH LOCAL STUDENTS STATE + OPTIMISTIC UPDATES ----

export default function AdminDashboard() {
  const studentsData = useStudents()
  const [students, setStudents] = useState([])
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [filterMajor, setFilterMajor] = useState('all')
  const [filterUniversity, setFilterUniversity] = useState('all')
  const [filterGender, setFilterGender] = useState('all')
  const [filterDecision, setFilterDecision] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedStudentId, setSelectedStudentId] = useState(null)
  const [activeTab, setActiveTab] = useState('profile')
  const [expandedApplications, setExpandedApplications] = useState([])
  const [licenseModal, setLicenseModal] = useState({ open: false, studentId: null, license: null })
  const [appModal, setAppModal] = useState({ open: false, studentId: null, application: null })
  const [profileModal, setProfileModal] = useState({ open: false, studentId: null })

  const [notifOpen, setNotifOpen] = useState(false)
  // Notifications + preferences are persisted too, so the inbox is identical after refresh.
  const [notifications, setNotifications] = useState(() =>
    loadPersisted('apptrack.notifications.v1', INITIAL_NOTIFICATIONS),
  )
  const [notifSettings, setNotifSettings] = useState(() =>
    loadPersisted('apptrack.notifSettings.v1', {
      visibility_request: true,
      deadline: true,
      recommendation_declined: true,
      other: false,
    }),
  )

  // Sync local students state with global hook data
  useEffect(() => {
    setStudents(studentsData || [])
  }, [studentsData])

  useEffect(() => { savePersisted('apptrack.notifications.v1', notifications) }, [notifications])
  useEffect(() => { savePersisted('apptrack.notifSettings.v1', notifSettings) }, [notifSettings])

  const notifCount = notifications.filter(
    (n) => notifSettings[n.type] && (n.status === 'pending' || n.status === 'unread'),
  ).length

  function toggleNotifSetting(key) {
    setNotifSettings((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function markNotificationRead(id) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status: 'read' } : n)))
  }

  function clearResolvedNotifications() {
    setNotifications((prev) =>
      prev.filter((n) => !['approved', 'declined', 'read'].includes(n.status)),
    )
  }

  // Approving a visibility request applies the change globally through the store.
  function approveVisibilityRequest(notification) {
    const { studentId, field, requested } = notification
    setVisibility(studentId, field, requested)
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, status: 'approved' } : n)),
    )
  }

  function declineVisibilityRequest(notification) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, status: 'declined' } : n)),
    )
  }

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) || null,
    [students, selectedStudentId],
  )

  const profileModalStudent = useMemo(
    () => students.find((s) => s.id === profileModal.studentId) || null,
    [students, profileModal.studentId],
  )

  useEffect(() => {
    if (!selectedStudentId) return

    function handleEscape(event) {
      if (event.key === 'Escape') setSelectedStudentId(null)
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [selectedStudentId])

  const filteredStudents = useMemo(() => {
    let result = [...students]

    if (filterMajor !== 'all') result = result.filter((s) => s.major === filterMajor)
    if (filterUniversity !== 'all') result = result.filter((s) => s.university === filterUniversity)
    if (filterGender !== 'all') result = result.filter((s) => s.gender === filterGender)
    if (filterDecision !== 'all') result = result.filter((s) => s.decision === filterDecision)

    return result
  }, [students, filterMajor, filterUniversity, filterGender, filterDecision])

  const majorData = useMemo(() => toPercentMap(buildCounts(filteredStudents, 'major')), [filteredStudents])
  const universityData = useMemo(() => toPercentMap(buildCounts(filteredStudents, 'university')), [filteredStudents])
  const genderData = useMemo(() => toPercentMap(buildCounts(filteredStudents, 'gender')), [filteredStudents])
  const decisionData = useMemo(() => toPercentMap(buildCounts(filteredStudents, 'decision')), [filteredStudents])

  const studentsPerPage = 6
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / studentsPerPage))

  const currentStudents = useMemo(() => {
    const start = (currentPage - 1) * studentsPerPage
    return filteredStudents.slice(start, start + studentsPerPage)
  }, [filteredStudents, currentPage])

  const majors = [...new Set(students.map((s) => s.major))]
  const universities = [...new Set(students.map((s) => s.university))]
  const genders = [...new Set(students.map((s) => s.gender))]
  const decisions = [...new Set(students.map((s) => s.decision))]

  function openStudent(student) {
    setSelectedStudentId(student.id)
    setActiveTab('profile')
    setExpandedApplications([])
  }

  function closeDrawer() {
    setSelectedStudentId(null)
    setExpandedApplications([])
  }

  function handleToggleApplicationExpanded(appId) {
    setExpandedApplications((prev) =>
      prev.includes(appId) ? prev.filter((id) => id !== appId) : [...prev, appId],
    )
  }

  async function handleDeleteStudent(studentId) {
    const confirmed = window.confirm(
      'Are you sure you want to delete this student profile? This action cannot be undone.',
    )

    if (!confirmed) return

    try {
      await deleteStudent(studentId)

      // Optimistically remove from local state
      setStudents((prev) => prev.filter((s) => s.id !== studentId))

      if (selectedStudentId === studentId) {
        closeDrawer()
      }
    } catch (error) {
      console.error('Delete student error:', error)
      alert(error?.message || 'Something went wrong while deleting the student profile.')
    }
  }

  // Photo handlers write to the global store AND update local state.
  async function handleStudentPhotoUpload(studentId, file) {
    if (!file) return
    const url = await fileToDataUrl(file) // data URL persists across refresh
    setPhoto(studentId, url, file.name)
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId ? { ...s, photoUrl: url, photoPath: file.name || null } : s,
      ),
    )
  }

  function handleRemoveStudentPhoto(studentId) {
    removePhoto(studentId)
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId ? { ...s, photoUrl: null, photoPath: null } : s,
      ),
    )
  }

  // Save profile: optimistic update then backend
  async function handleSaveProfile(studentId, data) {
    // Optimistically update local state
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? {
              ...s,
              fullName: data.fullName || s.fullName,
              email: data.email || s.email,
              phone: data.phone || s.phone,
              major: data.major || s.major,
              university: data.university || s.university,
              gender: data.gender || s.gender,
            }
          : s,
      ),
    )

    try {
      await setProfile(studentId, data)
    } catch (error) {
      console.error('Save profile error:', error)
      setStudents(studentsData || [])
      alert(error?.message || 'Something went wrong while saving the profile.')
    }
  }

  // Visibility: optimistic update then backend (instant UI feedback)
  async function handleSetVisibility(studentId, key, value) {
    // Optimistically update local state first for instant UI feedback
    const fieldKey = key === 'profile' ? 'profile' :
                     key === 'photo' ? 'photo' :
                     key === 'email' ? 'email' :
                     key === 'phone' ? 'phone' :
                     key === 'notes' ? 'notes' : key

    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? {
              ...s,
              visibility: {
                ...(s.visibility || {}),
                [fieldKey]: value,
              },
            }
          : s,
      ),
    )

    try {
      await setVisibility(studentId, key, value)
    } catch (error) {
      console.error('Set visibility error:', error)
      // Revert on failure - reload from store
      setStudents(studentsData || [])
      alert(error?.message || 'Something went wrong while updating visibility.')
    }
  }

  // Update notes: optimistic update then backend
  async function handleUpdateNotes(studentId, notes) {
    // Optimistically update local state
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId ? { ...s, notes } : s,
      ),
    )

    try {
      await updateNotes(studentId, notes)
    } catch (error) {
      console.error('Update notes error:', error)
      // Revert on failure
      setStudents(studentsData || [])
      alert(error?.message || 'Something went wrong while saving notes.')
    }
  }

  // Application delete: call backend + update local state
  async function handleDeleteApplication(studentId, appId) {
    try {
      await deleteApplication(studentId, appId)

      setStudents((prev) =>
        prev.map((s) =>
          s.id === studentId
            ? { ...s, applications: (s.applications || []).filter((a) => a.id !== appId) }
            : s,
        ),
      )
      setExpandedApplications((prev) => prev.filter((id) => id !== appId))
    } catch (error) {
      console.error('Delete application error:', error)
      alert(error?.message || 'Something went wrong while deleting the application.')
    }
  }

  // Application create/update: backend + merge into local state
  async function handleSaveApplication(studentId, form) {
    try {
      const result = await saveApplication(studentId, form)

      setStudents((prev) =>
        prev.map((s) => {
          if (s.id !== studentId) return s
          const existing = s.applications || []
          const idx = existing.findIndex((a) => a.id === result.id)
          if (idx === -1) {
            return { ...s, applications: [...existing, result] }
          }
          const next = [...existing]
          next[idx] = result
          return { ...s, applications: next }
        }),
      )
    } catch (error) {
      console.error('Save application error:', error)
      alert(error?.message || 'Something went wrong while saving the application.')
    }
  }

  // Application visibility: backend + local state update
  async function handleSetApplicationVisibility(studentId, appId, visibility) {
    try {
      const updated = await setApplicationVisibility(studentId, appId, visibility)

      setStudents((prev) =>
        prev.map((s) => {
          if (s.id !== studentId) return s
          const apps = s.applications || []
          return {
            ...s,
            applications: apps.map((a) => (a.id === appId ? { ...a, visibility: updated.visibility } : a)),
          }
        }),
      )
    } catch (error) {
      console.error('Set application visibility error:', error)
      alert(error?.message || 'Something went wrong while updating application visibility.')
    }
  }

  async function handleUploadApplicationFile(studentId, applicationId, category, file) {
  if (!file) return

  try {
    const uploadedDocument = await uploadApplicationFile(studentId, applicationId, category, file)

    setStudents((prev) =>
      addDocumentToStudentApplication(
        prev,
        studentId,
        applicationId,
        category,
        uploadedDocument
      )
    )
  } catch (error) {
    console.error('Upload application file error:', error)
    alert(error?.message || 'Something went wrong while uploading the file.')
  }
}

async function handleRemoveApplicationFile(studentId, applicationId, category, docId) {
  try {
    await removeApplicationFile(studentId, applicationId, category, docId)

    setStudents((prev) =>
      removeDocumentFromStudentApplication(
        prev,
        studentId,
        applicationId,
        category,
        docId
      )
    )
  } catch (error) {
    console.error('Remove application file error:', error)
    alert(error?.message || 'Something went wrong while removing the file.')
  }
}

  function addDocumentToStudentApplication(prevStudents, studentId, applicationId, category, document) {
  return prevStudents.map((student) => {
    if (student.id !== studentId) return student

    return {
      ...student,
      applications: (student.applications || []).map((application) => {
        if (application.id !== applicationId) return application

        const currentDocs = application.documents || {}
        const currentCategoryDocs = currentDocs[category] || []

        return {
          ...application,
          documents: {
            ...currentDocs,
            [category]: [...currentCategoryDocs, document],
          },
        }
      }),
    }
  })
}


function removeDocumentFromStudentApplication(prevStudents, studentId, applicationId, category, docId) {
  return prevStudents.map((student) => {
    if (student.id !== studentId) return student

    return {
      ...student,
      applications: (student.applications || []).map((application) => {
        if (application.id !== applicationId) return application

        const currentDocs = application.documents || {}
        const currentCategoryDocs = currentDocs[category] || []

        return {
          ...application,
          documents: {
            ...currentDocs,
            [category]: currentCategoryDocs.filter((doc) => doc.id !== docId),
          },
        }
      }),
    }
  })
}

  // License create/update: backend + merge into local state
  async function handleSaveLicense(studentId, form) {
    try {
      const result = await saveLicense(studentId, form)

      setStudents((prev) =>
        prev.map((s) => {
          if (s.id !== studentId) return s
          const existing = s.licenses || []
          const idx = existing.findIndex((l) => l.id === result.id)
          if (idx === -1) {
            return { ...s, licenses: [...existing, result] }
          }
          const next = [...existing]
          next[idx] = result
          return { ...s, licenses: next }
        }),
      )
    } catch (error) {
      console.error('Save license error:', error)
      alert(error?.message || 'Something went wrong while saving the license.')
    }
  }

  // License delete: backend + remove from local state
  async function handleDeleteLicense(studentId, licenseId) {
    try {
      await deleteLicense(studentId, licenseId)

      setStudents((prev) =>
        prev.map((s) =>
          s.id === studentId
            ? { ...s, licenses: (s.licenses || []).filter((l) => l.id !== licenseId) }
            : s,
        ),
      )
    } catch (error) {
      console.error('Delete license error:', error)
      alert(error?.message || 'Something went wrong while deleting the license.')
    }
  }

  // License media upload: backend + local state update
  async function handleLicenseMediaUpload(studentId, licenseId, file) {
    if (!file) return

    try {
      const uploadedMedia = await uploadLicenseMediaFile(studentId, licenseId, file)

      setStudents((prev) =>
        prev.map((s) => {
          if (s.id !== studentId) return s
          const lic = s.licenses || []
          return {
            ...s,
            licenses: lic.map((l) =>
              l.id === licenseId
                ? { ...l, media: [...(l.media || []), uploadedMedia] }
                : l
            ),
          }
        }),
      )
    } catch (error) {
      console.error('Upload license media error:', error)
      alert(error?.message || 'Something went wrong while uploading the license media.')
    }
  }

  // License media remove: backend + local state update
  async function handleLicenseMediaRemove(studentId, mediaId) {
    try {
      await deleteLicenseMediaFile(studentId, mediaId)

      setStudents((prev) =>
        prev.map((s) => {
          if (s.id !== studentId) return s
          const lic = s.licenses || []
          return {
            ...s,
            licenses: lic.map((l) => ({
              ...l,
              media: (l.media || []).filter((m) => m.id !== mediaId),
            })),
          }
        }),
      )
    } catch (error) {
      console.error('Remove license media error:', error)
      alert(error?.message || 'Something went wrong while removing the license media.')
    }
  }

  // License visibility: backend + local state update
  async function handleSetLicenseVisibility(studentId, licenseId, visibility) {
    try {
      const updated = await setLicenseVisibility(studentId, licenseId, visibility)

      setStudents((prev) =>
        prev.map((s) => {
          if (s.id !== studentId) return s
          const lic = s.licenses || []
          return {
            ...s,
            licenses: lic.map((l) => (l.id === licenseId ? { ...l, visibility: updated.visibility } : l)),
          }
        }),
      )
    } catch (error) {
      console.error('Set license visibility error:', error)
      alert(error?.message || 'Something went wrong while updating license visibility.')
    }
  }

  function openAddLicense(studentId) {
    setLicenseModal({ open: true, studentId, license: null })
  }

  function openEditLicense(studentId, licenseId) {
    const st = students.find((s) => s.id === studentId)
    const lic = st?.licenses?.find((l) => l.id === licenseId) || null
    setLicenseModal({ open: true, studentId, license: lic })
  }

  function closeLicenseModal() {
    setLicenseModal({ open: false, studentId: null, license: null })
  }

  function openAddApplication(studentId) {
    setAppModal({ open: true, studentId, application: null })
  }

  function openEditApplication(studentId, appId) {
    const st = students.find((s) => s.id === studentId)
    const app = st?.applications?.find((a) => a.id === appId) || null
    setAppModal({ open: true, studentId, application: app })
  }

  function closeAppModal() {
    setAppModal({ open: false, studentId: null, application: null })
  }

  function openEditProfile(studentId) {
    setProfileModal({ open: true, studentId })
  }

  function closeProfileModal() {
    setProfileModal({ open: false, studentId: null })
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient--one"></div>
      <div className="ambient ambient--two"></div>

      <header className="topbar">
        <div>
          <h1 className="topbar__title">Student Manager</h1>
          <p className="topbar__subtitle">
            Admin overview, private editing access, and student application control
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="notification-btn" onClick={() => setNotifOpen(true)}>
            <span className="notification-btn__icon">🔔</span>
            Notifications
            {notifCount > 0 && <span className="notification-btn__count">{notifCount}</span>}
          </button>
          <button
            type="button"
            className="notification-btn"
            onClick={async () => {
              await signOut()
              navigate('/')
            }}
            style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', padding: '10px 16px' }}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        <section className="stats-section">
          <TotalStudentsCard total={filteredStudents.length} />

          <div className="charts-grid">
            <PieChartCard title="Major Distribution" data={majorData} />
            <PieChartCard title="University Distribution" data={universityData} />
            <PieChartCard title="Gender Distribution" data={genderData} />
            <PieChartCard title="Decision Rate" data={decisionData} />
          </div>
        </section>

        <section className="students-section">
          <div className="filters-bar">
            <select
              value={filterMajor}
              onChange={(e) => { setFilterMajor(e.target.value); setCurrentPage(1) }}
            >
              <option value="all">All Majors</option>
              {majors.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>

            <select
              value={filterUniversity}
              onChange={(e) => { setFilterUniversity(e.target.value); setCurrentPage(1) }}
            >
              <option value="all">All Universities</option>
              {universities.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>

            <select
              value={filterGender}
              onChange={(e) => { setFilterGender(e.target.value); setCurrentPage(1) }}
            >
              <option value="all">All Genders</option>
              {genders.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>

            <select
              value={filterDecision}
              onChange={(e) => { setFilterDecision(e.target.value); setCurrentPage(1) }}
            >
              <option value="all">All Decisions</option>
              {decisions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="students-grid">
            {currentStudents.map((student) => (
              <StudentCard
                key={student.id}
                student={student}
                onOpen={openStudent}
              />
            ))}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            setCurrentPage={setCurrentPage}
          />
        </section>
      </main>

      <PublicStudentDrawer
      student={selectedStudent}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onClose={closeDrawer}
      onEditProfile={openEditProfile}
      onDeleteStudent={handleDeleteStudent}
      onUpdateNotes={handleUpdateNotes}
      onSetVisibility={handleSetVisibility}
      onToggleApplicationExpanded={handleToggleApplicationExpanded}
      expandedApplications={expandedApplications}
      onAddApplication={openAddApplication}
      onEditApplication={openEditApplication}
      onDeleteApplication={handleDeleteApplication}
      onSetApplicationVisibility={handleSetApplicationVisibility}
      onUploadApplicationFile={handleUploadApplicationFile}
      onRemoveApplicationFile={handleRemoveApplicationFile}
      onStudentPhotoUpload={handleStudentPhotoUpload}
      onRemoveStudentPhoto={handleRemoveStudentPhoto}
      licenses={selectedStudent?.licenses}
      onAddLicense={openAddLicense}
      onEditLicense={openEditLicense}
      onDeleteLicense={handleDeleteLicense}
      onSetLicenseVisibility={handleSetLicenseVisibility}
      onLicenseMediaUpload={handleLicenseMediaUpload}
      onLicenseMediaRemove={handleLicenseMediaRemove}
    />

      <ProfileModal
        open={profileModal.open}
        student={profileModalStudent}
        onClose={closeProfileModal}
        onSave={handleSaveProfile}
      />

      <ApplicationModal
        open={appModal.open}
        studentId={appModal.studentId}
        application={appModal.application}
        onClose={closeAppModal}
        onSave={handleSaveApplication}
      />

      <LicenseModal
        open={licenseModal.open}
        studentId={licenseModal.studentId}
        license={licenseModal.license}
        onClose={closeLicenseModal}
        onSave={handleSaveLicense}
      />

      <NotificationsPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={notifications}
        settings={notifSettings}
        onToggleSetting={toggleNotifSetting}
        onApproveRequest={approveVisibilityRequest}
        onDeclineRequest={declineVisibilityRequest}
        onMarkRead={markNotificationRead}
        onClearResolved={clearResolvedNotifications}
      />
    </div>
  )
}
