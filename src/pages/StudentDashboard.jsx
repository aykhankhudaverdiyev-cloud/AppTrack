import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import LicenseMediaItem from '../components/LicenseMediaItem'
import {
  getPublicStudents,
  setVisibility,
  setPhoto,
  removePhoto,
  setProfile,
  saveApplication,
  deleteApplication,
  setApplicationVisibility,
  uploadApplicationFile,
  removeApplicationFile,
  setApplicationDocumentVisibility,
  saveLicense,
  deleteLicense,
  setLicenseVisibility,
  uploadLicenseMediaFile,
  deleteLicenseMediaFile,
  onDataChanged,
  offDataChanged,
} from '../store/studentsStore'
import { uploadAvatar, removeAvatar } from '../Services/StorageService'
import Avatar from '../components/Avatar'
import VisibilityToggle from '../components/VisibilityToggle'
import VisibilityChip from '../components/VisibilityChip'
import StatusBadge from '../components/StatusBadge'
import DocumentGroup from '../components/DocumentGroup'
import ApplicationModal from '../components/ApplicationModal'
import LicenseModal from '../components/LicenseModal'
import PublicStudentDrawer from '../components/PublicStudentDrawer'
import StudentCard from '../components/StudentCard'
import './StudentDashboard.css'

const DOC_CATEGORIES = [
  { key: 'transcript', label: 'Transcript' },
  { key: 'recommendation', label: 'Recommendation' },
  { key: 'resume', label: 'Resume / CV' },
  { key: 'statement', label: 'Statement of Purpose' },
  { key: 'test_score', label: 'Test Score' },
  { key: 'other', label: 'Other' },
]

// Tab structure matching the example design
const TAB_GROUPS = [
  {
    label: 'Main',
    tabs: [
      { key: 'overview', label: 'Overview' },
      { key: 'profile', label: 'My Profile' },
    ],
  },
  {
    label: 'Academic',
    tabs: [
      { key: 'education', label: 'Education' },
      { key: 'skills', label: 'Skills' },
      { key: 'projects', label: 'Projects' },
    ],
  },
  {
    label: 'Career',
    tabs: [
      { key: 'applications', label: 'Applications' },
      { key: 'documents', label: 'Documents' },
      { key: 'portfolio', label: 'Portfolio' },
      { key: 'licenses', label: 'Certificates' },
      { key: 'experience', label: 'Experience' },
    ],
  },
  {
    label: 'Social',
    tabs: [
      { key: 'explore', label: 'Explore' },
      { key: 'activity', label: 'Activity' },
    ],
  },
]

// LocalStorage-backed persistence for optional student-managed content
function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw)
  } catch {}
  return fallback
}
function saveLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

