import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './AdminDashboard.css'
import Avatar from '../components/Avatar'
import '../components/Avatar.css'
import { useAuth } from '../context/AuthContext'
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

function loadPersisted(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw)
  } catch { }
  return fallback
}

function savePersisted(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch { }
}

const PIE_COLORS = ['#7c3aed', '#06b6d4', '#22c55e', '#f97316', '#ef4444', '#8b5cf6', '#14b8a6']

const DOC_CATEGORIES = [
  { key: 'application', label: 'Applications', hint: 'Submitted application forms', emoji: '🗂️', color: '#6d28d9', tint: 'rgba(124,58,237,0.12)' },
  { key: 'transcript', label: 'Transcripts', hint: 'Official & unofficial transcripts', emoji: '📊', color: '#0e7490', tint: 'rgba(6,182,212,0.14)' },
  { key: 'recommendation', label: 'Recommendation Letters', hint: 'Letters from recommenders', emoji: '✉️', color: '#b45309', tint: 'rgba(249,115,22,0.14)' },
  { key: 'other', label: 'Other Required PDFs', hint: 'Essays, CV, financials, etc.', emoji: '📁', color: '#15803d', tint: 'rgba(34,197,94,0.14)' },
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const YEARS = Array.from({ length: 16 }, (_, i) => String(2030 - i))
const GENDERS = ['Female', 'Male', 'Other']
const APP_STATUS = ['Not Started', 'In Progress', 'Submitted', 'In Review', 'Closed']
const APP_DECISION = ['Pending', 'Accepted', 'Rejected', 'Waitlisted']
const APP_RECOMMENDATION = ['Pending', 'Requested', 'Received']

const NOTIFICATION_TYPES = [
  { key: 'visibility_request', label: 'Visibility requests', hint: 'When a student asks to make a field public or private', emoji: '👁️' },
  { key: 'deadline', label: 'Approaching deadlines', hint: 'When an application deadline is near', emoji: '⏰' },
  { key: 'recommendation_declined', label: 'Declined recommendations', hint: 'When a recommender declines a request', emoji: '✉️' },
  { key: 'other', label: 'Other important issues', hint: 'Exceptions and system alerts', emoji: '⚠️' },
]

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
    label, value,
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

/* ─── Small reusable pieces ─── */

function VisibilityToggle({ value, onChange }) {
  const isPublic = value === 'public'
  return (
    <button
      type="button"
      className={`vis-toggle ${isPublic ? 'vis-toggle--public' : 'vis-toggle--private'}`}
      onClick={() => onChange(isPublic ? 'private' : 'public')}
      title={isPublic ? 'Public' : 'Private'}
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

function StatusBadge({ children, variant = 'default' }) {
  return <span className={`status-badge status-badge--${variant}`}>{children}</span>
}

/* ─── New stat card ─── */
function StatCard({ label, value, icon, tone, hint, trend }) {
  return (
    <div className={`new-stat-card new-stat-card--${tone}`}>
      <div className="new-stat-card__icon-wrap">
        <span className="new-stat-card__icon">{icon}</span>
      </div>
      {trend && <span className="new-stat-card__trend">{trend}</span>}
      <p className="new-stat-card__label">{label}</p>
      <p className="new-stat-card__value">{value}</p>
      <p className="new-stat-card__hint">{hint}</p>
    </div>
  )
}

/* ─── Distribution / pie card ─── */
function DistributionCard({ title, data }) {
  const [hover, setHover] = useState(null)

  const gradient = data.length
    ? `conic-gradient(${data.map((item, i) => {
        const prev = data.slice(0, i).reduce((s, c) => s + c.percent, 0)
        return `${item.color} ${prev}% ${prev + item.percent}%`
      }).join(', ')})`
    : '#e2e8f0'

  return (
    <div className="new-dist-card">
      <div className="new-dist-card__head">
        <h3 className="new-dist-card__title">{title}</h3>
        <span className="new-dist-card__groups">{data.length} {data.length === 1 ? 'group' : 'groups'}</span>
      </div>

      <div className="new-dist-card__body">
        {/* Pie */}
        <div className="new-pie-wrap">
          <div className="new-pie" style={{ background: gradient }}>
            <div className="new-pie__hole" />
            {data.map((item, i) => {
              if (item.percent < 7) return null
              const prev = data.slice(0, i).reduce((s, c) => s + c.percent, 0)
              const mid = prev + item.percent / 2
              const angle = (mid / 100) * 360 - 90
              const rad = angle * Math.PI / 180
              const lr = item.percent >= 18 ? 55 : 62
              const x = 50 + lr * Math.cos(rad)
              const y = 50 + lr * Math.sin(rad)
              return (
                <span
                  key={item.label}
                  className="new-pie__pct"
                  style={{ left: `${x}%`, top: `${y}%`, opacity: hover === null || hover === i ? 1 : 0.35 }}
                >
                  {item.percent}%
                </span>
              )
            })}
          </div>
        </div>

        {/* Legend */}
        <ul className="new-dist-legend">
          {data.map((item, i) => (
            <li key={item.label}>
              <button
                type="button"
                className={`new-dist-legend__item ${hover === i ? 'new-dist-legend__item--active' : ''}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <span className="new-dist-legend__dot" style={{ background: item.color, boxShadow: hover === i ? `0 0 0 4px ${item.color}28` : undefined }} />
                <span className="new-dist-legend__label">{item.label}</span>
                <span className="new-dist-legend__pct">{item.percent}%</span>
              </button>
            </li>
          ))}
          {data.length === 0 && <li className="new-dist-legend__empty">No data yet</li>}
        </ul>
      </div>
    </div>
  )
}

/* ─── New student card (grid) ─── */
function NewStudentCard({ student, onOpen }) {
  const profilePublic = student.visibility?.profile === 'public'
  const appCount = (student.applications || []).length
  const acceptedCount = (student.applications || []).filter(a => (a.decision || '').toLowerCase() === 'accepted').length
  const initials = (student.fullName || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()

  // simple completion score
  const fields = [student.fullName, student.email, student.phone, student.major, student.university, student.gender]
  const filled = fields.filter(Boolean).length
  const pct = Math.round((filled / fields.length) * 100)

  return (
    <div className="new-student-card">
      {/* Cover */}
      <div className="new-student-card__cover">
        <div className="new-student-card__cover-dots" />
        <div className="new-student-card__cover-badges">
          <span className={`new-student-card__vis-badge ${profilePublic ? 'new-student-card__vis-badge--public' : 'new-student-card__vis-badge--private'}`}>
            {profilePublic ? '🌐 Public' : '🔒 Private'}
          </span>
        </div>
      </div>

      {/* Avatar */}
      <div className="new-student-card__avatar-wrap">
        <div className="new-student-card__avatar">
          {student.photoUrl
            ? <img src={student.photoUrl} alt={student.fullName} />
            : <span>{initials}</span>}
        </div>
        <div className="new-student-card__avatar-dot" />
      </div>

      {/* Body */}
      <div className="new-student-card__body">
        <h4 className="new-student-card__name">{student.fullName}</h4>
        <p className="new-student-card__major">{student.major || <em>Major not set yet</em>}</p>

        {/* Stats row */}
        <div className="new-student-card__stats">
          <div className="new-student-card__stat">
            <p className="new-student-card__stat-label">Apps</p>
            <p className="new-student-card__stat-value">{appCount}</p>
          </div>
          <div className="new-student-card__stat new-student-card__stat--mid">
            <p className="new-student-card__stat-label">Accepted</p>
            <p className="new-student-card__stat-value new-student-card__stat-value--green">{acceptedCount}</p>
          </div>
          <div className="new-student-card__stat">
            <p className="new-student-card__stat-label">Profile</p>
            <p className="new-student-card__stat-value new-student-card__stat-value--amber">{pct}%</p>
          </div>
        </div>

        <button type="button" className="new-student-card__manage-btn" onClick={() => onOpen(student)}>
          Manage Student <span className="new-student-card__manage-arrow">→</span>
        </button>
      </div>
    </div>
  )
}

/* ─── Attention panel ─── */
function AttentionPanel({ students }) {
  const incomplete = students.filter(s => {
    const fields = [s.fullName, s.email, s.phone, s.major, s.university, s.gender]
    return fields.filter(Boolean).length < fields.length
  })

  return (
    <div className="new-attention-panel">
      <div className="new-attention-panel__head">
        <div className="new-attention-panel__icon-wrap">
          <span className="new-attention-panel__icon">⚠️</span>
          <span className="new-attention-panel__pulse" />
        </div>
        <div>
          <h3 className="new-attention-panel__title">Attention</h3>
          <p className="new-attention-panel__sub">Needs a closer look</p>
        </div>
        <span className="new-attention-panel__count">{incomplete.length}</span>
      </div>

      <div className="new-attention-panel__list">
        {incomplete.length === 0 && (
          <p className="new-attention-panel__empty">All students look good ✓</p>
        )}
        {incomplete.map(s => {
          const fields = [s.fullName, s.email, s.phone, s.major, s.university, s.gender]
          const pct = Math.round((fields.filter(Boolean).length / fields.length) * 100)
          const initials = (s.fullName || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
          return (
            <div key={s.id} className="new-attention-item">
              <div className="new-attention-item__avatar-wrap">
                <div className="new-attention-item__avatar">
                  {s.photoUrl ? <img src={s.photoUrl} alt={s.fullName} /> : <span>{initials}</span>}
                </div>
                <span className="new-attention-item__warn">!</span>
              </div>
              <div className="new-attention-item__body">
                <p className="new-attention-item__name">{s.fullName}</p>
                <p className="new-attention-item__sub">Incomplete</p>
                <div className="new-attention-item__bar-wrap">
                  <div className="new-attention-item__bar">
                    <div className="new-attention-item__bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="new-attention-item__pct">{pct}%</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Pagination (unchanged logic) ─── */
function Pagination({ currentPage, totalPages, setCurrentPage }) {
  const pages = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    if (currentPage <= 4) return [1, 2, 3, 4, 5, '...', totalPages]
    if (currentPage >= totalPages - 3) return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages]
  }, [currentPage, totalPages])

  return (
    <div className="pagination">
      <button className="page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</button>
      {pages.map((page, i) =>
        page === '...'
          ? <span key={`e-${i}`} className="page-ellipsis">...</span>
          : <button key={page} className={`page-btn ${currentPage === page ? 'page-btn--active' : ''}`} onClick={() => setCurrentPage(page)}>{page}</button>
      )}
      <button className="page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</button>
    </div>
  )
}

/* ─── All modals (unchanged logic, kept intact) ─── */
function DocumentGroup({ student, application, category, onUpload, onRemove, onOpenInline }) {
  const docs = getDocs(application, category.key)
  const inputId = `doc-${student.id}-${application.id}-${category.key}`
  return (
    <section className="doc-group">
      <header className="doc-group__head">
        <div className="doc-group__title">
          <span className="doc-group__icon" style={{ background: category.tint, color: category.color }}>{category.emoji}</span>
          <div className="doc-group__label">
            <h5>{category.label}</h5>
            <p>{category.hint}</p>
          </div>
        </div>
        <span className="doc-group__count">{docs.length}</span>
      </header>
      <div className="doc-group__body">
        {docs.map(doc => (
          <div key={doc.id} className="doc-chip">
            <span className="doc-chip__file">📄</span>
            <div className="doc-chip__info">
              <strong title={doc.name}>{doc.name}</strong>
              <span>{formatSize(doc.size)}</span>
            </div>
            <div className="doc-chip__actions">
              {doc.url && (
                <>
                  <button type="button" className="mini-btn" onClick={() => onOpenInline(doc)}>View</button>
                  <a className="mini-btn" href={doc.url} target="_blank" rel="noreferrer">Open tab</a>
                </>
              )}
              <button type="button" className="mini-btn mini-btn--danger" onClick={() => onRemove(student.id, application.id, category.key, doc.id)}>Remove</button>
            </div>
          </div>
        ))}
        <label htmlFor={inputId} className="doc-drop">
          <span className="doc-drop__plus">+</span>
          <span className="doc-drop__text">Upload PDF<small>Click to browse — PDF only</small></span>
        </label>
        <input id={inputId} type="file" accept="application/pdf" className="file-input-hidden"
          onChange={e => { onUpload(student.id, application.id, category.key, e.target.files?.[0] || null); e.target.value = '' }} />
      </div>
    </section>
  )
}

function ProfileModal({ open, student, onClose, onSave }) {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', major: '', university: '', gender: '' })
  useEffect(() => {
    if (open && student) setForm({ fullName: student.fullName || '', email: student.email || '', phone: student.phone || '', major: student.major || '', university: student.university || '', gender: student.gender || '' })
  }, [open, student])
  if (!open || !student) return null
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  function submit(e) { e.preventDefault(); if (!form.fullName.trim()) return; onSave(student.id, form); onClose() }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <div><p className="modal__eyebrow">Student profile</p><h3>Edit profile</h3></div>
          <button type="button" className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <form className="modal__form" onSubmit={submit}>
          <label className="field"><span>Full name *</span><input value={form.fullName} onChange={e => set('fullName', e.target.value)} required /></label>
          <div className="field-row">
            <label className="field"><span>Email</span><input type="email" value={form.email} onChange={e => set('email', e.target.value)} /></label>
            <label className="field"><span>Phone</span><input value={form.phone} onChange={e => set('phone', e.target.value)} /></label>
          </div>
          <div className="field-row">
            <label className="field"><span>Major</span><input value={form.major} onChange={e => set('major', e.target.value)} /></label>
            <label className="field"><span>University</span><input value={form.university} onChange={e => set('university', e.target.value)} /></label>
          </div>
          <label className="field"><span>Gender</span>
            <select value={form.gender} onChange={e => set('gender', e.target.value)}>
              <option value="">Select</option>
              {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
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
  useEffect(() => { if (open) setForm(application ? { ...emptyApplication(), ...application } : emptyApplication()) }, [open, application])
  if (!open) return null
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  function submit(e) { e.preventDefault(); if (!form.university.trim()) return; onSave(studentId, form); onClose() }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <div><p className="modal__eyebrow">University application</p><h3>{application ? 'Edit application' : 'New application'}</h3></div>
          <button type="button" className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <form className="modal__form" onSubmit={submit}>
          <div className="field-row">
            <label className="field"><span>University *</span><input value={form.university} onChange={e => set('university', e.target.value)} placeholder="Ex: Stanford" required /></label>
            <label className="field"><span>Program</span><input value={form.program} onChange={e => set('program', e.target.value)} placeholder="Ex: MS Computer Science" /></label>
          </div>
          <div className="field-row">
            <label className="field"><span>Major</span><input value={form.major} onChange={e => set('major', e.target.value)} placeholder="Ex: Computer Science" /></label>
            <label className="field"><span>Term</span><input value={form.term} onChange={e => set('term', e.target.value)} placeholder="Ex: Fall 2026" /></label>
          </div>
          <div className="field-row">
            <label className="field"><span>Status</span><select value={form.status} onChange={e => set('status', e.target.value)}>{APP_STATUS.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
            <label className="field"><span>Deadline</span><input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} /></label>
          </div>
          <div className="field-row">
            <label className="field"><span>Decision</span><select value={form.decision} onChange={e => set('decision', e.target.value)}>{APP_DECISION.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
            <label className="field"><span>Recommendation</span><select value={form.recommendation} onChange={e => set('recommendation', e.target.value)}>{APP_RECOMMENDATION.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
          </div>
          <label className="field"><span>Notes</span><textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={4} placeholder="Internal notes about this application" /></label>
          <div className="field field--inline"><span>Visibility</span><VisibilityToggle value={form.visibility} onChange={v => set('visibility', v)} /></div>
          <div className="modal__foot">
            <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="solid-btn">{application ? 'Save changes' : 'Create application'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function LicenseModal({ open, studentId, license, onClose, onSave }) {
  const [form, setForm] = useState(emptyLicense())
  useEffect(() => { if (open) setForm(license ? { ...emptyLicense(), ...license } : emptyLicense()) }, [open, license])
  if (!open) return null
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  function submit(e) { e.preventDefault(); if (!form.name.trim()) return; onSave(studentId, form); onClose() }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__head">
          <div><p className="modal__eyebrow">Licenses &amp; Certifications</p><h3>{license ? 'Edit certification' : 'Add certification'}</h3></div>
          <button type="button" className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <form className="modal__form" onSubmit={submit}>
          <label className="field"><span>Name *</span><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: IELTS Academic" required /></label>
          <label className="field"><span>Issuing organization</span><input value={form.issuer} onChange={e => set('issuer', e.target.value)} placeholder="Ex: British Council" /></label>
          <div className="field-row">
            <label className="field"><span>Issue month</span><select value={form.issueMonth} onChange={e => set('issueMonth', e.target.value)}><option value="">Month</option>{MONTHS.map(m => <option key={m} value={m}>{m}</option>)}</select></label>
            <label className="field"><span>Issue year</span><select value={form.issueYear} onChange={e => set('issueYear', e.target.value)}><option value="">Year</option>{YEARS.map(y => <option key={y} value={y}>{y}</option>)}</select></label>
          </div>
          <div className="field-row">
            <label className="field"><span>Expiry month</span><select value={form.expireMonth} onChange={e => set('expireMonth', e.target.value)}><option value="">Month</option>{MONTHS.map(m => <option key={m} value={m}>{m}</option>)}</select></label>
            <label className="field"><span>Expiry year</span><select value={form.expireYear} onChange={e => set('expireYear', e.target.value)}><option value="">Year</option>{YEARS.map(y => <option key={y} value={y}>{y}</option>)}</select></label>
          </div>
          <div className="field-row">
            <label className="field"><span>Credential ID</span><input value={form.credentialId} onChange={e => set('credentialId', e.target.value)} placeholder="Optional" /></label>
            <label className="field"><span>Score</span><input value={form.score} onChange={e => set('score', e.target.value)} placeholder="Ex: 7.5" /></label>
          </div>
          <label className="field"><span>Credential URL</span><input value={form.credentialUrl} onChange={e => set('credentialUrl', e.target.value)} placeholder="https://" /></label>
          <div className="field field--inline"><span>Visibility</span><VisibilityToggle value={form.visibility} onChange={v => set('visibility', v)} /></div>
          <div className="modal__foot">
            <button type="button" className="ghost-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="solid-btn">{license ? 'Save changes' : 'Add certification'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function NotificationsPanel({ open, onClose, notifications, settings, onToggleSetting, onApproveRequest, onDeclineRequest, onMarkRead, onClearResolved }) {
  if (!open) return null
  const visible = notifications.filter(n => settings[n.type])
  const typeMeta = key => NOTIFICATION_TYPES.find(t => t.key === key) || { emoji: '🔔', label: key }
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="admin-drawer notif-drawer">
        <div className="admin-drawer__header">
          <div><p className="admin-drawer__eyebrow">Notification Center</p><h2>Notifications</h2><span className="admin-drawer__subtext">Manage alerts and student visibility requests</span></div>
          <button className="drawer-close" onClick={onClose}>✕</button>
        </div>
        <section className="notif-settings">
          <div className="section-head"><h3>Alert preferences</h3><span className="count-pill">{Object.values(settings).filter(Boolean).length}/{NOTIFICATION_TYPES.length}</span></div>
          <p className="section-head__sub">Choose which alerts you want to receive.</p>
          <div className="notif-settings__list">
            {NOTIFICATION_TYPES.map(type => {
              const on = !!settings[type.key]
              return (
                <label key={type.key} className="notif-pref">
                  <span className="notif-pref__icon">{type.emoji}</span>
                  <span className="notif-pref__text"><strong>{type.label}</strong><small>{type.hint}</small></span>
                  <button type="button" className={`switch ${on ? 'switch--on' : ''}`} role="switch" aria-checked={on} onClick={() => onToggleSetting(type.key)}>
                    <span className="switch__dot" />
                  </button>
                </label>
              )
            })}
          </div>
        </section>
        <section className="notif-inbox">
          <div className="section-head"><h3>Inbox</h3><button type="button" className="mini-btn" onClick={onClearResolved}>Clear resolved</button></div>
          <div className="notif-list">
            {visible.length ? visible.map(n => {
              const meta = typeMeta(n.type)
              const isRequest = n.type === 'visibility_request'
              const resolved = n.status === 'approved' || n.status === 'declined'
              return (
                <article key={n.id} className={`notif-item notif-item--${n.status}`}>
                  <div className="notif-item__icon">{meta.emoji}</div>
                  <div className="notif-item__body">
                    <div className="notif-item__top"><strong>{n.studentName}</strong><StatusBadge variant={statusVariant(n.type === 'recommendation_declined' ? 'reject' : n.status)}>{meta.label}</StatusBadge></div>
                    <p className="notif-item__msg">{n.message}</p>
                    {isRequest && !resolved && (
                      <div className="notif-item__actions">
                        <VisibilityChip value={n.current} /><span className="notif-arrow">→</span><VisibilityChip value={n.requested} />
                        <div className="notif-item__buttons">
                          <button type="button" className="solid-btn solid-btn--sm" onClick={() => onApproveRequest(n)}>Approve</button>
                          <button type="button" className="mini-btn mini-btn--danger" onClick={() => onDeclineRequest(n)}>Decline</button>
                        </div>
                      </div>
                    )}
                    {isRequest && resolved && (
                      <div className="notif-item__actions"><span className={`vis-chip ${n.status === 'approved' ? 'vis-chip--public' : 'vis-chip--private'}`}>{n.status === 'approved' ? '✓ Approved' : '✕ Declined'}</span></div>
                    )}
                    {!isRequest && n.status !== 'read' && (
                      <div className="notif-item__actions"><button type="button" className="mini-btn" onClick={() => onMarkRead(n.id)}>Mark as read</button></div>
                    )}
                  </div>
                </article>
              )
            }) : (
              <div className="empty-state empty-state--cert"><div className="empty-state__icon">🔔</div><h4>No notifications</h4><p>Enabled alerts will appear here.</p></div>
            )}
          </div>
        </section>
      </aside>
    </>
  )
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function AdminDashboard() {
  const studentsData = useStudents()
  const [students, setStudents] = useState([])
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const [filterMajor, setFilterMajor] = useState('all')
  const [filterUniversity, setFilterUniversity] = useState('all')
  const [filterGender, setFilterGender] = useState('all')
  const [filterDecision, setFilterDecision] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('name-asc')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [currentPage, setCurrentPage] = useState(1)
  const [selectedStudentId, setSelectedStudentId] = useState(null)
  const [activeTab, setActiveTab] = useState('profile')
  const [expandedApplications, setExpandedApplications] = useState([])
  const [licenseModal, setLicenseModal] = useState({ open: false, studentId: null, license: null })
  const [appModal, setAppModal] = useState({ open: false, studentId: null, application: null })
  const [profileModal, setProfileModal] = useState({ open: false, studentId: null })

  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState(() => loadPersisted('apptrack.notifications.v1', INITIAL_NOTIFICATIONS))
  const [notifSettings, setNotifSettings] = useState(() => loadPersisted('apptrack.notifSettings.v1', { visibility_request: true, deadline: true, recommendation_declined: true, other: false }))

  useEffect(() => { setStudents(studentsData || []) }, [studentsData])
  useEffect(() => { savePersisted('apptrack.notifications.v1', notifications) }, [notifications])
  useEffect(() => { savePersisted('apptrack.notifSettings.v1', notifSettings) }, [notifSettings])

  const notifCount = notifications.filter(n => notifSettings[n.type] && (n.status === 'pending' || n.status === 'unread')).length

  // ── computed stats ──
  const totalApps = useMemo(() => students.reduce((s, st) => s + (st.applications || []).length, 0), [students])
  const totalAccepted = useMemo(() => students.reduce((s, st) => s + (st.applications || []).filter(a => (a.decision || '').toLowerCase() === 'accepted').length, 0), [students])
  const totalPending = useMemo(() => students.reduce((s, st) => s + (st.applications || []).filter(a => (a.decision || '').toLowerCase() === 'pending').length, 0), [students])
  const avgCompletion = useMemo(() => {
    if (!students.length) return '0%'
    const avg = students.reduce((s, st) => {
      const fields = [st.fullName, st.email, st.phone, st.major, st.university, st.gender]
      return s + Math.round((fields.filter(Boolean).length / fields.length) * 100)
    }, 0) / students.length
    return `${Math.round(avg)}%`
  }, [students])
  const activeStudents = useMemo(() => students.filter(s => (s.applications || []).length > 0).length, [students])

  // ── filters & sort ──
  const filteredStudents = useMemo(() => {
    let result = [...students]
    if (filterMajor !== 'all') result = result.filter(s => s.major === filterMajor)
    if (filterUniversity !== 'all') result = result.filter(s => s.university === filterUniversity)
    if (filterGender !== 'all') result = result.filter(s => s.gender === filterGender)
    if (filterDecision !== 'all') result = result.filter(s => s.decision === filterDecision)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(s =>
        (s.fullName || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.major || '').toLowerCase().includes(q) ||
        (s.university || '').toLowerCase().includes(q)
      )
    }
    if (sortBy === 'name-asc') result.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''))
    if (sortBy === 'name-desc') result.sort((a, b) => (b.fullName || '').localeCompare(a.fullName || ''))
    if (sortBy === 'recent') result.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    return result
  }, [students, filterMajor, filterUniversity, filterGender, filterDecision, searchQuery, sortBy])

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

  const majors = [...new Set(students.map(s => s.major).filter(Boolean))]
  const universities = [...new Set(students.map(s => s.university).filter(Boolean))]
  const genders = [...new Set(students.map(s => s.gender).filter(Boolean))]
  const decisions = [...new Set(students.map(s => s.decision).filter(Boolean))]

  const selectedStudent = useMemo(() => students.find(s => s.id === selectedStudentId) || null, [students, selectedStudentId])
  const profileModalStudent = useMemo(() => students.find(s => s.id === profileModal.studentId) || null, [students, profileModal.studentId])

  useEffect(() => {
    if (!selectedStudentId) return
    const handler = e => { if (e.key === 'Escape') setSelectedStudentId(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedStudentId])

  function openStudent(student) { setSelectedStudentId(student.id); setActiveTab('profile'); setExpandedApplications([]) }
  function closeDrawer() { setSelectedStudentId(null); setExpandedApplications([]) }
  function toggleNotifSetting(key) { setNotifSettings(p => ({ ...p, [key]: !p[key] })) }
  function markNotificationRead(id) { setNotifications(p => p.map(n => n.id === id ? { ...n, status: 'read' } : n)) }
  function clearResolvedNotifications() { setNotifications(p => p.filter(n => !['approved', 'declined', 'read'].includes(n.status))) }
  function approveVisibilityRequest(notification) { const { studentId, field, requested } = notification; setVisibility(studentId, field, requested); setNotifications(p => p.map(n => n.id === notification.id ? { ...n, status: 'approved' } : n)) }
  function declineVisibilityRequest(notification) { setNotifications(p => p.map(n => n.id === notification.id ? { ...n, status: 'declined' } : n)) }

  async function handleDeleteStudent(studentId) {
    if (!window.confirm('Are you sure you want to delete this student profile? This action cannot be undone.')) return
    try { await deleteStudent(studentId); setStudents(p => p.filter(s => s.id !== studentId)); if (selectedStudentId === studentId) closeDrawer() }
    catch (error) { console.error(error); alert(error?.message || 'Something went wrong.') }
  }

  async function handleStudentPhotoUpload(studentId, file) {
    if (!file) return
    const url = await fileToDataUrl(file)
    setPhoto(studentId, url, file.name)
    setStudents(p => p.map(s => s.id === studentId ? { ...s, photoUrl: url, photoPath: file.name || null } : s))
  }

  function handleRemoveStudentPhoto(studentId) {
    removePhoto(studentId)
    setStudents(p => p.map(s => s.id === studentId ? { ...s, photoUrl: null, photoPath: null } : s))
  }

  async function handleSaveProfile(studentId, data) {
    setStudents(p => p.map(s => s.id === studentId ? { ...s, ...data } : s))
    try { await setProfile(studentId, data) }
    catch (error) { console.error(error); setStudents(studentsData || []); alert(error?.message || 'Something went wrong.') }
  }

  async function handleSetVisibility(studentId, key, value) {
    setStudents(p => p.map(s => s.id === studentId ? { ...s, visibility: { ...(s.visibility || {}), [key]: value } } : s))
    try { await setVisibility(studentId, key, value) }
    catch (error) { console.error(error); setStudents(studentsData || []) }
  }

  async function handleUpdateNotes(studentId, notes) {
    setStudents(p => p.map(s => s.id === studentId ? { ...s, notes } : s))
    try { await updateNotes(studentId, notes) }
    catch (error) { console.error(error); setStudents(studentsData || []) }
  }

  async function handleSaveApplication(studentId, form) {
    try {
      const result = await saveApplication(studentId, form)
      setStudents(p => p.map(s => {
        if (s.id !== studentId) return s
        const existing = s.applications || []
        const idx = existing.findIndex(a => a.id === result.id)
        if (idx === -1) return { ...s, applications: [...existing, result] }
        const next = [...existing]; next[idx] = result
        return { ...s, applications: next }
      }))
    } catch (error) { console.error(error); alert(error?.message || 'Something went wrong.') }
  }

  async function handleDeleteApplication(studentId, appId) {
    try {
      await deleteApplication(studentId, appId)
      setStudents(p => p.map(s => s.id === studentId ? { ...s, applications: (s.applications || []).filter(a => a.id !== appId) } : s))
      setExpandedApplications(p => p.filter(id => id !== appId))
    } catch (error) { console.error(error); alert(error?.message || 'Something went wrong.') }
  }

  async function handleSetApplicationVisibility(studentId, appId, visibility) {
    try {
      const updated = await setApplicationVisibility(studentId, appId, visibility)
      setStudents(p => p.map(s => {
        if (s.id !== studentId) return s
        return { ...s, applications: (s.applications || []).map(a => a.id === appId ? { ...a, visibility: updated.visibility } : a) }
      }))
    } catch (error) { console.error(error); alert(error?.message || 'Something went wrong.') }
  }

  async function handleUploadApplicationFile(studentId, applicationId, category, file) {
    if (!file) return
    try {
      const doc = await uploadApplicationFile(studentId, applicationId, category, file)
      setStudents(p => p.map(s => {
        if (s.id !== studentId) return s
        return { ...s, applications: (s.applications || []).map(a => {
          if (a.id !== applicationId) return a
          const docs = a.documents || {}
          return { ...a, documents: { ...docs, [category]: [...(docs[category] || []), doc] } }
        })}
      }))
    } catch (error) { console.error(error); alert(error?.message || 'Something went wrong.') }
  }

  async function handleRemoveApplicationFile(studentId, applicationId, category, docId) {
    try {
      await removeApplicationFile(studentId, applicationId, category, docId)
      setStudents(p => p.map(s => {
        if (s.id !== studentId) return s
        return { ...s, applications: (s.applications || []).map(a => {
          if (a.id !== applicationId) return a
          const docs = a.documents || {}
          return { ...a, documents: { ...docs, [category]: (docs[category] || []).filter(d => d.id !== docId) } }
        })}
      }))
    } catch (error) { console.error(error); alert(error?.message || 'Something went wrong.') }
  }

  async function handleSaveLicense(studentId, form) {
    try {
      const result = await saveLicense(studentId, form)
      setStudents(p => p.map(s => {
        if (s.id !== studentId) return s
        const existing = s.licenses || []
        const idx = existing.findIndex(l => l.id === result.id)
        if (idx === -1) return { ...s, licenses: [...existing, result] }
        const next = [...existing]; next[idx] = result
        return { ...s, licenses: next }
      }))
    } catch (error) { console.error(error); alert(error?.message || 'Something went wrong.') }
  }

  async function handleDeleteLicense(studentId, licenseId) {
    try {
      await deleteLicense(studentId, licenseId)
      setStudents(p => p.map(s => s.id === studentId ? { ...s, licenses: (s.licenses || []).filter(l => l.id !== licenseId) } : s))
    } catch (error) { console.error(error); alert(error?.message || 'Something went wrong.') }
  }

  const activeFiltersCount = [filterMajor, filterUniversity, filterGender, filterDecision].filter(f => f !== 'all').length

  return (
    <div className="app-shell">
      <div className="ambient ambient--one" />
      <div className="ambient ambient--two" />

      {/* ══ NEW HEADER ══ */}
      <header className="new-header">
        <div className="new-header__inner">
          <div className="new-header__brand">
            <div className="new-header__logo-wrap">
              <div className="new-header__logo">🎓</div>
              <div className="new-header__logo-dot" />
            </div>
            <div className="new-header__brand-text">
              <div className="new-header__brand-title-row">
                <h1 className="new-header__brand-title">Student Manager</h1>
                <span className="new-header__brand-badge new-header__brand-badge--admin">Admin</span>
              </div>
              <p className="new-header__brand-subtitle">Private editing · Student control</p>
            </div>
          </div>

          <nav className="new-header__nav">
            <button type="button" className="new-header__nav-btn" onClick={() => navigate('/home')}>🏠 Home</button>
            <button
              type="button"
              className="new-header__nav-btn new-header__nav-btn--notif"
              onClick={() => setNotifOpen(true)}
            >
              🔔 Notifications
              {notifCount > 0 && <span className="new-header__notif-count">{notifCount}</span>}
            </button>
            <div className="new-header__divider" />
            <button type="button" className="new-header__signout" onClick={async () => { await signOut(); navigate('/login') }}>
              🚪 Sign out
            </button>
          </nav>
        </div>
      </header>

      <main className="dashboard-content">

        {/* ══ PAGE TITLE ══ */}
        <section className="new-page-title">
          <div>
            <div className="new-page-title__eyebrow">
              <span className="new-page-title__line" />
              Admin Dashboard
            </div>
            <h2 className="new-page-title__h2">Overview</h2>
            <p className="new-page-title__sub">Monitor students, applications and profile completion across your workspace.</p>
          </div>
        </section>

        {/* ══ STAT CARDS ══ */}
        <section className="new-stats-grid">
          <StatCard label="Total Students" value={students.length} icon="👥" tone="indigo" hint="across workspace" trend={null} />
          <StatCard label="Active Students" value={activeStudents} icon="⚡" tone="amber" hint="engaged this week" trend={students.length ? `${Math.round((activeStudents / students.length) * 100)}%` : null} />
          <StatCard label="Applications" value={totalApps} icon="🎓" tone="sky" hint="submitted total" trend={null} />
          <StatCard label="Accepted" value={totalAccepted} icon="✅" tone="emerald" hint="offers received" trend={null} />
          <StatCard label="Pending Decisions" value={totalPending} icon="⏳" tone="orange" hint="awaiting reply" trend={null} />
          <StatCard label="Profile Completion" value={avgCompletion} icon="📈" tone="rose" hint="avg. across all" trend={null} />
        </section>

        {/* ══ DISTRIBUTION CHARTS ══ */}
        <section className="new-dist-grid">
          <DistributionCard title="Students by Major" data={majorData} />
          <DistributionCard title="Students by University" data={universityData} />
          <DistributionCard title="Students by Gender" data={genderData} />
          <DistributionCard title="Students by Decision" data={decisionData} />
        </section>

        {/* ══ ATTENTION + STUDENTS PANEL ══ */}
        <section className="new-main-grid">

          {/* Attention */}
          <AttentionPanel students={students} />

          {/* Students panel */}
          <div className="new-students-panel">
            {/* Panel header */}
            <div className="new-students-panel__head">
              <div>
                <div className="new-students-panel__eyebrow">
                  <span className="new-students-panel__eyebrow-line" />
                  Student Management
                </div>
                <div className="new-students-panel__title-row">
                  <h3 className="new-students-panel__title">Students</h3>
                  <span className="new-students-panel__count-text">{filteredStudents.length} total</span>
                </div>
              </div>
              <div className="new-students-panel__showing">
                Showing <strong>{currentStudents.length}</strong> <span>of</span> <span>{filteredStudents.length}</span>
              </div>
            </div>

            {/* Search + sort + filters toggle */}
            <div className="new-students-panel__toolbar">
              <div className="new-search-wrap">
                <span className="new-search-wrap__icon">🔍</span>
                <input
                  type="text"
                  className="new-search-input"
                  placeholder="Search by name, email, major or university..."
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1) }}
                />
              </div>

              <select
                className="new-sort-select"
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
              >
                <option value="name-asc">Name A–Z</option>
                <option value="name-desc">Name Z–A</option>
                <option value="recent">Recently added</option>
              </select>

              <button
                type="button"
                className={`new-filters-toggle ${filtersOpen ? 'new-filters-toggle--active' : ''}`}
                onClick={() => setFiltersOpen(o => !o)}
              >
                ⚙️ Filters
                <span className={`new-filters-toggle__count ${filtersOpen ? 'new-filters-toggle__count--active' : ''}`}>
                  {activeFiltersCount || 7}
                </span>
              </button>
            </div>

            {/* Filters panel */}
            {filtersOpen && (
              <div className="new-filters-panel">
                <div className="new-filters-panel__head">
                  <span className="new-filters-panel__label">🔽 Filters</span>
                  <button type="button" className="new-filters-panel__clear" onClick={() => { setFilterMajor('all'); setFilterUniversity('all'); setFilterGender('all'); setFilterDecision('all'); setCurrentPage(1) }}>
                    ✕ Clear all
                  </button>
                </div>
                <div className="new-filters-panel__selects">
                  <select className="new-filter-select" value={filterMajor} onChange={e => { setFilterMajor(e.target.value); setCurrentPage(1) }}>
                    <option value="all">All Majors</option>
                    {majors.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select className="new-filter-select" value={filterUniversity} onChange={e => { setFilterUniversity(e.target.value); setCurrentPage(1) }}>
                    <option value="all">All Universities</option>
                    {universities.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <select className="new-filter-select" value={filterGender} onChange={e => { setFilterGender(e.target.value); setCurrentPage(1) }}>
                    <option value="all">All Genders</option>
                    {genders.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <select className="new-filter-select" value={filterDecision} onChange={e => { setFilterDecision(e.target.value); setCurrentPage(1) }}>
                    <option value="all">All Decisions</option>
                    {decisions.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* Student cards grid */}
            <div className="new-students-grid">
              {currentStudents.map(student => (
                <NewStudentCard key={student.id} student={student} onOpen={openStudent} />
              ))}
              {currentStudents.length === 0 && (
                <div className="empty-state empty-state--cert" style={{ gridColumn: '1 / -1' }}>
                  <div className="empty-state__icon">🎓</div>
                  <h4>No students found</h4>
                  <p>Try adjusting your search or filters.</p>
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <Pagination currentPage={currentPage} totalPages={totalPages} setCurrentPage={setCurrentPage} />
            )}
          </div>
        </section>
      </main>

      {/* ══ DRAWER (unchanged functionality) ══ */}
      {selectedStudent && (
        <>
          <div className="drawer-backdrop" onClick={closeDrawer} />
          <aside className="admin-drawer">
            <div className="admin-drawer__header">
              <div>
                <p className="admin-drawer__eyebrow">Student Details</p>
                <h2>{selectedStudent.fullName}</h2>
                <span className="admin-drawer__subtext">{selectedStudent.email}</span>
              </div>
              <button type="button" className="drawer-close" onClick={closeDrawer}>✕</button>
            </div>

            <div className="admin-drawer__hero-block">
              <div className="student-photo-card">
                <div className="student-photo-preview student-photo-preview--interactive">
                  <Avatar name={selectedStudent.fullName} photoUrl={selectedStudent.photoUrl} size="hero" className="student-photo-avatar" />
                  <div className="student-photo-overlay">
                    <label className="student-photo-overlay__btn">
                      Upload
                      <input type="file" accept="image/*" className="file-input-hidden" onChange={e => handleStudentPhotoUpload(selectedStudent.id, e.target.files?.[0])} />
                    </label>
                    {selectedStudent.photoUrl && (
                      <button type="button" className="student-photo-overlay__btn student-photo-overlay__btn--danger" onClick={() => handleRemoveStudentPhoto(selectedStudent.id)}>Remove</button>
                    )}
                  </div>
                </div>
              </div>

              <div className="admin-drawer__hero-main">
                <div className="admin-drawer__hero--compact">
                  <div className="hero-stat"><span>Major</span><strong>{selectedStudent.major || 'N/A'}</strong></div>
                  <div className="hero-stat"><span>University</span><strong>{selectedStudent.university || 'N/A'}</strong></div>
                  <div className="hero-stat"><span>Applications</span><strong>{(selectedStudent.applications || []).length}</strong></div>
                  <div className="hero-stat"><span>Licenses</span><strong>{(selectedStudent.licenses || []).length}</strong></div>
                </div>
              </div>
            </div>

            <nav className="drawer-tabs">
              <button type="button" className={`drawer-tab ${activeTab === 'profile' ? 'drawer-tab--active' : ''}`} onClick={() => setActiveTab('profile')}>Profile Info</button>
              <button type="button" className={`drawer-tab ${activeTab === 'applications' ? 'drawer-tab--active' : ''}`} onClick={() => setActiveTab('applications')}>Applications ({(selectedStudent.applications || []).length})</button>
              <button type="button" className={`drawer-tab ${activeTab === 'licenses' ? 'drawer-tab--active' : ''}`} onClick={() => setActiveTab('licenses')}>Certifications ({(selectedStudent.licenses || []).length})</button>
            </nav>

            <div className="admin-drawer__content">
              {activeTab === 'profile' && (
                <div className="drawer-panel">
                  <div className="section-head">
                    <h3>Personal Information</h3>
                    <button type="button" className="solid-btn solid-btn--sm" onClick={() => setProfileModal({ open: true, studentId: selectedStudent.id })}>Edit Profile</button>
                  </div>
                  <div className="info-grid">
                    <div className="info-card info-card--with-toggle">
                      <div><span>Full Name</span><strong>{selectedStudent.fullName}</strong></div>
                      <VisibilityToggle value={selectedStudent.visibility?.profile || 'private'} onChange={v => handleSetVisibility(selectedStudent.id, 'profile', v)} />
                    </div>
                    <div className="info-card"><span>Email</span><strong>{selectedStudent.email || 'Not provided'}</strong></div>
                    <div className="info-card"><span>Phone</span><strong>{selectedStudent.phone || 'Not provided'}</strong></div>
                    <div className="info-card"><span>Gender</span><strong>{selectedStudent.gender || 'Not specified'}</strong></div>
                    <div className="info-card"><span>Major</span><strong>{selectedStudent.major || 'Not specified'}</strong></div>
                    <div className="info-card"><span>University</span><strong>{selectedStudent.university || 'Not specified'}</strong></div>
                  </div>
                  <div className="notes-block">
                    <div className="section-head"><h3>Admin Notes</h3></div>
                    <div className="notes-box"><textarea value={selectedStudent.notes || ''} placeholder="Internal staff notes..." onChange={e => handleUpdateNotes(selectedStudent.id, e.target.value)} /></div>
                  </div>
                  <button type="button" className="mini-btn mini-btn--danger" style={{ marginTop: '12px', alignSelf: 'flex-start' }} onClick={() => handleDeleteStudent(selectedStudent.id)}>Delete Student Profile</button>
                </div>
              )}

              {activeTab === 'applications' && (
                <div className="drawer-panel">
                  <div className="section-head">
                    <h3>University Applications</h3>
                    <button type="button" className="solid-btn solid-btn--sm" onClick={() => setAppModal({ open: true, studentId: selectedStudent.id, application: null })}>
                      <span className="btn-plus">+</span> Add Application
                    </button>
                  </div>
                  <div className="application-list">
                    {(selectedStudent.applications || []).length > 0 ? selectedStudent.applications.map(app => {
                      const isOpen = expandedApplications.includes(app.id)
                      return (
                        <article key={app.id} className={`application-card ${isOpen ? 'application-card--open' : ''}`}>
                          <button type="button" className="application-card__top" onClick={() => setExpandedApplications(p => p.includes(app.id) ? p.filter(id => id !== app.id) : [...p, app.id])}>
                            <div className="application-card__id">
                              <div className="application-card__logo">{(app.university || 'U')[0]}</div>
                              <div className="application-card__id-text"><h4>{app.university}</h4><p>{app.program || app.major || 'No program specified'}</p></div>
                            </div>
                            <div className="application-card__top-meta">
                              <StatusBadge variant={statusVariant(app.status)}>{app.status}</StatusBadge>
                              <span className="chevron">{isOpen ? '▲' : '▼'}</span>
                            </div>
                          </button>
                          {isOpen && (
                            <div className="application-card__expand">
                              <div className="application-toolbar">
                                <VisibilityToggle value={app.visibility || 'private'} onChange={v => handleSetApplicationVisibility(selectedStudent.id, app.id, v)} />
                                <div className="application-toolbar__actions">
                                  <button type="button" className="mini-btn" onClick={() => setAppModal({ open: true, studentId: selectedStudent.id, application: app })}>Edit</button>
                                  <button type="button" className="mini-btn mini-btn--danger" onClick={() => handleDeleteApplication(selectedStudent.id, app.id)}>Delete</button>
                                </div>
                              </div>
                              <div className="application-card__meta">
                                <div className="meta-cell"><span>Term</span><strong>{app.term || 'N/A'}</strong></div>
                                <div className="meta-cell"><span>Deadline</span><strong>{app.deadline || 'N/A'}</strong></div>
                                <div className="meta-cell"><span>Decision</span><strong>{app.decision || 'Pending'}</strong></div>
                                <div className="meta-cell"><span>Recommendation</span><strong>{app.recommendation || 'Pending'}</strong></div>
                              </div>
                              {app.notes && <div className="application-notes"><span>Notes</span><p>{app.notes}</p></div>}
                              <div className="doc-groups">
                                {DOC_CATEGORIES.map(cat => (
                                  <DocumentGroup key={cat.key} student={selectedStudent} application={app} category={cat} onUpload={handleUploadApplicationFile} onRemove={handleRemoveApplicationFile} onOpenInline={doc => window.open(doc.url, '_blank')} />
                                ))}
                              </div>
                            </div>
                          )}
                        </article>
                      )
                    }) : (
                      <div className="empty-state empty-state--cert"><div className="empty-state__icon">🗂️</div><h4>No applications added</h4><p>Click "+ Add Application" above to track a new university application.</p></div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'licenses' && (
                <div className="drawer-panel">
                  <div className="section-head">
                    <h3>Licenses &amp; Certifications</h3>
                    <button type="button" className="solid-btn solid-btn--sm" onClick={() => setLicenseModal({ open: true, studentId: selectedStudent.id, license: null })}>
                      <span className="btn-plus">+</span> Add Certification
                    </button>
                  </div>
                  {(selectedStudent.licenses || []).length > 0 ? (
                    <div className="cert-list">
                      {selectedStudent.licenses.map(cert => (
                        <article key={cert.id} className="cert-item">
                          <div className="cert-item__logo">{(cert.issuer || cert.name || 'C')[0]}</div>
                          <div className="cert-item__body">
                            <div className="cert-item__row">
                              <h4 className="cert-item__name">{cert.name}</h4>
                              <div className="cert-item__actions">
                                <VisibilityToggle value={cert.visibility || 'private'} onChange={v => handleSaveLicense(selectedStudent.id, { ...cert, visibility: v })} />
                                <button type="button" className="icon-btn" onClick={() => setLicenseModal({ open: true, studentId: selectedStudent.id, license: cert })}>✏️</button>
                                <button type="button" className="icon-btn icon-btn--danger" onClick={() => handleDeleteLicense(selectedStudent.id, cert.id)}>🗑️</button>
                              </div>
                            </div>
                            {cert.issuer && <p className="cert-item__issuer">{cert.issuer}</p>}
                            <p className="cert-item__meta">
                              {(cert.issueMonth || cert.issueYear) && <span>Issued {cert.issueMonth} {cert.issueYear}</span>}
                              {(cert.expireMonth || cert.expireYear) && <span> · Expires {cert.expireMonth} {cert.expireYear}</span>}
                            </p>
                            {cert.credentialId && <p className="cert-item__cred">Credential ID: <strong>{cert.credentialId}</strong></p>}
                            {cert.credentialUrl && <div className="cert-item__foot"><a href={cert.credentialUrl} target="_blank" rel="noreferrer" className="pill-link">Show credential ↗</a></div>}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state empty-state--cert"><div className="empty-state__icon">📜</div><h4>No certifications added</h4><p>Click "+ Add Certification" to add licenses or test scores.</p></div>
                  )}
                </div>
              )}
            </div>
          </aside>
        </>
      )}

      <ProfileModal open={profileModal.open} student={profileModalStudent} onClose={() => setProfileModal({ open: false, studentId: null })} onSave={handleSaveProfile} />
      <ApplicationModal open={appModal.open} studentId={appModal.studentId} application={appModal.application} onClose={() => setAppModal({ open: false, studentId: null, application: null })} onSave={handleSaveApplication} />
      <LicenseModal open={licenseModal.open} studentId={licenseModal.studentId} license={licenseModal.license} onClose={() => setLicenseModal({ open: false, studentId: null, license: null })} onSave={handleSaveLicense} />
      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} notifications={notifications} settings={notifSettings} onToggleSetting={toggleNotifSetting} onApproveRequest={approveVisibilityRequest} onDeclineRequest={declineVisibilityRequest} onMarkRead={markNotificationRead} onClearResolved={clearResolvedNotifications} />
    </div>
  )
}
