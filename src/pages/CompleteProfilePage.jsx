import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import './CompleteProfilePage.css'

export default function CompleteProfilePage() {
  const navigate = useNavigate()
  const { user, profile, loading, refreshProfile, signOut } = useAuth()

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    major: '',
    university: '',
    gender: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        major: profile.major || '',
        university: profile.university || '',
        gender: profile.gender || '',
      })
    }
  }, [profile])

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login')
    }
  }, [loading, user, navigate])

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e) {
  e.preventDefault()

  if (!user) return

  const payload = {
    full_name: form.full_name.trim(),
    phone: form.phone.trim(),
    major: form.major.trim(),
    university: form.university.trim(),
    gender: form.gender,
    is_profile_completed: true,
  }

  if (!payload.full_name || !payload.major || !payload.university || !payload.gender) {
    setError('Please fill in all required fields.')
    return
  }

  setSaving(true)
  setError('')

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, ...payload })

  setSaving(false)

  if (error) {
    setError(error.message)
    return
  }

  const updatedProfile = await refreshProfile()

  if (updatedProfile?.role === 'admin') {
    navigate('/admin', { replace: true })
    return
  }

  navigate('/student', { replace: true })
}


  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="complete-profile-page">
        <div className="complete-profile-bg complete-profile-bg--one" />
        <div className="complete-profile-bg complete-profile-bg--two" />
        <div className="complete-profile-shell">
          <div className="complete-profile-card complete-profile-card--loading">
            <p className="complete-profile-loading">Loading profile...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="complete-profile-page">
      <div className="complete-profile-bg complete-profile-bg--one" />
      <div className="complete-profile-bg complete-profile-bg--two" />

      <div className="complete-profile-shell">
        <div className="complete-profile-panel">
          <div className="complete-profile-copy">
            <span className="complete-profile-kicker">AppTrack onboarding</span>
            <h1>Complete your profile</h1>
            <p>
              Add your academic details so your dashboard, applications, and future
              visibility settings work correctly from the start.
            </p>

            <div className="complete-profile-points">
              <div className="complete-profile-point">
                <span className="complete-profile-pointdot" />
                <span>Your profile is saved permanently to your account.</span>
              </div>
              <div className="complete-profile-point">
                <span className="complete-profile-pointdot" />
                <span>You can update contact details later from the dashboard.</span>
              </div>
              <div className="complete-profile-point">
                <span className="complete-profile-pointdot" />
                <span>Admin and student flows will be routed automatically.</span>
              </div>
            </div>
          </div>

          <form className="complete-profile-card" onSubmit={handleSubmit}>
            <div className="complete-profile-cardhead">
              <div>
                <p className="complete-profile-eyebrow">Student setup</p>
                <h2>Basic information</h2>
              </div>

              <button
                type="button"
                className="complete-profile-signout"
                onClick={handleSignOut}
              >
                Sign out
              </button>
            </div>

            <div className="complete-profile-grid">
              <label className="complete-profile-field">
                <span>Full name</span>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => updateField('full_name', e.target.value)}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  required
                />
              </label>

              <label className="complete-profile-field">
                <span>Phone</span>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="+994 ..."
                  autoComplete="tel"
                />
              </label>

              <label className="complete-profile-field">
                <span>Major</span>
                <input
                  type="text"
                  value={form.major}
                  onChange={(e) => updateField('major', e.target.value)}
                  placeholder="Computer Science"
                  autoComplete="organization-title"
                  required
                />
              </label>

              <label className="complete-profile-field">
                <span>University</span>
                <input
                  type="text"
                  value={form.university}
                  onChange={(e) => updateField('university', e.target.value)}
                  placeholder="Your university"
                  autoComplete="organization"
                  required
                />
              </label>

              <label className="complete-profile-field complete-profile-field--full">
                <span>Gender</span>
                <select
                  value={form.gender}
                  onChange={(e) => updateField('gender', e.target.value)}
                  required
                >
                  <option value="">Select gender</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </label>
            </div>

            {error ? <p className="complete-profile-error">{error}</p> : null}

            <div className="complete-profile-actions">
              <button type="submit" className="complete-profile-submit" disabled={saving}>
                {saving ? 'Saving profile...' : 'Save profile'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