export default function StudentDashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [me, setMe] = useState({
    id: '', fullName: '', email: '', phone: '', major: '', university: '',
    gender: '', photoUrl: '', photoPath: '', notes: '', assignedCounselor: '',
    decision: '', visibility: {}, applications: [], licenses: [],
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [publicStudents, setPublicStudents] = useState([])
  const [selectedPublicStudent, setSelectedPublicStudent] = useState(null)
  const [publicStudentActiveTab, setPublicStudentActiveTab] = useState('profile')
  const [expandedPublicApplications, setExpandedPublicApplications] = useState([])

  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [editingContact, setEditingContact] = useState(false)
  const [contactDraft, setContactDraft] = useState({ email: '', phone: '' })

  const [appModal, setAppModal] = useState({ open: false, application: null })
  const [licenseModal, setLicenseModal] = useState({ open: false, license: null })
  const [expandedApplications, setExpandedApplications] = useState([])

  // Student-managed lightweight sections (persisted locally)
  const [skills, setSkills] = useState(() => loadLS(`apptrack.skills.${user?.id}`, []))
  const [projects, setProjects] = useState(() => loadLS(`apptrack.projects.${user?.id}`, []))
  const [portfolio, setPortfolio] = useState(() => loadLS(`apptrack.portfolio.${user?.id}`, []))
  const [education, setEducation] = useState(() => loadLS(`apptrack.education.${user?.id}`, []))
  const [experience, setExperience] = useState(() => loadLS(`apptrack.experience.${user?.id}`, []))

  useEffect(() => { if (user?.id) saveLS(`apptrack.skills.${user.id}`, skills) }, [skills, user?.id])
  useEffect(() => { if (user?.id) saveLS(`apptrack.projects.${user.id}`, projects) }, [projects, user?.id])
  useEffect(() => { if (user?.id) saveLS(`apptrack.portfolio.${user.id}`, portfolio) }, [portfolio, user?.id])
  useEffect(() => { if (user?.id) saveLS(`apptrack.education.${user.id}`, education) }, [education, user?.id])
  useEffect(() => { if (user?.id) saveLS(`apptrack.experience.${user.id}`, experience) }, [experience, user?.id])

  const startEditingContact = useCallback(() => {
    setContactDraft({ email: me.email, phone: me.phone })
    setEditingContact(true)
  }, [me.email, me.phone])

  const publicApplicationsCount = useMemo(
    () => (me.applications || []).filter(a => a.visibility === 'public').length,
    [me.applications]
  )
  const publicLicensesCount = useMemo(
    () => (me.licenses || []).filter(l => l.visibility === 'public').length,
    [me.licenses]
  )

  const profileCompletion = useMemo(() => {
    const fields = [me.fullName, me.email, me.phone, me.major, me.university, me.gender, me.photoUrl]
    return Math.round((fields.filter(Boolean).length / fields.length) * 100)
  }, [me])

  const appProgress = useMemo(() => {
    const apps = me.applications || []
    if (!apps.length) return 0
    const done = apps.filter(a => ['Submitted', 'In Review', 'Closed'].includes(a.status)).length
    return Math.round((done / apps.length) * 100)
  }, [me.applications])

  const loadMyProfile = useCallback(async () => {
    if (!user?.id) return
    try {
      const { data: profileData, error: profileError } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (profileError) throw profileError

      const { data: appsData, error: appsError } = await supabase
        .from('applications')
        .select(`id,student_id,university,program,major,term,deadline,status,decision,recommendation,notes,visibility,created_at,application_documents(id,application_id,user_id,category,name,file_path,file_url,size,visibility,created_at)`)
        .eq('student_id', user.id).order('created_at', { ascending: false })
      if (appsError) throw appsError

      const { data: licData, error: licError } = await supabase
        .from('licenses')
        .select(`id,user_id,name,issuer,issue_month,issue_year,expire_month,expire_year,credential_id,credential_url,score,visibility,created_at,license_media(id,license_id,name,file_path,file_url,size,created_at)`)
        .eq('user_id', user.id).order('created_at', { ascending: false })
      if (licError) throw licError

      const data = { ...profileData, applications: appsData || [], licenses: licData || [] }
      const visibility = {
        profile: data.profile_visibility || 'private',
        photo: data.photo_visibility || 'private',
        email: data.email_visibility || 'private',
        phone: data.phone_visibility || 'private',
        notes: data.notes_visibility || 'private',
      }

      const applications = (data.applications || []).map(app => {
        const docsByCategory = (app.application_documents || []).reduce((acc, doc) => {
          const cat = doc.category || 'other'
          if (!acc[cat]) acc[cat] = []
          acc[cat].push({ id: doc.id, name: doc.name || 'Document.pdf', path: doc.file_path || '', url: doc.file_url || '', size: doc.size || 0, visibility: doc.visibility || 'private', created_at: doc.created_at || '', application_id: doc.application_id || '', category: cat })
          return acc
        }, {})
        return { id: app.id, student_id: app.student_id, university: app.university || '', program: app.program || '', major: app.major || '', term: app.term || '', deadline: app.deadline || '', status: app.status || 'Not Started', decision: app.decision || 'Pending', recommendation: app.recommendation || 'Pending', notes: app.notes || '', visibility: app.visibility || 'private', created_at: app.created_at || '', documents: docsByCategory }
      })

      const licenses = (data.licenses || []).map(lic => {
        const media = (lic.license_media || []).map(m => ({ id: m.id, license_id: m.license_id, name: m.name || 'Document', filePath: m.file_path || '', url: m.file_url || '', size: m.size || 0, created_at: m.created_at }))
        return { id: lic.id, user_id: lic.user_id, name: lic.name || '', issuer: lic.issuer || '', issueMonth: lic.issue_month || '', issueYear: lic.issue_year || '', expireMonth: lic.expire_month || '', expireYear: lic.expire_year || '', credentialId: lic.credential_id || '', credentialUrl: lic.credential_url || '', score: lic.score || '', visibility: lic.visibility || 'private', media, created_at: lic.created_at || '' }
      })

      setMe({ id: data.id, fullName: data.full_name || '', email: data.email || '', phone: data.phone || '', major: data.major || '', university: data.university || '', gender: data.gender || '', photoUrl: data.photo_url || '', photoPath: data.photo_path || '', notes: data.admin_notes || '', assignedCounselor: data.assigned_counselor || '', decision: data.decision || '', visibility, applications, licenses })
    } catch (error) {
      console.error('Failed to load profile:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  const loadPublicStudents = useCallback(async () => {
    try {
      const publicData = await getPublicStudents()
      setPublicStudents(publicData.filter(s => s.id !== user?.id))
    } catch (error) { console.error(error) }
  }, [user?.id])

  const togglePublicApplicationExpanded = useCallback(id => {
    setExpandedPublicApplications(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  }, [])

  useEffect(() => {
    loadMyProfile()
    loadPublicStudents()
    const channel = supabase.channel('student-dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user?.id}` }, loadMyProfile)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications', filter: `student_id=eq.${user?.id}` }, loadMyProfile)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'application_documents', filter: `user_id=eq.${user?.id}` }, loadMyProfile)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'licenses', filter: `user_id=eq.${user?.id}` }, loadMyProfile)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'license_media', filter: `user_id=eq.${user?.id}` }, loadMyProfile)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `profile_visibility=eq.public` }, loadPublicStudents)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications', filter: `visibility=eq.public` }, loadPublicStudents)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'licenses', filter: `visibility=eq.public` }, loadPublicStudents)
      .subscribe()
    const handler = () => { loadMyProfile(); loadPublicStudents() }
    onDataChanged(handler)
    return () => { supabase.removeChannel(channel); offDataChanged(handler) }
  }, [user?.id, loadMyProfile, loadPublicStudents])

  const handleProfileVisibility = useCallback(async (key, value) => {
    if (!user?.id) return
    setMe(p => ({ ...p, visibility: { ...p.visibility, [key]: value } }))
    try { await setVisibility(user.id, key, value) } catch (e) { console.error(e); loadMyProfile() }
  }, [user?.id, loadMyProfile])

  const handleApplicationVisibility = useCallback(async (appId, value) => {
    if (!user?.id) return
    setMe(p => ({ ...p, applications: (p.applications || []).map(a => a.id === appId ? { ...a, visibility: value } : a) }))
    try { await setApplicationVisibility(user.id, appId, value) } catch (e) { console.error(e); loadMyProfile() }
  }, [user?.id, loadMyProfile])

  const handleLicenseVisibility = useCallback(async (id, value) => {
    if (!user?.id) return
    setMe(p => ({ ...p, licenses: (p.licenses || []).map(l => l.id === id ? { ...l, visibility: value } : l) }))
    try { await setLicenseVisibility(user.id, id, value) } catch (e) { console.error(e); loadMyProfile() }
  }, [user?.id, loadMyProfile])

  const handleDocumentVisibility = useCallback(async (docId, value) => {
    if (!user?.id) return
    setMe(p => ({ ...p, applications: (p.applications || []).map(a => ({ ...a, documents: Object.fromEntries(Object.entries(a.documents || {}).map(([c, ds]) => [c, (ds || []).map(d => d.id === docId ? { ...d, visibility: value } : d)])) })) }))
    try { await setApplicationDocumentVisibility(user.id, docId, value) } catch (e) { console.error(e); loadMyProfile() }
  }, [user?.id, loadMyProfile])

  const handlePhotoUpload = useCallback(async file => {
    if (!user?.id || !file) return
    try { const r = await uploadAvatar(user.id, file); await setPhoto(user.id, r.url, r.path); setMe(p => ({ ...p, photoUrl: r.url, photoPath: r.path })) } catch (e) { console.error(e) }
  }, [user?.id])

  const handleRemovePhoto = useCallback(async () => {
    if (!user?.id) return
    try { if (me.photoPath) await removeAvatar(me.photoPath); await removePhoto(user.id); setMe(p => ({ ...p, photoUrl: '', photoPath: '' })) } catch (e) { console.error(e) }
  }, [user?.id, me.photoPath])

  const saveName = useCallback(async () => {
    if (!user?.id || !nameDraft.trim()) return
    try { await setProfile(user.id, { fullName: nameDraft.trim() }); setMe(p => ({ ...p, fullName: nameDraft.trim() })); setEditingName(false) } catch (e) { console.error(e) }
  }, [user?.id, nameDraft])

  const saveContact = useCallback(async () => {
    if (!user?.id) return
    try { await setProfile(user.id, { email: contactDraft.email, phone: contactDraft.phone }); setMe(p => ({ ...p, email: contactDraft.email, phone: contactDraft.phone })); setEditingContact(false) } catch (e) { console.error(e) }
  }, [user?.id, contactDraft])

  const handleSaveApplication = useCallback(async payload => {
    if (!user?.id) return
    try { await saveApplication(user.id, payload); await loadMyProfile(); setAppModal({ open: false, application: null }) } catch (e) { console.error(e); throw e }
  }, [user?.id, loadMyProfile])

  const handleDeleteApplication = useCallback(async id => {
    if (!user?.id) return
    try { await deleteApplication(user.id, id); await loadMyProfile() } catch (e) { console.error(e) }
  }, [user?.id, loadMyProfile])

  const handleApplicationDocumentUpload = useCallback(async (sid, aid, cat, file) => {
    if (!user?.id) return
    try { await uploadApplicationFile(user.id, aid, cat, file); await loadMyProfile() } catch (e) { console.error(e); throw e }
  }, [user?.id, loadMyProfile])

  const handleApplicationDocumentRemove = useCallback(async (sid, aid, cat, docId) => {
    if (!user?.id) return
    try {
      await removeApplicationFile(user.id, aid, cat, docId)
      setMe(p => ({ ...p, applications: (p.applications || []).map(a => { if (a.id !== aid) return a; const d = a.documents || {}; return { ...a, documents: { ...d, [cat]: (d[cat] || []).filter(x => x.id !== docId) } } }) }))
      await loadMyProfile()
    } catch (e) { console.error(e) }
  }, [user?.id, loadMyProfile])

  const handleSaveLicense = useCallback(async payload => {
    if (!user?.id) return
    try { await saveLicense(user.id, payload); await loadMyProfile(); setLicenseModal({ open: false, license: null }) } catch (e) { console.error(e); throw e }
  }, [user?.id, loadMyProfile])

  const handleDeleteLicense = useCallback(async id => {
    if (!user?.id) return
    try { await deleteLicense(user.id, id); await loadMyProfile() } catch (e) { console.error(e) }
  }, [user?.id, loadMyProfile])

  const handleLicenseMediaUpload = useCallback(async (lid, file) => {
    if (!user?.id) return
    try { await uploadLicenseMediaFile(user.id, lid, file); await loadMyProfile() } catch (e) { console.error(e); throw e }
  }, [user?.id, loadMyProfile])

  const handleLicenseMediaRemove = useCallback(async id => {
    if (!user?.id) return
    try { await deleteLicenseMediaFile(user.id, id); await loadMyProfile() } catch (e) { console.error(e) }
  }, [user?.id, loadMyProfile])

  const toggleApplicationExpanded = useCallback(id => {
    setExpandedApplications(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  }, [])

  const handleSignOut = useCallback(async () => { await signOut(); navigate('/login') }, [signOut, navigate])

  // Simple add handlers for the light sections
  const addSkill = () => { const s = window.prompt('Add a skill (e.g., Python, Public speaking)'); if (s?.trim()) setSkills(prev => [...prev, { id: Date.now(), name: s.trim() }]) }
  const removeSkill = id => setSkills(prev => prev.filter(s => s.id !== id))

  const addProject = () => {
    const name = window.prompt('Project name?'); if (!name?.trim()) return
    const desc = window.prompt('Short description (optional)') || ''
    const url = window.prompt('URL (optional)') || ''
    setProjects(prev => [...prev, { id: Date.now(), name: name.trim(), description: desc, url }])
  }
  const removeProject = id => setProjects(prev => prev.filter(p => p.id !== id))

  const addPortfolioLink = () => {
    const label = window.prompt('Link label (e.g., GitHub, Behance)'); if (!label?.trim()) return
    const url = window.prompt('URL (https://...)'); if (!url?.trim()) return
    setPortfolio(prev => [...prev, { id: Date.now(), label: label.trim(), url: url.trim() }])
  }
  const removePortfolioLink = id => setPortfolio(prev => prev.filter(p => p.id !== id))

  const addEducation = () => {
    const school = window.prompt('School/University name?'); if (!school?.trim()) return
    const degree = window.prompt('Degree (optional)') || ''
    const years = window.prompt('Years (e.g., 2020 - 2024)') || ''
    setEducation(prev => [...prev, { id: Date.now(), school: school.trim(), degree, years }])
  }
  const removeEducation = id => setEducation(prev => prev.filter(e => e.id !== id))

  const addExperience = () => {
    const role = window.prompt('Role/Position?'); if (!role?.trim()) return
    const company = window.prompt('Company/Organization') || ''
    const period = window.prompt('Period (e.g., Jun 2024 - Present)') || ''
    setExperience(prev => [...prev, { id: Date.now(), role: role.trim(), company, period }])
  }
  const removeExperience = id => setExperience(prev => prev.filter(e => e.id !== id))

  if (loading) return null

  const initials = (me.fullName || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
  const firstName = me.fullName?.split(' ')[0] || 'Student'

  return (
    <div className="app-shell student-shell">
      <div className="ambient ambient--one" />
      <div className="ambient ambient--two" />

      {/* ═══ HEADER ═══ */}
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
                <span className="new-header__brand-badge new-header__brand-badge--student">Student</span>
              </div>
              <p className="new-header__brand-subtitle">Manage profile · applications · certs</p>
            </div>
          </div>

          <nav className="new-header__nav">
            <button type="button" className="new-header__nav-btn" onClick={() => navigate('/')}>🏠 Home</button>
            <button type="button" className={`new-header__nav-btn ${activeTab === 'profile' ? 'new-header__nav-btn--active' : ''}`} onClick={() => setActiveTab('profile')}>👤 My Profile</button>

            <button type="button" className="new-header__profile-card" onClick={() => setActiveTab('profile')} title="View your profile">
              <div className="new-header__profile-avatar">
                {me.photoUrl ? <img src={me.photoUrl} alt={me.fullName} /> : <span>{initials}</span>}
              </div>
              <div className="new-header__profile-meta">
                <strong>{me.fullName || 'Student'}</strong>
                {me.major && <small>{me.major}</small>}
              </div>
              <VisibilityChip value={me.visibility?.profile} />
            </button>

            <div className="new-header__divider" />
            <button type="button" className="new-header__signout" onClick={handleSignOut}>🚪 Sign out</button>
            <div className="new-header__explore-wrap">
              <button type="button" className="new-header__explore-btn" onClick={() => setActiveTab('explore')}>
                🔍 <span>Explore</span> →
              </button>
            </div>
          </nav>
        </div>
      </header>

      <main className="dashboard-content">
        {/* Page Title */}
        <section className="new-page-title">
          <div>
            <div className="new-page-title__eyebrow">
              <span className="new-page-title__line" />
              Student Dashboard
            </div>
            <h2 className="new-page-title__h2">Welcome back, {firstName} 👋</h2>
            <p className="new-page-title__sub">Manage your own profile, applications and certifications.</p>
          </div>
          <button type="button" className="new-header__explore-btn new-header__explore-btn--mobile" onClick={() => setActiveTab('explore')}>
            🔍 Explore Students
          </button>
        </section>

        {/* ═══ HERO CARD ═══ */}
        <section className="new-hero-card">
          <div className="new-hero-card__cover">
            <div className="new-hero-card__cover-dots" />
            <div className="new-hero-card__cover-top-left">
              <span className="new-hero-card__active-badge">
                <span className="new-hero-card__active-dot" /> Active
              </span>
            </div>
            <div className="new-hero-card__cover-top-right">
              <span className="new-hero-card__private-badge">
                {me.visibility?.profile === 'public' ? '🌐 Public' : '🔒 Private'}
              </span>
            </div>
          </div>

          <div className="new-hero-card__body">
            {/* Avatar floating */}
            <div className="new-hero-card__avatar-block">
              <div className="student-photo-preview student-photo-preview--interactive new-hero-card__avatar-preview">
                <Avatar name={me.fullName} photoUrl={me.photoUrl} size="xl" className="student-photo-avatar new-hero-card__avatar-img" />
                <div className="student-photo-overlay">
                  <button type="button" className="student-photo-overlay__btn" onClick={() => document.getElementById('me-photo-input')?.click()}>
                    {me.photoUrl ? 'Replace' : 'Upload'}
                  </button>
                  {me.photoUrl && (
                    <button type="button" className="student-photo-overlay__btn student-photo-overlay__btn--danger" onClick={handleRemovePhoto}>Remove</button>
                  )}
                </div>
                <input id="me-photo-input" type="file" accept="image/*" className="file-input-hidden"
                  onChange={e => { handlePhotoUpload(e.target.files?.[0] || null); e.target.value = '' }} />
              </div>
              <div className="new-hero-card__avatar-online" />
            </div>

            <div className="new-hero-card__main">
              <div className="new-hero-card__info">
                <div className="new-hero-card__name-row">
                  {editingName ? (
                    <>
                      <input className="inline-input inline-input--lg" value={nameDraft} onChange={e => setNameDraft(e.target.value)} autoFocus />
                      <button type="button" className="solid-btn solid-btn--sm" onClick={saveName}>Save</button>
                      <button type="button" className="ghost-btn solid-btn--sm" onClick={() => setEditingName(false)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <h3 className="new-hero-card__name">{me.fullName}</h3>
                      <button type="button" className="new-hero-card__edit-btn" title="Edit name" onClick={() => { setNameDraft(me.fullName); setEditingName(true) }}>✎</button>
                    </>
                  )}
                </div>
                <p className="new-hero-card__sub">
                  {me.major || 'Major not set yet'}{me.university ? ` · ${me.university}` : ' · Add details below'}
                </p>

                <div className="new-hero-card__privacy-row">
                  <div className="new-hero-card__privacy-item">
                    <span className="new-hero-card__privacy-label">🔒 Profile:</span>
                    <VisibilityToggle value={me.visibility?.profile || 'private'} onChange={v => handleProfileVisibility('profile', v)} />
                  </div>
                  <div className="new-hero-card__privacy-item">
                    <span className="new-hero-card__privacy-label">👁️ Photo:</span>
                    <VisibilityToggle value={me.visibility?.photo || 'private'} onChange={v => handleProfileVisibility('photo', v)} />
                  </div>
                </div>
              </div>

              <div className="new-hero-card__actions">
                <button type="button" className="ghost-btn" onClick={() => setActiveTab('explore')}>Preview Public View</button>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ STAT CARDS ═══ */}
        <section className="new-stats-grid">
          {[
            { label: 'Profile', value: `${profileCompletion}%`, icon: '📈', tone: 'indigo', hint: 'completion score' },
            { label: 'Applications', value: (me.applications || []).length, icon: '📄', tone: 'sky', hint: 'submitted total' },
            { label: 'Public Apps', value: publicApplicationsCount, icon: '👁️', tone: 'emerald', hint: 'visible to others' },
            { label: 'Certifications', value: (me.licenses || []).length, icon: '🏆', tone: 'amber', hint: 'earned so far' },
            { label: 'Public Certs', value: publicLicensesCount, icon: '🏆', tone: 'rose', hint: 'shared publicly' },
            { label: 'App Progress', value: `${appProgress}%`, icon: '⚡', tone: 'violet', hint: 'in progress' },
          ].map(s => (
            <div key={s.label} className={`new-stat-card new-stat-card--${s.tone}`}>
              <div className="new-stat-card__icon-wrap"><span className="new-stat-card__icon">{s.icon}</span></div>
              <p className="new-stat-card__label">{s.label}</p>
              <p className="new-stat-card__value">{s.value}</p>
              <p className="new-stat-card__hint">{s.hint}</p>
            </div>
          ))}
        </section>

        {/* ═══ GROUPED TABS ═══ */}
        <section className="new-tabs-wrap">
          <div className="new-tabs-scroll">
            {TAB_GROUPS.map(group => (
              <div key={group.label} className="new-tab-group">
                <div className="new-tab-group__label">{group.label}</div>
                <div className="new-tab-group__pills">
                  {group.tabs.map(tab => (
                    <button
                      key={tab.key}
                      type="button"
                      className={`new-tab-pill ${activeTab === tab.key ? 'new-tab-pill--active' : ''}`}
                      onClick={() => setActiveTab(tab.key)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ TAB CONTENT ═══ */}

        {activeTab === 'overview' && (
          <div className="new-profile-grid">
            <div className="new-profile-main">
              <div className="new-section-card">
                <div className="new-section-card__head">
                  <div>
                    <h3>Overview</h3>
                    <p className="new-section-card__sub">Your academic profile, application progress and next steps.</p>
                  </div>
                </div>
                <div className="new-overview-grid">
                  <div className="new-overview-item new-overview-item--indigo">
                    <div className="new-overview-item__top">
                      <p className="new-overview-item__label">Profile completion</p>
                      <span className="new-overview-item__badge new-overview-item__badge--amber">{profileCompletion}%</span>
                    </div>
                    <div className="new-progress-bar"><div className="new-progress-bar__fill new-progress-bar__fill--indigo" style={{ width: `${profileCompletion}%` }} /></div>
                    <p className="new-overview-item__hint">Complete more sections to build a stronger profile.</p>
                  </div>
                  <div className="new-overview-item new-overview-item--sky">
                    <div className="new-overview-item__top">
                      <p className="new-overview-item__label">Application progress</p>
                      <span className="new-overview-item__badge new-overview-item__badge--slate">{appProgress}%</span>
                    </div>
                    <div className="new-progress-bar"><div className="new-progress-bar__fill new-progress-bar__fill--sky" style={{ width: `${appProgress}%` }} /></div>
                    <p className="new-overview-item__hint">Add an application to start tracking progress.</p>
                  </div>
                </div>
              </div>

              {/* Quick Profile */}
              <div className="new-section-card">
                <div className="new-section-card__head">
                  <div>
                    <h3>Quick profile</h3>
                    <p className="new-section-card__sub">Key academic information.</p>
                  </div>
                </div>
                <div className="new-quick-grid">
                  <QuickItem icon="🏫" label="University" value={me.university} placeholder="Add university (admin-managed)" muted />
                  <QuickItem icon="📚" label="Major" value={me.major} placeholder="Add major (admin-managed)" muted />
                  <QuickItem icon="🧑‍🏫" label="Assigned Mentor" value={me.assignedCounselor || 'Not assigned'} muted />
                  <QuickItem icon="✅" label="Overall Decision" value={me.decision || 'Pending'} isDecision />
                </div>
              </div>
            </div>

            <div className="new-profile-side">
              <div className="new-section-card new-section-card--side">
                <div className="new-section-card__head">
                  <div className="new-next-steps__icon-wrap"><span>＋</span></div>
                  <div>
                    <h3>Next steps</h3>
                    <p className="new-section-card__sub">Complete the items that matter most</p>
                  </div>
                </div>
                <div className="new-next-steps__list">
                  {[
                    { title: 'Add your education history', time: '~5 min', icon: '🎓', tab: 'education' },
                    { title: 'Add your first project', time: '~3 min', icon: '📄', tab: 'projects' },
                    { title: 'Add a portfolio link', time: '~1 min', icon: '🌐', tab: 'portfolio' },
                    { title: 'Add your skills', time: '~2 min', icon: '🏆', tab: 'skills' },
                  ].map(step => (
                    <button key={step.title} type="button" className="new-next-step-btn" onClick={() => setActiveTab(step.tab)}>
                      <span className="new-next-step-btn__icon">{step.icon}</span>
                      <div className="new-next-step-btn__body">
                        <p className="new-next-step-btn__title">{step.title}</p>
                        <p className="new-next-step-btn__time">{step.time}</p>
                      </div>
                      <span className="new-next-step-btn__arrow">›</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="new-explore-card">
                <div className="new-explore-card__bg" />
                <div className="new-explore-card__content">
                  <div className="new-explore-card__icon-wrap"><span>👥</span></div>
                  <div>
                    <p className="new-explore-card__eyebrow">Discover</p>
                    <h3 className="new-explore-card__title">Student Directory</h3>
                  </div>
                </div>
                <p className="new-explore-card__desc">Find classmates, view profiles, and connect with peers across your workspace network.</p>
                <button type="button" className="new-explore-card__btn" onClick={() => setActiveTab('explore')}>
                  Browse Directory <span>→</span>
                </button>
                <div className="new-explore-card__footer">
                  <div className="new-explore-card__avatars">
                    {[...Array(3)].map((_, i) => <div key={i} className="new-explore-card__avatar-dot" />)}
                  </div>
                  <span className="new-explore-card__online">+{publicStudents.length} public profiles</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="new-profile-grid">
            <div className="new-profile-main">
              <div className="new-section-card">
                <div className="new-section-card__head">
                  <div>
                    <h3>Contact Details</h3>
                    <p className="new-section-card__sub">Freely edit your email & phone and set each public or private.</p>
                  </div>
                  {editingContact ? (
                    <div className="section-head__btns">
                      <button type="button" className="ghost-btn solid-btn--sm" onClick={() => setEditingContact(false)}>Cancel</button>
                      <button type="button" className="solid-btn solid-btn--sm" onClick={saveContact}>Save</button>
                    </div>
                  ) : (
                    <button type="button" className="solid-btn solid-btn--sm" onClick={startEditingContact}>✎ Edit</button>
                  )}
                </div>
                <div className="info-grid">
                  <div className="info-card info-card--with-toggle">
                    <div className="info-card__main">
                      <span>Email</span>
                      {editingContact
                        ? <input className="inline-input" type="email" value={contactDraft.email} onChange={e => setContactDraft(d => ({ ...d, email: e.target.value }))} />
                        : <strong>{me.email}</strong>}
                    </div>
                    <VisibilityToggle value={me.visibility?.email || 'private'} onChange={v => handleProfileVisibility('email', v)} />
                  </div>
                  <div className="info-card info-card--with-toggle">
                    <div className="info-card__main">
                      <span>Phone</span>
                      {editingContact
                        ? <input className="inline-input" value={contactDraft.phone} onChange={e => setContactDraft(d => ({ ...d, phone: e.target.value }))} />
                        : <strong>{me.phone}</strong>}
                    </div>
                    <VisibilityToggle value={me.visibility?.phone || 'private'} onChange={v => handleProfileVisibility('phone', v)} />
                  </div>
                </div>
              </div>

              <div className="new-section-card">
                <div className="new-section-card__head">
                  <div>
                    <h3>Profile Information</h3>
                    <p className="new-section-card__sub">Academic details are managed by your admin/counselor.</p>
                  </div>
                </div>
                <div className="info-grid">
                  <div className="info-card"><span>Full Name</span><strong>{me.fullName}</strong></div>
                  <div className="info-card"><span>Major</span><strong>{me.major || '—'}</strong></div>
                  <div className="info-card"><span>University</span><strong>{me.university || '—'}</strong></div>
                  <div className="info-card"><span>Gender</span><strong>{me.gender || '—'}</strong></div>
                  <div className="info-card info-card--readonly">
                    <span>Assigned Counselor <em className="readonly-tag">read-only</em></span>
                    <strong>{me.assignedCounselor || '—'}</strong>
                  </div>
                  <div className="info-card info-card--readonly">
                    <span>Overall Decision <em className="readonly-tag">read-only</em></span>
                    <strong>{me.decision || '—'}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="new-profile-side">
              <div className="new-section-card new-section-card--side">
                <div className="new-section-card__head"><div><h3>Snapshot</h3><p className="new-section-card__sub">Your at-a-glance stats</p></div></div>
                <div className="new-snapshot">
                  <div><span>Applications</span><strong>{(me.applications || []).length}</strong></div>
                  <div><span>Public apps</span><strong>{publicApplicationsCount}</strong></div>
                  <div><span>Certifications</span><strong>{(me.licenses || []).length}</strong></div>
                  <div><span>Public certs</span><strong>{publicLicensesCount}</strong></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'education' && (
          <SimpleListSection
            title="Education"
            subtitle="Schools, universities, degrees and years."
            emptyIcon="🎓"
            emptyTitle="No education added"
            emptyDesc="Add your school or university."
            addLabel="Add education"
            onAdd={addEducation}
            items={education}
            renderItem={e => (
              <div className="simple-item">
                <div className="simple-item__logo">🎓</div>
                <div className="simple-item__body">
                  <h4>{e.school}</h4>
                  <p>{[e.degree, e.years].filter(Boolean).join(' · ')}</p>
                </div>
                <button type="button" className="icon-btn icon-btn--danger" onClick={() => removeEducation(e.id)}>🗑</button>
              </div>
            )}
          />
        )}

        {activeTab === 'skills' && (
          <section className="students-section">
            <div className="section-head section-head--stack">
              <div>
                <h3>Skills</h3>
                <p className="section-head__sub">Tag the skills that describe you best.</p>
              </div>
              <button type="button" className="solid-btn solid-btn--sm" onClick={addSkill}>＋ Add skill</button>
            </div>
            {skills.length === 0 ? (
              <div className="empty-state empty-state--cert">
                <div className="empty-state__icon">🏷️</div>
                <h4>No skills yet</h4>
                <p>Add tags like "Python", "Public speaking", "Photoshop".</p>
              </div>
            ) : (
              <div className="new-chip-grid">
                {skills.map(s => (
                  <span key={s.id} className="new-skill-chip">
                    {s.name}
                    <button type="button" onClick={() => removeSkill(s.id)}>✕</button>
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'projects' && (
          <SimpleListSection
            title="Projects"
            subtitle="Notable projects you've built or led."
            emptyIcon="🛠️"
            emptyTitle="No projects yet"
            emptyDesc="Add your first project."
            addLabel="Add project"
            onAdd={addProject}
            items={projects}
            renderItem={p => (
              <div className="simple-item">
                <div className="simple-item__logo">🛠️</div>
                <div className="simple-item__body">
                  <h4>{p.name}</h4>
                  {p.description && <p>{p.description}</p>}
                  {p.url && <a className="pill-link" href={p.url} target="_blank" rel="noreferrer">Open ↗</a>}
                </div>
                <button type="button" className="icon-btn icon-btn--danger" onClick={() => removeProject(p.id)}>🗑</button>
              </div>
            )}
          />
        )}

        {activeTab === 'applications' && (
          <section className="students-section">
            <div className="section-head section-head--stack">
              <div>
                <h3>My Applications</h3>
                <p className="section-head__sub">Add, edit, upload PDFs, and choose what is public.</p>
              </div>
              <button type="button" className="solid-btn solid-btn--sm" onClick={() => setAppModal({ open: true, application: null })}>
                <span className="btn-plus">＋</span> New application
              </button>
            </div>
            <div className="application-list">
              {(me.applications || []).map(application => {
                const expanded = expandedApplications.includes(application.id)
                return (
                  <div key={application.id} className={`application-card ${expanded ? 'application-card--open' : ''}`}>
                    <button type="button" className="application-card__top" onClick={() => toggleApplicationExpanded(application.id)}>
                      <div className="application-card__id">
                        <div className="application-card__logo">{application.university?.[0] || 'U'}</div>
                        <div className="application-card__id-text"><h4>{application.university}</h4><p>{application.program || application.major}</p></div>
                      </div>
                      <div className="application-card__top-meta">
                        <VisibilityChip value={application.visibility} />
                        <StatusBadge value={application.status} />
                        <span className="chevron">{expanded ? '▲' : '▼'}</span>
                      </div>
                    </button>
                    {expanded && (
                      <div className="application-card__expand">
                        <div className="application-toolbar">
                          <VisibilityToggle value={application.visibility} onChange={v => handleApplicationVisibility(application.id, v)} />
                          <div className="application-toolbar__actions">
                            <button type="button" className="mini-btn" onClick={() => setAppModal({ open: true, application })}>✎ Edit</button>
                            <button type="button" className="mini-btn mini-btn--danger" onClick={() => handleDeleteApplication(application.id)}>🗑 Delete</button>
                          </div>
                        </div>
                        <div className="application-card__meta">
                          <div className="meta-cell"><span>Term</span><strong>{application.term || '—'}</strong></div>
                          <div className="meta-cell"><span>Major</span><strong>{application.major || '—'}</strong></div>
                          <div className="meta-cell"><span>Decision</span><strong>{application.decision}</strong></div>
                          <div className="meta-cell"><span>Recommendation</span><strong>{application.recommendation}</strong></div>
                          <div className="meta-cell"><span>Deadline</span><strong>{application.deadline || '—'}</strong></div>
                          <div className="meta-cell"><span>Status</span><strong>{application.status}</strong></div>
                        </div>
                        {application.notes && <div className="application-notes"><span>Notes</span><p>{application.notes}</p></div>}
                        <div className="doc-groups">
                          {DOC_CATEGORIES.map(category => (
                            <DocumentGroup key={category.key} studentId={me.id} application={application} category={category} onUpload={handleApplicationDocumentUpload} onRemove={handleApplicationDocumentRemove} onSetDocVisibility={handleDocumentVisibility} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              {!(me.applications || []).length && (
                <div className="empty-state empty-state--cert">
                  <div className="empty-state__icon">🎓</div>
                  <h4>No applications yet</h4>
                  <p>Create your first university application.</p>
                  <button type="button" className="solid-btn solid-btn--sm" onClick={() => setAppModal({ open: true, application: null })}>New application</button>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'documents' && (
          <section className="students-section">
            <div className="section-head">
              <div>
                <h3>All Documents</h3>
                <p className="section-head__sub">Documents attached across all applications.</p>
              </div>
            </div>
            <div className="doc-flat-list">
              {(me.applications || []).flatMap(app => Object.entries(app.documents || {}).flatMap(([cat, docs]) => (docs || []).map(d => ({ ...d, appName: app.university, cat })))).map(d => (
                <div key={d.id} className="doc-chip">
                  <span className="doc-chip__file">📄</span>
                  <div className="doc-chip__info">
                    <strong>{d.name}</strong>
                    <span>{d.appName} · {d.cat}</span>
                  </div>
                  {d.url && <a className="mini-btn" href={d.url} target="_blank" rel="noreferrer">Open</a>}
                </div>
              ))}
              {(me.applications || []).every(app => !Object.values(app.documents || {}).some(arr => arr && arr.length)) && (
                <div className="empty-state empty-state--cert">
                  <div className="empty-state__icon">📁</div>
                  <h4>No documents yet</h4>
                  <p>Documents you upload on Applications will appear here.</p>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'portfolio' && (
          <section className="students-section">
            <div className="section-head section-head--stack">
              <div>
                <h3>Portfolio</h3>
                <p className="section-head__sub">Add links to your GitHub, Behance, personal website, etc.</p>
              </div>
              <button type="button" className="solid-btn solid-btn--sm" onClick={addPortfolioLink}>＋ Add link</button>
            </div>
            {portfolio.length === 0 ? (
              <div className="empty-state empty-state--cert">
                <div className="empty-state__icon">🌐</div>
                <h4>No portfolio links yet</h4>
                <p>Add a link to showcase your work.</p>
              </div>
            ) : (
              <div className="new-portfolio-grid">
                {portfolio.map(p => (
                  <div key={p.id} className="new-portfolio-item">
                    <div className="new-portfolio-item__icon">🔗</div>
                    <div className="new-portfolio-item__body">
                      <strong>{p.label}</strong>
                      <a href={p.url} target="_blank" rel="noreferrer">{p.url}</a>
                    </div>
                    <button type="button" className="icon-btn icon-btn--danger" onClick={() => removePortfolioLink(p.id)}>🗑</button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'licenses' && (
          <section className="students-section">
            <div className="section-head section-head--stack">
              <div>
                <h3>My Certifications</h3>
                <p className="section-head__sub">Add credentials with score and visibility.</p>
              </div>
              <button type="button" className="solid-btn solid-btn--sm" onClick={() => setLicenseModal({ open: true, license: null })}>
                <span className="btn-plus">＋</span> Add
              </button>
            </div>
            <div className="cert-list">
              {(me.licenses || []).map(license => (
                <div key={license.id} className="cert-item">
                  <div className="cert-item__logo">{(license.name || 'C').trim()[0]?.toUpperCase()}</div>
                  <div className="cert-item__body">
                    <div className="cert-item__row">
                      <h4 className="cert-item__name">{license.name}</h4>
                      <div className="cert-item__actions">
                        <button type="button" className="icon-btn" title="Edit" onClick={() => setLicenseModal({ open: true, license })}>✎</button>
                        <button type="button" className="icon-btn icon-btn--danger" title="Delete" onClick={() => handleDeleteLicense(license.id)}>🗑</button>
                      </div>
                    </div>
                    {license.issuer && <p className="cert-item__issuer">{license.issuer}</p>}
                    {(license.issueMonth || license.issueYear || license.score) && (
                      <p className="cert-item__meta">
                        {(license.issueMonth || license.issueYear) && <span>Issued {[license.issueMonth, license.issueYear].filter(Boolean).join(' ')}</span>}
                        {license.score && <span> · Score {license.score}</span>}
                      </p>
                    )}
                    {license.credentialId && <p className="cert-item__cred">Credential ID {license.credentialId}</p>}
                    <div className="cert-item__foot">
                      <VisibilityToggle value={license.visibility} onChange={v => handleLicenseVisibility(license.id, v)} />
                      {license.credentialUrl && <a className="pill-link" href={license.credentialUrl} target="_blank" rel="noreferrer">Show credential ↗</a>}
                      {(license.media || []).map(m => (
                        <LicenseMediaItem key={m.id} media={m} onRemove={handleLicenseMediaRemove} readOnly={false} />
                      ))}
                      <label className="pill-link pill-link--upload" style={{ cursor: 'pointer' }}>
                        📎 Add Evidence
                        <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="file-input-hidden"
                          onChange={e => { const file = e.target.files?.[0]; if (file) handleLicenseMediaUpload(license.id, file); e.target.value = '' }} />
                      </label>
                    </div>
                  </div>
                </div>
              ))}
              {!(me.licenses || []).length && (
                <div className="empty-state empty-state--cert">
                  <div className="empty-state__icon">🎓</div>
                  <h4>No certifications yet</h4>
                  <p>Add IELTS, SAT, GRE, or other credentials.</p>
                  <button type="button" className="solid-btn solid-btn--sm" onClick={() => setLicenseModal({ open: true, license: null })}>Add certification</button>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'experience' && (
          <SimpleListSection
            title="Experience"
            subtitle="Internships, jobs, volunteering."
            emptyIcon="💼"
            emptyTitle="No experience added"
            emptyDesc="Add your first experience."
            addLabel="Add experience"
            onAdd={addExperience}
            items={experience}
            renderItem={e => (
              <div className="simple-item">
                <div className="simple-item__logo">💼</div>
                <div className="simple-item__body">
                  <h4>{e.role}</h4>
                  <p>{[e.company, e.period].filter(Boolean).join(' · ')}</p>
                </div>
                <button type="button" className="icon-btn icon-btn--danger" onClick={() => removeExperience(e.id)}>🗑</button>
              </div>
            )}
          />
        )}

        {activeTab === 'explore' && (
          <section className="students-section">
            <div className="section-head">
              <div>
                <h3>Public Student Directory</h3>
                <p className="section-head__sub">Browse profiles other students shared publicly.</p>
              </div>
              <span className="count-pill">{publicStudents.length}</span>
            </div>
            <div className="students-grid">
              {publicStudents.length > 0 ? publicStudents.map(student => (
                <StudentCard key={student.id} student={student} onClick={() => { setSelectedPublicStudent(student); setPublicStudentActiveTab('profile'); setExpandedPublicApplications([]) }} />
              )) : (
                <div className="empty-state empty-state--cert">
                  <div className="empty-state__icon">🎓</div>
                  <h4>No public profiles yet</h4>
                  <p>When other students make their profiles public, they will appear here.</p>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'activity' && (
          <section className="students-section">
            <div className="section-head">
              <div>
                <h3>Recent Activity</h3>
                <p className="section-head__sub">A timeline of your applications and certifications.</p>
              </div>
            </div>
            <div className="activity-list">
              {[...(me.applications || []).map(a => ({ type: 'app', title: `Application to ${a.university}`, date: a.created_at, icon: '🎓' })),
                ...(me.licenses || []).map(l => ({ type: 'lic', title: `Added certification: ${l.name}`, date: l.created_at, icon: '🏆' }))]
                .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
                .slice(0, 20)
                .map((item, i) => (
                  <div key={i} className="activity-item">
                    <span className="activity-item__icon">{item.icon}</span>
                    <div className="activity-item__body">
                      <p>{item.title}</p>
                      <small>{item.date ? new Date(item.date).toLocaleDateString() : ''}</small>
                    </div>
                  </div>
                ))}
              {!(me.applications || []).length && !(me.licenses || []).length && (
                <div className="empty-state empty-state--cert">
                  <div className="empty-state__icon">📜</div>
                  <h4>No activity yet</h4>
                  <p>Your recent actions will appear here.</p>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <PublicStudentDrawer
        student={selectedPublicStudent}
        activeTab={publicStudentActiveTab}
        setActiveTab={setPublicStudentActiveTab}
        expandedApplications={expandedPublicApplications}
        onToggleApplicationExpanded={togglePublicApplicationExpanded}
        licenses={selectedPublicStudent?.licenses}
        readOnly={true}
        onClose={() => { setSelectedPublicStudent(null); setPublicStudentActiveTab('profile'); setExpandedPublicApplications([]) }}
      />

      <ApplicationModal
        open={appModal.open}
        application={appModal.application}
        onClose={() => setAppModal({ open: false, application: null })}
        onSave={handleSaveApplication}
      />

      <LicenseModal
        open={licenseModal.open}
        license={licenseModal.license}
        onClose={() => setLicenseModal({ open: false, license: null })}
        onSave={handleSaveLicense}
      />
    </div>
  )
}

/* ─── Small helper components ─── */

function QuickItem({ icon, label, value, placeholder, muted, isDecision }) {
  const empty = !value || value === 'Not assigned' || value === 'Pending'
  return (
    <div className="new-quick-item">
      <div className="new-quick-item__icon">{icon}</div>
      <div className="new-quick-item__body">
        <p className="new-quick-item__label">{label}</p>
        {isDecision && value ? (
          <span className={`new-quick-item__decision ${(value || '').toLowerCase() === 'accepted' ? 'new-quick-item__decision--green' : 'new-quick-item__decision--amber'}`}>
            {value.toLowerCase() === 'accepted' ? '✓' : '⏳'} {value}
          </span>
        ) : value && !empty ? (
          <p className={`new-quick-item__value ${muted ? 'new-quick-item__value--muted' : ''}`}>{value}</p>
        ) : value && muted ? (
          <p className="new-quick-item__value new-quick-item__value--muted">{value}</p>
        ) : (
          <p className="new-quick-item__value new-quick-item__value--placeholder">＋ {placeholder}</p>
        )}
      </div>
    </div>
  )
}

function SimpleListSection({ title, subtitle, emptyIcon, emptyTitle, emptyDesc, addLabel, onAdd, items, renderItem }) {
  return (
    <section className="students-section">
      <div className="section-head section-head--stack">
        <div>
          <h3>{title}</h3>
          <p className="section-head__sub">{subtitle}</p>
        </div>
        <button type="button" className="solid-btn solid-btn--sm" onClick={onAdd}>＋ {addLabel}</button>
      </div>
      {items.length === 0 ? (
        <div className="empty-state empty-state--cert">
          <div className="empty-state__icon">{emptyIcon}</div>
          <h4>{emptyTitle}</h4>
          <p>{emptyDesc}</p>
          <button type="button" className="solid-btn solid-btn--sm" onClick={onAdd}>{addLabel}</button>
        </div>
      ) : (
        <div className="simple-list">
          {items.map(item => <div key={item.id}>{renderItem(item)}</div>)}
        </div>
      )}
    </section>
  )
}