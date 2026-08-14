import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { GraduationCap, Home, User, Bell, LogOut, Search, Users2, ArrowRight } from 'lucide-react'
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
    id: '',
    fullName: '',
    email: '',
    phone: '',
    major: '',
    university: '',
    gender: '',
    photoUrl: '',
    photoPath: '',
    notes: '',
    assignedCounselor: '',
    decision: '',
    visibility: {},
    applications: [],
    licenses: [],
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('profile')
  const [publicStudents, setPublicStudents] = useState([])
  const [selectedPublicStudent, setSelectedPublicStudent] = useState(null)
  const [publicStudentActiveTab, setPublicStudentActiveTab] = useState('profile')
  const [expandedPublicApplications, setExpandedPublicApplications] = useState([])

  // Profile editing
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [editingContact, setEditingContact] = useState(false)
  const [contactDraft, setContactDraft] = useState({ email: '', phone: '' })
  
  // Pre-populate contactDraft with current values when editing starts
  const startEditingContact = useCallback(() => {
    setContactDraft({ email: me.email, phone: me.phone })
    setEditingContact(true)
  }, [me.email, me.phone])

  // Application modal
  const [appModal, setAppModal] = useState({ open: false, application: null })

  // License modal
  const [licenseModal, setLicenseModal] = useState({ open: false, license: null })

  // Expanded applications
  const [expandedApplications, setExpandedApplications] = useState([])

  const publicApplicationsCount = useMemo(
    () => (me.applications || []).filter((a) => a.visibility === 'public').length,
    [me.applications],
  )

  const publicLicensesCount = useMemo(
    () => (me.licenses || []).filter((l) => l.visibility === 'public').length,
    [me.licenses],
  )

  // ── Load my profile ──────────────────────────────────────────────
  const loadMyProfile = useCallback(async () => {
    if (!user?.id) return

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError

      const { data: appsData, error: appsError } = await supabase
        .from('applications')
        .select(`
          id,
          student_id,
          university,
          program,
          major,
          term,
          deadline,
          status,
          decision,
          recommendation,
          notes,
          visibility,
          created_at,
          application_documents (
            id,
            application_id,
            user_id,
            category,
            name,
            file_path,
            file_url,
            size,
            visibility,
            created_at
          )
        `)
        .eq('student_id', user.id)
        .order('created_at', { ascending: false })

      if (appsError) throw appsError

      const { data: licData, error: licError } = await supabase
        .from('licenses')
        .select(`
          id,
          user_id,
          name,
          issuer,
          issue_month,
          issue_year,
          expire_month,
          expire_year,
          credential_id,
          credential_url,
          score,
          visibility,
          created_at,
          license_media (
            id,
            license_id,
            name,
            file_path,
            file_url,
            size,
            created_at
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (licError) throw licError

      const data = { ...profileData, applications: appsData || [], licenses: licData || [] }

      const visibility = {
        profile: data.profile_visibility || 'private',
        photo: data.photo_visibility || 'private',
        email: data.email_visibility || 'private',
        phone: data.phone_visibility || 'private',
        notes: data.notes_visibility || 'private',
      }

      const applications = (data.applications || []).map((app) => {
        const docsByCategory = (app.application_documents || []).reduce((acc, doc) => {
          const cat = doc.category || 'other'
          if (!acc[cat]) acc[cat] = []
          acc[cat].push({
            id: doc.id,
            name: doc.name || 'Document.pdf',
            path: doc.file_path || '',
            url: doc.file_url || '',
            size: doc.size || 0,
            visibility: doc.visibility || 'private',
            created_at: doc.created_at || '',
            application_id: doc.application_id || '',
            category: cat,
          })
          return acc
        }, {})

        return {
          id: app.id,
          student_id: app.student_id,
          university: app.university || '',
          program: app.program || '',
          major: app.major || '',
          term: app.term || '',
          deadline: app.deadline || '',
          status: app.status || 'Not Started',
          decision: app.decision || 'Pending',
          recommendation: app.recommendation || 'Pending',
          notes: app.notes || '',
          visibility: app.visibility || 'private',
          created_at: app.created_at || '',
          documents: docsByCategory,
        }
      })

      const licenses = (data.licenses || []).map((lic) => {
        const media = (lic.license_media || []).map((m) => ({
          id: m.id,
          license_id: m.license_id,
          name: m.name || 'Document',
          filePath: m.file_path || '',
          url: m.file_url || '',
          size: m.size || 0,
          created_at: m.created_at,
        }))

        return {
          id: lic.id,
          user_id: lic.user_id,
          name: lic.name || '',
          issuer: lic.issuer || '',
          issueMonth: lic.issue_month || '',
          issueYear: lic.issue_year || '',
          expireMonth: lic.expire_month || '',
          expireYear: lic.expire_year || '',
          credentialId: lic.credential_id || '',
          credentialUrl: lic.credential_url || '',
          score: lic.score || '',
          visibility: lic.visibility || 'private',
          media,
          created_at: lic.created_at || '',
        }
      })

      setMe({
        id: data.id,
        fullName: data.full_name || '',
        email: data.email || '',
        phone: data.phone || '',
        major: data.major || '',
        university: data.university || '',
        gender: data.gender || '',
        photoUrl: data.photo_url || '',
        photoPath: data.photo_path || '',
        notes: data.admin_notes || '',
        assignedCounselor: data.assigned_counselor || '',
        decision: data.decision || '',
        visibility,
        applications,
        licenses,
      })
    } catch (error) {
      console.error('Failed to load profile:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  const loadPublicStudents = useCallback(async () => {
    try {
      const publicData = await getPublicStudents()
      setPublicStudents(publicData.filter((s) => s.id !== user?.id))
    } catch (error) {
      console.error('Failed to load public students:', error)
    }
  }, [user?.id])

  const togglePublicApplicationExpanded = useCallback((applicationId) => {
    setExpandedPublicApplications((prev) =>
      prev.includes(applicationId)
        ? prev.filter((id) => id !== applicationId)
        : [...prev, applicationId]
    )
  }, [])

  useEffect(() => {
    loadMyProfile()
    loadPublicStudents()

    const channel = supabase
      .channel('student-dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user?.id}` }, () => { loadMyProfile() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications', filter: `student_id=eq.${user?.id}` }, () => { loadMyProfile() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'application_documents', filter: `user_id=eq.${user?.id}` }, () => { loadMyProfile() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'licenses', filter: `user_id=eq.${user?.id}` }, () => { loadMyProfile() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'license_media', filter: `user_id=eq.${user?.id}` }, () => { loadMyProfile() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `profile_visibility=eq.public` }, () => { loadPublicStudents() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications', filter: `visibility=eq.public` }, () => { loadPublicStudents() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'licenses', filter: `visibility=eq.public` }, () => { loadPublicStudents() })
      .subscribe()

    const handleDataChange = () => {
      loadMyProfile()
      loadPublicStudents()
    }
    onDataChanged(handleDataChange)

    return () => {
      supabase.removeChannel(channel)
      offDataChanged(handleDataChange)
    }
  }, [user?.id, loadMyProfile, loadPublicStudents])

  // ── Visibility handlers ──────────────────────────────────────────
  const handleProfileVisibility = useCallback(async (key, value) => {
    if (!user?.id) return
    setMe((prev) => ({ ...prev, visibility: { ...prev.visibility, [key]: value } }))
    try { await setVisibility(user.id, key, value) } 
    catch (error) { console.error('Failed to update visibility:', error); loadMyProfile() }
  }, [user?.id, loadMyProfile])

  const handleApplicationVisibility = useCallback(async (appId, value) => {
    if (!user?.id) return
    setMe((prev) => ({
      ...prev,
      applications: (prev.applications || []).map((app) => app.id === appId ? { ...app, visibility: value } : app),
    }))
    try { await setApplicationVisibility(user.id, appId, value) }
    catch (error) { console.error('Failed to update application visibility:', error); loadMyProfile() }
  }, [user?.id, loadMyProfile])

  const handleLicenseVisibility = useCallback(async (licenseId, value) => {
    if (!user?.id) return
    setMe((prev) => ({
      ...prev,
      licenses: (prev.licenses || []).map((lic) => lic.id === licenseId ? { ...lic, visibility: value } : lic),
    }))
    try { await setLicenseVisibility(user.id, licenseId, value) }
    catch (error) { console.error('Failed to update license visibility:', error); loadMyProfile() }
  }, [user?.id, loadMyProfile])

  const handleDocumentVisibility = useCallback(async (docId, value) => {
    if (!user?.id) return
    setMe((prev) => ({
      ...prev,
      applications: (prev.applications || []).map((app) => ({
        ...app,
        documents: Object.fromEntries(
          Object.entries(app.documents || {}).map(([cat, docs]) => [
            cat,
            (docs || []).map((doc) => doc.id === docId ? { ...doc, visibility: value } : doc),
          ])
        ),
      })),
    }))
    try { await setApplicationDocumentVisibility(user.id, docId, value) }
    catch (error) { console.error('Failed to update document visibility:', error); loadMyProfile() }
  }, [user?.id, loadMyProfile])

  // ── Photo handlers ───────────────────────────────────────────────
  const handlePhotoUpload = useCallback(async (file) => {
    if (!user?.id || !file) return
    try {
      const result = await uploadAvatar(user.id, file)
      await setPhoto(user.id, result.url, result.path)
      setMe((prev) => ({ ...prev, photoUrl: result.url, photoPath: result.path }))
    } catch (error) { console.error('Failed to upload photo:', error) }
  }, [user?.id])

  const handleRemovePhoto = useCallback(async () => {
    if (!user?.id) return
    try {
      if (me.photoPath) { await removeAvatar(me.photoPath) }
      await removePhoto(user.id)
      setMe((prev) => ({ ...prev, photoUrl: '', photoPath: '' }))
    } catch (error) { console.error('Failed to remove photo:', error) }
  }, [user?.id, me.photoPath])

  // ── Profile editing ──────────────────────────────────────────────
  const saveName = useCallback(async () => {
    if (!user?.id || !nameDraft.trim()) return
    try {
      await setProfile(user.id, { fullName: nameDraft.trim() })
      setMe((prev) => ({ ...prev, fullName: nameDraft.trim() }))
      setEditingName(false)
    } catch (error) { console.error('Failed to save name:', error) }
  }, [user?.id, nameDraft])

  const saveContact = useCallback(async () => {
    if (!user?.id) return
    try {
      await setProfile(user.id, { email: contactDraft.email, phone: contactDraft.phone })
      setMe((prev) => ({ ...prev, email: contactDraft.email, phone: contactDraft.phone }))
      setEditingContact(false)
    } catch (error) { console.error('Failed to save contact:', error) }
  }, [user?.id, contactDraft])

  // ── Application handlers ─────────────────────────────────────────
  const handleSaveApplication = useCallback(async (payload) => {
    if (!user?.id) return
    try {
      await saveApplication(user.id, payload)
      await loadMyProfile()
      setAppModal({ open: false, application: null })
    } catch (error) { console.error('Failed to save application:', error); throw error }
  }, [user?.id, loadMyProfile])

  const handleDeleteApplication = useCallback(async (appId) => {
    if (!user?.id) return
    try { await deleteApplication(user.id, appId); await loadMyProfile() }
    catch (error) { console.error('Failed to delete application:', error) }
  }, [user?.id, loadMyProfile])

  const handleApplicationDocumentUpload = useCallback(async (studentId, applicationId, category, file) => {
    if (!user?.id) return
    try { await uploadApplicationFile(user.id, applicationId, category, file); await loadMyProfile() }
    catch (error) { console.error('Failed to upload document:', error); throw error }
  }, [user?.id, loadMyProfile])

  const handleApplicationDocumentRemove = useCallback(async (studentId, applicationId, category, docId) => {
    if (!user?.id) return
    try {
      await removeApplicationFile(user.id, applicationId, category, docId)
      setMe((prev) => ({
        ...prev,
        applications: (prev.applications || []).map((app) => {
          if (app.id !== applicationId) return app
          const existingDocuments = app.documents || {}
          const existingCategoryDocs = existingDocuments[category] || []
          return {
            ...app,
            documents: { ...existingDocuments, [category]: existingCategoryDocs.filter((doc) => doc.id !== docId) },
          }
        }),
      }))
      await loadMyProfile()
    } catch (error) { console.error('Failed to remove document:', error) }
  }, [user?.id, loadMyProfile])

  // ── License handlers ─────────────────────────────────────────────
  const handleSaveLicense = useCallback(async (payload) => {
    if (!user?.id) return
    try { await saveLicense(user.id, payload); await loadMyProfile(); setLicenseModal({ open: false, license: null }) }
    catch (error) { console.error('Failed to save license:', error); throw error }
  }, [user?.id, loadMyProfile])

  const handleDeleteLicense = useCallback(async (licenseId) => {
    if (!user?.id) return
    try { await deleteLicense(user.id, licenseId); await loadMyProfile() }
    catch (error) { console.error('Failed to delete license:', error) }
  }, [user?.id, loadMyProfile])

  const handleLicenseMediaUpload = useCallback(async (licenseId, file) => {
    if (!user?.id) return
    try { await uploadLicenseMediaFile(user.id, licenseId, file); await loadMyProfile() }
    catch (error) { console.error('Failed to upload license media:', error); throw error }
  }, [user?.id, loadMyProfile])

  const handleLicenseMediaRemove = useCallback(async (mediaId) => {
    if (!user?.id) return
    try { await deleteLicenseMediaFile(user.id, mediaId); await loadMyProfile() }
    catch (error) { console.error('Failed to remove license media:', error) }
  }, [user?.id, loadMyProfile])

  const toggleApplicationExpanded = useCallback((appId) => {
    setExpandedApplications((prev) => prev.includes(appId) ? prev.filter((id) => id !== appId) : [...prev, appId])
  }, [])

  // ── Sign out handler ─────────────────────────────────────────────
  const handleSignOut = useCallback(async () => {
    await signOut()
    navigate('/login')
  }, [signOut, navigate])

  if (loading) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#FBFAF7] relative overflow-hidden">
      {/* Decorative background blobs — Menim yeni dizayn */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-indigo-200/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-40 right-0 w-[500px] h-[500px] bg-violet-200/15 rounded-full blur-[120px] pointer-events-none" />

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* 🎨 YENİ HEADER — Sticky Glassmorphism (Bu tek deyisilen hisse!) */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-[1400px] mx-auto px-6 py-3.5 flex items-center justify-between">
          
          {/* Sol: Logo + Brand */}
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-600/25">
                <GraduationCap className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-[15px] font-bold text-slate-900 leading-tight tracking-tight">Student Manager</h1>
                <span className="text-[9px] font-bold text-sky-600 bg-sky-100/70 px-1.5 py-0.5 rounded uppercase tracking-wider">Student</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-tight mt-0.5">Manage profile · applications · certs</p>
            </div>
          </div>

          {/* Sağ: Navigation */}
          <nav className="flex items-center gap-1">
            {/* Home btn */}
            <button 
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 rounded-lg transition-all"
            >
              <Home className="w-3.5 h-3.5" /> Home
            </button>

            {/* My Profile btn (aktif) */}
            <button 
              type="button"
              onClick={() => setActiveTab('profile')}
              className="flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium text-slate-900 bg-slate-100/70 rounded-lg transition-all"
            >
              <User className="w-3.5 h-3.5" /> My Profile
            </button>

            {/* Profile Preview Card (Avatar+Name+Vis) */}
            <button 
              type="button" 
              onClick={() => setActiveTab('profile')} 
              title="View your profile"
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 ml-1 rounded-lg hover:bg-slate-100/70 transition-all border border-transparent hover:border-slate-200/70"
            >
              <Avatar name={me.fullName} photoUrl={me.photoUrl} size="sm" />
              <div className="flex flex-col items-start leading-tight">
                <strong className="text-[12px] font-semibold text-slate-900 max-w-[120px] truncate">{me.fullName || 'Student'}</strong>
                {me.major && <small className="text-[10px] text-slate-500 max-w-[120px] truncate">{me.major}</small>}
              </div>
              <VisibilityChip value={me.visibility?.profile} />
            </button>

            <div className="w-px h-5 bg-slate-200 mx-2 hidden sm:block" />

            {/* Sign out btn */}
            <button 
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50/60 rounded-lg transition-all group"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" /> Sign out
            </button>

            {/* Explore Students - Header Position (yalniz desktop) */}
            <div className="ml-2 pl-2 border-l border-slate-200 hidden lg:flex items-center">
              <button 
                type="button"
                onClick={() => setActiveTab('explore')}
                className="group relative flex items-center gap-2 pl-4 pr-4 py-2.5 bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-xl overflow-hidden transition-all hover:shadow-lg hover:shadow-slate-900/30 hover:-translate-y-0.5 active:scale-[0.98]"
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300 bg-gradient-to-r from-indigo-400 to-violet-400" />
                <Search className="w-3.5 h-3.5 relative z-10 opacity-80" strokeWidth={2.5} />
                <Users2 className="w-3.5 h-3.5 relative z-10 opacity-80" strokeWidth={2.5} />
                <span className="text-[12px] font-semibold leading-none relative z-10">Explore</span>
                <ArrowRight className="w-3 h-3 ml-1 relative z-10 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ⚠️ ASAGIDAKI HER SEY OLDUGU KIMI QALIR (Zero deyisiklik) */}
      {/* ═══════════════════════════════════════════════════════════ */}

      <main className="dashboard-content">
        <section className="student-hero">
          <div className="student-hero__card">
            <div className="student-photo-preview student-photo-preview--interactive student-hero__photo">
              <Avatar name={me.fullName} photoUrl={me.photoUrl} size="xl" className="student-photo-avatar" />
              <div className="student-photo-overlay">
                <button
                  type="button"
                  className="student-photo-overlay__btn"
                  onClick={() => document.getElementById('me-photo-input')?.click()}
                >
                  {me.photoUrl ? 'Replace' : 'Upload'}
                </button>
                {me.photoUrl && (
                  <button
                    type="button"
                    className="student-photo-overlay__btn student-photo-overlay__btn--danger"
                    onClick={handleRemovePhoto}
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                id="me-photo-input"
                type="file"
                accept="image/*"
                className="file-input-hidden"
                onChange={(e) => {
                  handlePhotoUpload(e.target.files?.[0] || null)
                  e.target.value = ''
                }}
              />
            </div>

            <div className="student-hero__content">
              <div className="student-hero__top">
                <div className="student-hero__identity">
                  {editingName ? (
                    <div className="student-hero__nameedit">
                      <input
                        className="inline-input inline-input--lg"
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value)}
                        aria-label="Full name"
                        autoFocus
                      />
                      <button type="button" className="solid-btn solid-btn--sm" onClick={saveName}>Save</button>
                      <button type="button" className="ghost-btn solid-btn--sm" onClick={() => setEditingName(false)}>Cancel</button>
                    </div>
                  ) : (
                    <h2 className="student-hero__name">
                      {me.fullName}
                      <button type="button" className="icon-btn student-hero__nameedit-btn" title="Edit name" onClick={() => setEditingName(true)}>✎</button>
                    </h2>
                  )}
                  <p>{me.major} • {me.university}</p>
                </div>
                <div className="student-hero__vis-group">
                  <div className="student-hero__profilevis">
                    <span className="student-hero__vis-label">Profile</span>
                    <VisibilityToggle
                      value={me.visibility?.profile || 'private'}
                      onChange={(v) => handleProfileVisibility('profile', v)}
                    />
                  </div>
                  <div className="student-hero__profilevis">
                    <span className="student-hero__vis-label">Photo</span>
                    <VisibilityToggle
                      value={me.visibility?.photo || 'private'}
                      onChange={(v) => handleProfileVisibility('photo', v)}
                    />
                  </div>
                </div>
              </div>

              <p className="student-hero__hint">
                {me.visibility?.profile === 'public'
                  ? 'Your profile & photo are visible to admins and other students.'
                  : 'Your profile is private — only you and admins can see it.'}
              </p>

              <div className="student-hero__stats">
                <div className="hero-stat"><span>Applications</span><strong>{(me.applications || []).length}</strong></div>
                <div className="hero-stat"><span>Public apps</span><strong>{publicApplicationsCount}</strong></div>
                <div className="hero-stat"><span>Certifications</span><strong>{(me.licenses || []).length}</strong></div>
                <div className="hero-stat"><span>Public certs</span><strong>{publicLicensesCount}</strong></div>
              </div>
            </div>
          </div>
        </section>

        <section className="drawer-tabs student-tabs">
          <button type="button" className={`drawer-tab ${activeTab === 'profile' ? 'drawer-tab--active' : ''}`} onClick={() => setActiveTab('profile')}>My Profile</button>
          <button type="button" className={`drawer-tab ${activeTab === 'applications' ? 'drawer-tab--active' : ''}`} onClick={() => setActiveTab('applications')}>My Applications</button>
          <button type="button" className={`drawer-tab ${activeTab === 'licenses' ? 'drawer-tab--active' : ''}`} onClick={() => setActiveTab('licenses')}>My Certifications</button>
          <button type="button" className={`drawer-tab ${activeTab === 'explore' ? 'drawer-tab--active' : ''}`} onClick={() => setActiveTab('explore')}>Explore Students</button>
        </section>

        {activeTab === 'profile' && (
          <div className="student-dashboard-grid">
            <section className="students-section">
              <div className="section-head section-head--stack">
                <div>
                  <h3>Contact Details</h3>
                  <p className="section-head__sub">Freely edit your email & phone and set each public or private — no approval needed.</p>
                </div>
                {editingContact ? (
                  <div className="section-head__btns">
                    <button type="button" className="ghost-btn solid-btn--sm" onClick={() => setEditingContact(false)}>Cancel</button>
                    <button type="button" className="solid-btn solid-btn--sm" onClick={saveContact}>Save</button>
                  </div>
                ) : (
                  <button type="button" className="solid-btn solid-btn--sm" onClick={startEditingContact}>
                    <span className="btn-plus">✎</span> Edit
                  </button>
                )}
              </div>

              <div className="info-grid">
                <div className="info-card info-card--with-toggle">
                  <div className="info-card__main">
                    <span>Email</span>
                    {editingContact ? (
                      <input className="inline-input" type="email" value={contactDraft.email} onChange={(e) => setContactDraft((d) => ({ ...d, email: e.target.value }))} />
                    ) : (
                      <strong>{me.email}</strong>
                    )}
                  </div>
                  <VisibilityToggle value={me.visibility?.email || 'private'} onChange={(v) => handleProfileVisibility('email', v)} />
                </div>

                <div className="info-card info-card--with-toggle">
                  <div className="info-card__main">
                    <span>Phone</span>
                    {editingContact ? (
                      <input className="inline-input" value={contactDraft.phone} onChange={(e) => setContactDraft((d) => ({ ...d, phone: e.target.value }))} />
                    ) : (
                      <strong>{me.phone}</strong>
                    )}
                  </div>
                  <VisibilityToggle value={me.visibility?.phone || 'private'} onChange={(v) => handleProfileVisibility('phone', v)} />
                </div>
              </div>
            </section>

            <section className="students-section">
              <div className="section-head">
                <div>
                  <h3>Profile Information</h3>
                  <p className="section-head__sub">Academic details are managed by your admin/counselor.</p>
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
            </section>
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
              {(me.applications || []).map((application) => {
                const expanded = expandedApplications.includes(application.id)
                return (
                  <div key={application.id} className={`application-card ${expanded ? 'application-card--open' : ''}`}>
                    <button type="button" className="application-card__top" onClick={() => toggleApplicationExpanded(application.id)}>
                      <div className="application-card__id">
                        <div className="application-card__logo">{application.university?.[0] || 'U'}</div>
                        <div className="application-card__id-text">
                          <h4>{application.university}</h4>
                          <p>{application.program || application.major}</p>
                        </div>
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
                          <VisibilityToggle
                            value={application.visibility}
                            onChange={(v) => handleApplicationVisibility(application.id, v)}
                          />
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

                        {application.notes && (
                          <div className="application-notes"><span>Notes</span><p>{application.notes}</p></div>
                        )}

                        <div className="doc-groups">
                          {DOC_CATEGORIES.map((category) => (
                            <DocumentGroup
                              key={category.key}
                              studentId={me.id}
                              application={application}
                              category={category}
                              onUpload={handleApplicationDocumentUpload}
                              onRemove={handleApplicationDocumentRemove}
                              onSetDocVisibility={handleDocumentVisibility}
                            />
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
              {(me.licenses || []).map((license) => (
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
                      <VisibilityToggle value={license.visibility} onChange={(v) => handleLicenseVisibility(license.id, v)} />
                      {license.credentialUrl && (
                        <a className="pill-link" href={license.credentialUrl} target="_blank" rel="noreferrer">Show credential ↗</a>
                      )}
                      {(license.media || []).map((m) => (
                        <LicenseMediaItem
                          key={m.id}
                          media={m}
                          onRemove={handleLicenseMediaRemove}
                          readOnly={false}
                        />
                      ))}
                      <label className="pill-link pill-link--upload" style={{ cursor: 'pointer' }}>
                        📎 Add Evidence
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                          className="file-input-hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              handleLicenseMediaUpload(license.id, file)
                            }
                            e.target.value = ''
                          }}
                        />
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
                <p className="section-head__sub">Browse profiles other students shared publicly. You can view — never edit — their data.</p>
              </div>
              <span className="count-pill">{publicStudents.length}</span>
            </div>

            <div className="students-grid">
              {publicStudents.length > 0 ? (
                publicStudents.map((student) => (
                  <StudentCard
                    key={student.id}
                    student={student}
                    onClick={() => {
                      setSelectedPublicStudent(student)
                      setPublicStudentActiveTab('profile')
                      setExpandedPublicApplications([])
                    }}
                  />
                ))
              ) : (
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
        onClose={() => {
          setSelectedPublicStudent(null)
          setPublicStudentActiveTab('profile')
          setExpandedPublicApplications([])
        }}
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