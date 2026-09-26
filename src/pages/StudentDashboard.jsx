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

// Tab structure organized into 4 requested groups
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
      { key: 'test_scores', label: 'Test Scores' },
      { key: 'honors', label: 'Honors & Awards' },
    ],
  },
  {
    label: 'Activities',
    tabs: [
      { key: 'volunteering', label: 'Volunteering' },
      { key: 'experience', label: 'Internships & Jobs' },
      { key: 'projects', label: 'Projects & Research' },
    ],
  },
  {
    label: 'Admissions',
    tabs: [
      { key: 'applications', label: 'Applications' },
      { key: 'documents', label: 'Documents' },
      { key: 'recommendations', label: 'Recommendations' },
      { key: 'portfolio', label: 'Portfolio' },
    ],
  },
]

// LocalStorage-backed persistence for student-managed content
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
  const { user, signOut, refreshProfile } = useAuth()
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
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const [appModal, setAppModal] = useState({ open: false, application: null })
  const [licenseModal, setLicenseModal] = useState({ open: false, license: null })
  const [expandedApplications, setExpandedApplications] = useState([])

  // Student-managed lightweight sections (persisted locally)
  const [education, setEducation] = useState(() => loadLS(`apptrack.education.${user?.id}`, []))
  const [testScores, setTestScores] = useState(() => loadLS(`apptrack.test_scores.${user?.id}`, []))
  const [honors, setHonors] = useState(() => loadLS(`apptrack.honors.${user?.id}`, []))
  const [volunteering, setVolunteering] = useState(() => loadLS(`apptrack.volunteering.${user?.id}`, []))
  const [experience, setExperience] = useState(() => loadLS(`apptrack.experience.${user?.id}`, []))
  const [projects, setProjects] = useState(() => loadLS(`apptrack.projects.${user?.id}`, []))
  const [recommendations, setRecommendations] = useState(() => loadLS(`apptrack.recommendations.${user?.id}`, []))
  const [portfolio, setPortfolio] = useState(() => loadLS(`apptrack.portfolio.${user?.id}`, []))

  useEffect(() => { if (user?.id) saveLS(`apptrack.education.${user.id}`, education) }, [education, user?.id])
  useEffect(() => { if (user?.id) saveLS(`apptrack.test_scores.${user.id}`, testScores) }, [testScores, user?.id])
  useEffect(() => { if (user?.id) saveLS(`apptrack.honors.${user.id}`, honors) }, [honors, user?.id])
  useEffect(() => { if (user?.id) saveLS(`apptrack.volunteering.${user.id}`, volunteering) }, [volunteering, user?.id])
  useEffect(() => { if (user?.id) saveLS(`apptrack.experience.${user.id}`, experience) }, [experience, user?.id])
  useEffect(() => { if (user?.id) saveLS(`apptrack.projects.${user.id}`, projects) }, [projects, user?.id])
  useEffect(() => { if (user?.id) saveLS(`apptrack.recommendations.${user.id}`, recommendations) }, [recommendations, user?.id])
  useEffect(() => { if (user?.id) saveLS(`apptrack.portfolio.${user.id}`, portfolio) }, [portfolio, user?.id])

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
      const [
        { data: profileData, error: profileError },
        { data: appsData, error: appsError },
        { data: licData, error: licError },
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase
          .from('applications')
          .select(
            `id,student_id,university,program,major,term,deadline,status,decision,recommendation,notes,visibility,created_at,application_documents(id,application_id,user_id,category,name,file_path,file_url,size,visibility,created_at)`
          )
          .eq('student_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('licenses')
          .select(
            `id,user_id,name,issuer,issue_month,issue_year,expire_month,expire_year,credential_id,credential_url,score,visibility,created_at,license_media(id,license_id,name,file_path,file_url,size,created_at)`
          )
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      ])

      if (profileError) throw profileError
      if (appsError) throw appsError
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

  const handleDocumentVisibility = useCallback(async (docId, value) => {
    if (!user?.id) return
    setMe(p => ({ ...p, applications: (p.applications || []).map(a => ({ ...a, documents: Object.fromEntries(Object.entries(a.documents || {}).map(([c, ds]) => [c, (ds || []).map(d => d.id === docId ? { ...d, visibility: value } : d)])) })) }))
    try { await setApplicationDocumentVisibility(user.id, docId, value) } catch (e) { console.error(e); loadMyProfile() }
  }, [user?.id, loadMyProfile])

  const handlePhotoUpload = useCallback(async (file) => {
    if (!user?.id || !file) return
    setUploadingPhoto(true)
    try {
      const r = await uploadAvatar(user.id, file)
      const url = r.url || r.publicUrl
      const path = r.path || r.filePath
      await setPhoto(user.id, url, path)
      setMe(p => ({ ...p, photoUrl: url, photoPath: path }))
      refreshProfile?.()
    } catch (e) {
      console.error('Photo upload error:', e)
    } finally {
      setUploadingPhoto(false)
    }
  }, [user?.id, refreshProfile])

  const handleRemovePhoto = useCallback(async (e) => {
    e?.stopPropagation()
    if (!user?.id) return
    try {
      if (me.photoPath) {
        await removeAvatar(me.photoPath).catch(() => {})
      }
      await removePhoto(user.id)
      setMe(p => ({ ...p, photoUrl: '', photoPath: '' }))
      refreshProfile?.()
    } catch (e) {
      console.error('Photo remove error:', e)
    }
  }, [user?.id, me.photoPath, refreshProfile])

  const saveName = useCallback(async () => {
    if (!user?.id || !nameDraft.trim()) return
    const newName = nameDraft.trim()
    try {
      await setProfile(user.id, { full_name: newName, fullName: newName })
      setMe(p => ({ ...p, fullName: newName }))
      setEditingName(false)
      refreshProfile?.()
    } catch (e) {
      console.error('Save name error:', e)
    }
  }, [user?.id, nameDraft, refreshProfile])

  const handlePreviewPublicView = useCallback(() => {
    const isProfilePublic = me.visibility?.profile === 'public'
    const publicApps = (me.applications || []).filter(a => a.visibility === 'public')
    const publicLics = (me.licenses || []).filter(l => l.visibility === 'public')

    setSelectedPublicStudent({
      ...me,
      email: me.visibility?.email === 'public' ? me.email : '',
      phone: me.visibility?.phone === 'public' ? me.phone : '',
      photoUrl: me.visibility?.photo === 'public' ? me.photoUrl : '',
      notes: me.visibility?.notes === 'public' ? me.notes : '',
      applications: publicApps,
      licenses: publicLics,
      isSelfPreview: true,
      isProfilePublic,
    })
    setPublicStudentActiveTab('profile')
  }, [me])

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

  // Simple add handlers for the sections
  const addEducation = () => {
    const school = window.prompt('School / University name?')
    if (!school?.trim()) return
    const degree = window.prompt('Degree / Major (optional)') || ''
    const years = window.prompt('Years or graduation (e.g., 2020 - 2024)') || ''
    setEducation(prev => [...prev, { id: Date.now(), school: school.trim(), degree, years }])
  }
  const removeEducation = id => setEducation(prev => prev.filter(e => e.id !== id))

  const addTestScore = () => {
    const test = window.prompt('Test type (e.g. IELTS, TOEFL, SAT, AP, IB)?')
    if (!test?.trim()) return
    const score = window.prompt('Overall score (e.g. 7.5, 1450)?') || ''
    const date = window.prompt('Test date (optional, e.g. 2024)?') || ''
    setTestScores(prev => [...prev, { id: Date.now(), test: test.trim(), score, date }])
  }
  const removeTestScore = id => setTestScores(prev => prev.filter(t => t.id !== id))

  const addHonor = () => {
    const title = window.prompt('Honor / Award title?')
    if (!title?.trim()) return
    const issuer = window.prompt('Issuer / Organization (optional)') || ''
    const year = window.prompt('Year (optional)') || ''
    setHonors(prev => [...prev, { id: Date.now(), title: title.trim(), issuer, year }])
  }
  const removeHonor = id => setHonors(prev => prev.filter(h => h.id !== id))

  const addVolunteering = () => {
    const org = window.prompt('Organization or cause name?')
    if (!org?.trim()) return
    const role = window.prompt('Role / Position (optional)') || ''
    const hours = window.prompt('Hours or period (optional)') || ''
    setVolunteering(prev => [...prev, { id: Date.now(), organization: org.trim(), role, hours }])
  }
  const removeVolunteering = id => setVolunteering(prev => prev.filter(v => v.id !== id))

  const addExperience = () => {
    const role = window.prompt('Role / Position?')
    if (!role?.trim()) return
    const company = window.prompt('Company / Organization (optional)') || ''
    const period = window.prompt('Period (e.g., Jun 2024 - Present)') || ''
    setExperience(prev => [...prev, { id: Date.now(), role: role.trim(), company, period }])
  }
  const removeExperience = id => setExperience(prev => prev.filter(e => e.id !== id))

  const addProject = () => {
    const name = window.prompt('Project name?')
    if (!name?.trim()) return
    const desc = window.prompt('Short description (optional)') || ''
    const url = window.prompt('URL (optional)') || ''
    setProjects(prev => [...prev, { id: Date.now(), name: name.trim(), description: desc, url }])
  }
  const removeProject = id => setProjects(prev => prev.filter(p => p.id !== id))

  const addRecommendation = () => {
    const recommender = window.prompt('Recommender name (e.g., Math Teacher, Counselor)?')
    if (!recommender?.trim()) return
    const role = window.prompt('Subject / Institution (optional)') || ''
    const status = window.prompt('Status (Requested / Submitted / Received)', 'Requested') || 'Requested'
    setRecommendations(prev => [...prev, { id: Date.now(), recommender: recommender.trim(), role, status }])
  }
  const removeRecommendation = id => setRecommendations(prev => prev.filter(r => r.id !== id))

  const addPortfolioLink = () => {
    const label = window.prompt('Link label (e.g., GitHub, Behance)')
    if (!label?.trim()) return
    const url = window.prompt('URL (https://...)')
    if (!url?.trim()) return
    setPortfolio(prev => [...prev, { id: Date.now(), label: label.trim(), url: url.trim() }])
  }
  const removePortfolioLink = id => setPortfolio(prev => prev.filter(p => p.id !== id))

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
                <span className="new-header__brand-title">AppTrack</span>
                <span className="new-header__brand-badge">STUDENT</span>
              </div>
              <p className="new-header__brand-sub">University Application & Portfolio Hub</p>
            </div>
          </div>

          <div className="new-header__center">
            <div className="new-header__explore-wrap">
              <button type="button" className="new-header__explore-btn" onClick={() => setActiveTab('explore')}>
                <span className="new-header__explore-icon">👥</span>
                <span>Student Directory</span>
                <span className="new-header__explore-count">+{publicStudents.length}</span>
              </button>
            </div>
          </div>

          <nav className="new-header__nav">
            <button type="button" className="new-header__nav-btn" onClick={() => navigate('/home')}>🏠 Home</button>
            <button
              type="button"
              className="new-header__nav-btn new-header__nav-btn--preview"
              title="See how your profile appears to other students"
              onClick={handlePreviewPublicView}
            >
              👁 View Public Profile
            </button>
            <button type="button" className="new-header__nav-btn new-header__nav-btn--logout" onClick={handleSignOut}>Log out</button>
          </nav>
        </div>

        <div className="new-header__mobile-bar">
          <button type="button" className="new-header__explore-btn new-header__explore-btn--mobile" onClick={() => setActiveTab('explore')}>
            <span className="new-header__explore-icon">👥</span>
            <span>Student Directory</span>
            <span className="new-header__explore-count">+{publicStudents.length}</span>
          </button>
        </div>
      </header>

      <main className="new-main">
        {/* ═══ HERO / PROFILE CARD ═══ */}
        <section className="new-hero-card">
          <div className="new-hero-card__banner" />
          <div className="new-hero-card__body">
            <div className="new-hero-card__avatar-block">
              <label className="new-hero-card__avatar-preview" title="Click to upload avatar">
                <Avatar url={me.photoUrl} name={me.fullName} className="new-hero-card__avatar-img" />
                <span className="new-hero-card__avatar-overlay">
                  <span className="new-hero-card__avatar-camera">📷</span>
                  <span>{uploadingPhoto ? '...' : 'Upload'}</span>
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="file-input-hidden"
                  disabled={uploadingPhoto}
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) handlePhotoUpload(f)
                    e.target.value = ''
                  }}
                />
              </label>
              {me.photoUrl && (
                <button
                  type="button"
                  className="new-hero-card__avatar-remove"
                  title="Remove avatar"
                  onClick={handleRemovePhoto}
                >
                  ✕
                </button>
              )}
            </div>

            <div className="new-hero-card__info">
              <div className="new-hero-card__name-row">
                {editingName ? (
                  <div className="name-edit-inline">
                    <input
                      type="text"
                      className="name-edit-input"
                      value={nameDraft}
                      placeholder="Enter full name"
                      autoFocus
                      onChange={e => setNameDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveName()
                        if (e.key === 'Escape') setEditingName(false)
                      }}
                    />
                    <button type="button" className="solid-btn solid-btn--sm" onClick={saveName}>Save</button>
                    <button type="button" className="ghost-btn solid-btn--sm" onClick={() => setEditingName(false)}>Cancel</button>
                  </div>
                ) : (
                  <>
                    <h1 className="new-hero-card__name">{me.fullName || 'Student Name'}</h1>
                    <button
                      type="button"
                      className="name-edit-pencil"
                      title="Edit your full name"
                      onClick={() => {
                        setNameDraft(me.fullName || '')
                        setEditingName(true)
                      }}
                    >
                      ✎
                    </button>
                  </>
                )}
                <div className="new-hero-card__pill new-hero-card__pill--id">
                  <span>ID</span>
                  <strong>{me.id?.slice(0, 8) || '—'}</strong>
                </div>
              </div>

              <div className="new-hero-card__meta-line">
                <span>{me.major || 'Major pending'}</span>
                {me.university && (
                  <>
                    <span className="dot-sep">•</span>
                    <span>{me.university}</span>
                  </>
                )}
                {me.assignedCounselor && (
                  <>
                    <span className="dot-sep">•</span>
                    <span className="counselor-tag">Mentor: {me.assignedCounselor}</span>
                  </>
                )}
              </div>
            </div>

            <div className="new-hero-card__visibility-box">
              <div className="new-hero-card__vis-item">
                <span className="new-hero-card__vis-label">Profile visibility</span>
                <VisibilityToggle
                  value={me.visibility?.profile || 'private'}
                  onChange={v => handleProfileVisibility('profile', v)}
                />
              </div>
              <div className="new-hero-card__vis-item">
                <span className="new-hero-card__vis-label">Photo visibility</span>
                <VisibilityToggle
                  value={me.visibility?.photo || 'private'}
                  onChange={v => handleProfileVisibility('photo', v)}
                />
              </div>
            </div>
          </div>
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

        {/* 1. OVERVIEW (EXACT ORIGINAL) */}
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
                    { title: 'Add your test scores', time: '~3 min', icon: '📝', tab: 'test_scores' },
                    { title: 'Add an honor or award', time: '~2 min', icon: '🏆', tab: 'honors' },
                    { title: 'Track a recommender', time: '~2 min', icon: '✉️', tab: 'recommendations' },
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

        {/* 2. MY PROFILE (EXACT ORIGINAL) */}
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

        {/* 3. ACADEMIC: EDUCATION */}
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

        {/* 4. ACADEMIC: TEST SCORES */}
        {activeTab === 'test_scores' && (
          <SimpleListSection
            title="Test Scores"
            subtitle="Standardized tests (IELTS, TOEFL, SAT, AP, IB, etc.)."
            emptyIcon="📝"
            emptyTitle="No test scores added"
            emptyDesc="Add your standardized test results."
            addLabel="Add test score"
            onAdd={addTestScore}
            items={testScores}
            renderItem={t => (
              <div className="simple-item">
                <div className="simple-item__logo">📝</div>
                <div className="simple-item__body">
                  <h4>{t.test} — {t.score}</h4>
                  <p>{t.date ? `Date: ${t.date}` : 'Standardized Exam'}</p>
                </div>
                <button type="button" className="icon-btn icon-btn--danger" onClick={() => removeTestScore(t.id)}>🗑</button>
              </div>
            )}
          />
        )}

        {/* 5. ACADEMIC: HONORS & AWARDS */}
        {activeTab === 'honors' && (
          <SimpleListSection
            title="Honors & Awards"
            subtitle="Academic competitions, olympiads, and recognitions."
            emptyIcon="🏆"
            emptyTitle="No honors or awards"
            emptyDesc="Add your academic awards or certificates."
            addLabel="Add honor / award"
            onAdd={addHonor}
            items={honors}
            renderItem={h => (
              <div className="simple-item">
                <div className="simple-item__logo">🏆</div>
                <div className="simple-item__body">
                  <h4>{h.title}</h4>
                  <p>{[h.issuer, h.year].filter(Boolean).join(' · ')}</p>
                </div>
                <button type="button" className="icon-btn icon-btn--danger" onClick={() => removeHonor(h.id)}>🗑</button>
              </div>
            )}
          />
        )}

        {/* 6. ACTIVITIES: VOLUNTEERING */}
        {activeTab === 'volunteering' && (
          <SimpleListSection
            title="Volunteering"
            subtitle="Community service and non-profit volunteer work."
            emptyIcon="🤝"
            emptyTitle="No volunteering added"
            emptyDesc="Add your volunteer experiences."
            addLabel="Add volunteering"
            onAdd={addVolunteering}
            items={volunteering}
            renderItem={v => (
              <div className="simple-item">
                <div className="simple-item__logo">🤝</div>
                <div className="simple-item__body">
                  <h4>{v.organization}</h4>
                  <p>{[v.role, v.hours].filter(Boolean).join(' · ')}</p>
                </div>
                <button type="button" className="icon-btn icon-btn--danger" onClick={() => removeVolunteering(v.id)}>🗑</button>
              </div>
            )}
          />
        )}

        {/* 7. ACTIVITIES: INTERNSHIPS & JOBS */}
        {activeTab === 'experience' && (
          <SimpleListSection
            title="Internships & Jobs"
            subtitle="Internships, summer jobs, and professional experience."
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

        {/* 8. ACTIVITIES: PROJECTS & RESEARCH */}
        {activeTab === 'projects' && (
          <SimpleListSection
            title="Projects & Research"
            subtitle="Notable projects, research papers, and products you built."
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

        {/* 9. ADMISSIONS: APPLICATIONS */}
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

        {/* 10. ADMISSIONS: DOCUMENTS VAULT */}
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

        {/* 11. ADMISSIONS: RECOMMENDATIONS */}
        {activeTab === 'recommendations' && (
          <SimpleListSection
            title="Recommendations"
            subtitle="Letters of recommendation tracked from teachers and mentors."
            emptyIcon="✉️"
            emptyTitle="No recommenders added"
            emptyDesc="Track recommendation letters for your applications."
            addLabel="Add recommender"
            onAdd={addRecommendation}
            items={recommendations}
            renderItem={r => (
              <div className="simple-item">
                <div className="simple-item__logo">✉️</div>
                <div className="simple-item__body">
                  <h4>{r.recommender}</h4>
                  <p>{[r.role, r.status ? `Status: ${r.status}` : ''].filter(Boolean).join(' · ')}</p>
                </div>
                <button type="button" className="icon-btn icon-btn--danger" onClick={() => removeRecommendation(r.id)}>🗑</button>
              </div>
            )}
          />
        )}

        {/* 12. ADMISSIONS: PORTFOLIO */}
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

        {/* EXPLORE DIRECTORY */}
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

        {/* RECENT ACTIVITY */}
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
