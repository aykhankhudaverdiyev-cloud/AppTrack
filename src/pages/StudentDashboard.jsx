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

export default function StudentDashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [me, setMe] = useState({
    id: '', fullName: '', email: '', phone: '', major: '', university: '',
    gender: '', photoUrl: '', photoPath: '', notes: '', assignedCounselor: '',
    decision: '', visibility: {}, applications: [], licenses: [],
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('profile')
  const [publicStudents, setPublicStudents] = useState([])
  const [selectedPublicStudent, setSelectedPublicStudent] = useState(null)
  const [publicStudentActiveTab, setPublicStudentActiveTab] = useState('profile')
  const [expandedPublicApplications, setExpandedPublicApplications] = useState([])

  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [editingContact, setEditingContact] = useState(false)
  const [contactDraft, setContactDraft] = useState({ email: '', phone: '' })

  const startEditingContact = useCallback(() => {
    setContactDraft({ email: me.email, phone: me.phone })
    setEditingContact(true)
  }, [me.email, me.phone])

  const [appModal, setAppModal] = useState({ open: false, application: null })
  const [licenseModal, setLicenseModal] = useState({ open: false, license: null })
  const [expandedApplications, setExpandedApplications] = useState([])

  const publicApplicationsCount = useMemo(
    () => (me.applications || []).filter(a => a.visibility === 'public').length,
    [me.applications],
  )
  const publicLicensesCount = useMemo(
    () => (me.licenses || []).filter(l => l.visibility === 'public').length,
    [me.licenses],
  )

  // profile completion
  const profileCompletion = useMemo(() => {
    const fields = [me.fullName, me.email, me.phone, me.major, me.university, me.gender]
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
    } catch (error) { console.error('Failed to load public students:', error) }
  }, [user?.id])

  const togglePublicApplicationExpanded = useCallback(applicationId => {
    setExpandedPublicApplications(prev => prev.includes(applicationId) ? prev.filter(id => id !== applicationId) : [...prev, applicationId])
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
    const handleDataChange = () => { loadMyProfile(); loadPublicStudents() }
    onDataChanged(handleDataChange)
    return () => { supabase.removeChannel(channel); offDataChanged(handleDataChange) }
  }, [user?.id, loadMyProfile, loadPublicStudents])

  const handleProfileVisibility = useCallback(async (key, value) => {
    if (!user?.id) return
    setMe(prev => ({ ...prev, visibility: { ...prev.visibility, [key]: value } }))
    try { await setVisibility(user.id, key, value) } catch (error) { console.error(error); loadMyProfile() }
  }, [user?.id, loadMyProfile])

  const handleApplicationVisibility = useCallback(async (appId, value) => {
    if (!user?.id) return
    setMe(prev => ({ ...prev, applications: (prev.applications || []).map(app => app.id === appId ? { ...app, visibility: value } : app) }))
    try { await setApplicationVisibility(user.id, appId, value) } catch (error) { console.error(error); loadMyProfile() }
  }, [user?.id, loadMyProfile])

  const handleLicenseVisibility = useCallback(async (licenseId, value) => {
    if (!user?.id) return
    setMe(prev => ({ ...prev, licenses: (prev.licenses || []).map(lic => lic.id === licenseId ? { ...lic, visibility: value } : lic) }))
    try { await setLicenseVisibility(user.id, licenseId, value) } catch (error) { console.error(error); loadMyProfile() }
  }, [user?.id, loadMyProfile])

  const handleDocumentVisibility = useCallback(async (docId, value) => {
    if (!user?.id) return
    setMe(prev => ({ ...prev, applications: (prev.applications || []).map(app => ({ ...app, documents: Object.fromEntries(Object.entries(app.documents || {}).map(([cat, docs]) => [cat, (docs || []).map(doc => doc.id === docId ? { ...doc, visibility: value } : doc)])) })) }))
    try { await setApplicationDocumentVisibility(user.id, docId, value) } catch (error) { console.error(error); loadMyProfile() }
  }, [user?.id, loadMyProfile])

  const handlePhotoUpload = useCallback(async file => {
    if (!user?.id || !file) return
    try { const result = await uploadAvatar(user.id, file); await setPhoto(user.id, result.url, result.path); setMe(prev => ({ ...prev, photoUrl: result.url, photoPath: result.path })) }
    catch (error) { console.error(error) }
  }, [user?.id])

  const handleRemovePhoto = useCallback(async () => {
    if (!user?.id) return
    try { if (me.photoPath) await removeAvatar(me.photoPath); await removePhoto(user.id); setMe(prev => ({ ...prev, photoUrl: '', photoPath: '' })) }
    catch (error) { console.error(error) }
  }, [user?.id, me.photoPath])

  const saveName = useCallback(async () => {
    if (!user?.id || !nameDraft.trim()) return
    try { await setProfile(user.id, { fullName: nameDraft.trim() }); setMe(prev => ({ ...prev, fullName: nameDraft.trim() })); setEditingName(false) }
    catch (error) { console.error(error) }
  }, [user?.id, nameDraft])

  const saveContact = useCallback(async () => {
    if (!user?.id) return
    try { await setProfile(user.id, { email: contactDraft.email, phone: contactDraft.phone }); setMe(prev => ({ ...prev, email: contactDraft.email, phone: contactDraft.phone })); setEditingContact(false) }
    catch (error) { console.error(error) }
  }, [user?.id, contactDraft])

  const handleSaveApplication = useCallback(async payload => {
    if (!user?.id) return
    try { await saveApplication(user.id, payload); await loadMyProfile(); setAppModal({ open: false, application: null }) }
    catch (error) { console.error(error); throw error }
  }, [user?.id, loadMyProfile])

  const handleDeleteApplication = useCallback(async appId => {
    if (!user?.id) return
    try { await deleteApplication(user.id, appId); await loadMyProfile() }
    catch (error) { console.error(error) }
  }, [user?.id, loadMyProfile])

  const handleApplicationDocumentUpload = useCallback(async (studentId, applicationId, category, file) => {
    if (!user?.id) return
    try { await uploadApplicationFile(user.id, applicationId, category, file); await loadMyProfile() }
    catch (error) { console.error(error); throw error }
  }, [user?.id, loadMyProfile])

  const handleApplicationDocumentRemove = useCallback(async (studentId, applicationId, category, docId) => {
    if (!user?.id) return
    try {
      await removeApplicationFile(user.id, applicationId, category, docId)
      setMe(prev => ({ ...prev, applications: (prev.applications || []).map(app => { if (app.id !== applicationId) return app; const existingDocuments = app.documents || {}; const existingCategoryDocs = existingDocuments[category] || []; return { ...app, documents: { ...existingDocuments, [category]: existingCategoryDocs.filter(doc => doc.id !== docId) } } }) }))
      await loadMyProfile()
    } catch (error) { console.error(error) }
  }, [user?.id, loadMyProfile])

  const handleSaveLicense = useCallback(async payload => {
    if (!user?.id) return
    try { await saveLicense(user.id, payload); await loadMyProfile(); setLicenseModal({ open: false, license: null }) }
    catch (error) { console.error(error); throw error }
  }, [user?.id, loadMyProfile])

  const handleDeleteLicense = useCallback(async licenseId => {
    if (!user?.id) return
    try { await deleteLicense(user.id, licenseId); await loadMyProfile() }
    catch (error) { console.error(error) }
  }, [user?.id, loadMyProfile])

  const handleLicenseMediaUpload = useCallback(async (licenseId, file) => {
    if (!user?.id) return
    try { await uploadLicenseMediaFile(user.id, licenseId, file); await loadMyProfile() }
    catch (error) { console.error(error); throw error }
  }, [user?.id, loadMyProfile])

  const handleLicenseMediaRemove = useCallback(async mediaId => {
    if (!user?.id) return
    try { await deleteLicenseMediaFile(user.id, mediaId); await loadMyProfile() }
    catch (error) { console.error(error) }
  }, [user?.id, loadMyProfile])

  const toggleApplicationExpanded = useCallback(appId => {
    setExpandedApplications(prev => prev.includes(appId) ? prev.filter(id => id !== appId) : [...prev, appId])
  }, [])

  const handleSignOut = useCallback(async () => { await signOut(); navigate('/login') }, [signOut, navigate])

  if (loading) return null

  const initials = (me.fullName || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="app-shell student-shell">
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
                <span className="new-header__brand-badge new-header__brand-badge--student">Student</span>
              </div>
              <p className="new-header__brand-subtitle">Manage profile · applications · certs</p>
            </div>
          </div>

          <nav className="new-header__nav">
            <button type="button" className="new-header__nav-btn" onClick={() => navigate('/')}>🏠 Home</button>
            <button type="button" className={`new-header__nav-btn ${activeTab === 'profile' ? 'new-header__nav-btn--active' : ''}`} onClick={() => setActiveTab('profile')}>👤 My Profile</button>

            {/* Profile preview chip */}
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

        {/* ══ PAGE TITLE ══ */}
        <section className="new-page-title">
          <div>
            <div className="new-page-title__eyebrow">
              <span className="new-page-title__line" />
              Student Dashboard
            </div>
            <h2 className="new-page-title__h2">Welcome back, {me.fullName?.split(' ')[0] || 'Student'} 👋</h2>
            <p className="new-page-title__sub">Manage your own profile, applications and certifications.</p>
          </div>
          <button type="button" className="new-header__explore-btn new-header__explore-btn--mobile" onClick={() => setActiveTab('explore')}>
            🔍 Explore Students
          </button>
        </section>

        {/* ══ HERO CARD ══ */}
        <section className="new-hero-card">
          {/* Cover */}
          <div className="new-hero-card__cover">
            <div className="new-hero-card__cover-dots" />
            <div className="new-hero-card__cover-top-left">
              <span className="new-hero-card__active-badge">
                <span className="new-hero-card__active-dot" /> Active
              </span>
            </div>
            <div className="new-hero-card__cover-top-right">
              <span className="new-hero-card__private-badge">
                🔒 {me.visibility?.profile === 'public' ? 'Public' : 'Private'}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="new-hero-card__content">
            {/* Avatar */}
            <div className="new-hero-card__avatar-block">
              <div className="student-photo-preview student-photo-preview--interactive new-hero-card__avatar-preview">
                <Avatar name={me.fullName} photoUrl={me.photoUrl} size="xl" className="student-photo-avatar" />
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

            {/* Info */}
            <div className="new-hero-card__info">
              <div className="new-hero-card__name-row">
                {editingName ? (
                  <>
                    <input className="inline-input inline-input--lg" value={nameDraft} onChange={e => setNameDraft(e.target.value)} autoFocus aria-label="Full name" />
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
              <p className="new-hero-card__sub">{me.major || 'Major not set yet'} · {me.university || 'Add details below'}</p>

              {/* Privacy row */}
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

            {/* Preview button */}
            <div className="new-hero-card__actions">
              <button type="button" className="ghost-btn" onClick={() => setActiveTab('explore')}>Preview Public View</button>
            </div>
          </div>
        </section>

        {/* ══ STAT CARDS ══ */}
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

        {/* ══ TABS ══ */}
        <section className="new-tabs-bar">
          <div className="new-tabs-bar__inner">
            {[
              { key: 'profile', label: 'My Profile' },
              { key: 'applications', label: 'My Applications' },
              { key: 'licenses', label: 'My Certifications' },
              { key: 'explore', label: 'Explore Students' },
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                className={`new-tab-btn ${activeTab === tab.key ? 'new-tab-btn--active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {/* ══ TAB CONTENT ══ */}

        {activeTab === 'profile' && (
          <div className="new-profile-grid">
            {/* Left column */}
            <div className="new-profile-main">

              {/* Overview */}
              <div className="new-section-card">
                <div className="new-section-card__head">
                  <h3>Overview</h3>
                  <p className="new-section-card__sub">Your academic profile, application progress and next steps.</p>
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

              {/* Contact Details */}
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

              {/* Profile Information */}
              <div className="new-section-card">
                <div className="new-section-card__head">
                  <div>
                    <h3>Profile Information</h3>
                    <p className="new-section-card__sub">Academic details are managed by your admin/counselor.</p>
                  </div>
                </div>
                <div className="info-grid">
                  <div className="info-card"><span>Full Name</span><strong>{me.fullName}</strong></div>
                  <div className="info-card"><span>Major</span><strong>{me.major}</strong></div>
                  <div className="info-card"><span>University</span><strong>{me.university}</strong></div>
                  <div className="info-card"><span>Gender</span><strong>{me.gender}</strong></div>
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

            {/* Right column */}
            <div className="new-profile-side">

              {/* Next steps */}
              <div className="new-section-card new-section-card--side">
                <div className="new-section-card__head">
                  <div className="new-next-steps__icon-wrap">
                    <span>＋</span>
                  </div>
                  <div>
                    <h3>Next steps</h3>
                    <p className="new-section-card__sub">Complete the items that matter most</p>
                  </div>
                </div>
                <div className="new-next-steps__list">
                  {[
                    { title: 'Add your education history', time: '~5 min', icon: '🎓', tab: 'profile' },
                    { title: 'Add your first application', time: '~3 min', icon: '📄', tab: 'applications' },
                    { title: 'Add a certification', time: '~2 min', icon: '🏆', tab: 'licenses' },
                    { title: 'Explore other students', time: '~1 min', icon: '🔍', tab: 'explore' },
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

              {/* Explore directory card */}
              <div className="new-explore-card">
                <div className="new-explore-card__bg" />
                <div className="new-explore-card__content">
                  <div className="new-explore-card__icon-wrap">
                    <span>👥</span>
                  </div>
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