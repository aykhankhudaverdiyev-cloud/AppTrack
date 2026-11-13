import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import './CompleteProfilePage.css'

// Professional Country Phone Calling Codes (Clean, no duplicate strings, standard worldwide labels)
const COUNTRY_DIAL_CODES = [
  { code: "+1", label: "United States / Canada (+1)" },
  { code: "+44", label: "United Kingdom (+44)" },
  { code: "+994", label: "Azerbaijan (+994)" },
  { code: "+90", label: "Turkey (+90)" },
  { code: "+49", label: "Germany (+49)" },
  { code: "+33", label: "France (+33)" },
  { code: "+39", label: "Italy (+39)" },
  { code: "+34", label: "Spain (+34)" },
  { code: "+31", label: "Netherlands (+31)" },
  { code: "+41", label: "Switzerland (+41)" },
  { code: "+46", label: "Sweden (+46)" },
  { code: "+47", label: "Norway (+47)" },
  { code: "+48", label: "Poland (+48)" },
  { code: "+353", label: "Ireland (+353)" },
  { code: "+971", label: "United Arab Emirates (+971)" },
  { code: "+966", label: "Saudi Arabia (+966)" },
  { code: "+974", label: "Qatar (+974)" },
  { code: "+86", label: "China (+86)" },
  { code: "+81", label: "Japan (+81)" },
  { code: "+82", label: "South Korea (+82)" },
  { code: "+65", label: "Singapore (+65)" },
  { code: "+61", label: "Australia (+61)" },
  { code: "+64", label: "New Zealand (+64)" },
  { code: "+995", label: "Georgia (+995)" },
  { code: "+7", label: "Kazakhstan / Region (+7)" }
]

export default function CompleteProfilePage() {
  const navigate = useNavigate()
  const { user, profile, refreshProfile, loading, signOut } = useAuth()

  // Form State
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [countryCode, setCountryCode] = useState('+994')
  const [phoneRaw, setPhoneRaw] = useState('')
  const [gender, setGender] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Populate existing data if available
  useEffect(() => {
    if (profile) {
      if (profile.full_name) {
        const parts = profile.full_name.trim().split(/\s+/)
        setFirstName(parts[0] || '')
        setLastName(parts.slice(1).join(' ') || '')
      }
      if (profile.phone) {
        const matched = COUNTRY_DIAL_CODES.find(c => profile.phone.startsWith(c.code))
        if (matched) {
          setCountryCode(matched.code)
          setPhoneRaw(profile.phone.slice(matched.code.length).trim())
        } else {
          setPhoneRaw(profile.phone)
        }
      }
      if (profile.gender) {
        setGender(profile.gender)
      }
    }
  }, [profile])

  // Auto-detect country code if pasted with a leading +
  function handlePhoneChange(val) {
    const trimmed = val.trim()
    if (trimmed.startsWith('+')) {
      const match = COUNTRY_DIAL_CODES.find(c => trimmed.startsWith(c.code))
      if (match) {
        setCountryCode(match.code)
        setPhoneRaw(trimmed.slice(match.code.length).trim())
        return
      }
    }
    setPhoneRaw(val)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!user) return

    if (!firstName.trim()) {
      setError('Please enter your first name.')
      return
    }
    if (!lastName.trim()) {
      setError('Please enter your last name.')
      return
    }
    if (!phoneRaw.trim()) {
      setError('Please enter your mobile phone number.')
      return
    }
    if (!gender) {
      setError('Please select your gender.')
      return
    }

    const full_name = `${firstName.trim()} ${lastName.trim()}`
    const full_phone = `${countryCode} ${phoneRaw.trim()}`

    setSaving(true)
    setError('')

    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      full_name,
      phone: full_phone,
      gender,
      is_profile_completed: true,
      updated_at: new Date().toISOString()
    })

    if (upsertError) {
      setSaving(false)
      setError(upsertError.message)
      return
    }

    const { data: refreshedProfile, error: refreshErr } = await refreshProfile()
    setSaving(false)

    if (refreshErr) {
      setError(refreshErr.message)
      return
    }

    if (refreshedProfile?.role === 'admin') {
      navigate('/admin', { replace: true })
    } else {
      navigate('/student', { replace: true })
    }
  }

  if (loading) {
    return (
      <div className="complete-profile-page">
        <div className="complete-profile-bg complete-profile-bg--one" />
        <div className="complete-profile-bg complete-profile-bg--two" />
        <div className="complete-profile-shell">
          <div className="complete-profile-card complete-profile-card--loading">
            <p className="complete-profile-loading">Loading your profile...</p>
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
          {/* Left Brand Pitch */}
          <div className="complete-profile-copy">
            <span className="complete-profile-kicker">AppTrack Onboarding</span>
            <h1>Complete your profile</h1>
            <p>
              Set up your verified student identity and international contact number to unlock your application dashboard.
            </p>

            <div className="complete-profile-points">
              <div className="complete-profile-point">
                <span className="complete-profile-pointdot" />
                <span>Track applications to as many universities as you like — no single target needed.</span>
              </div>
              <div className="complete-profile-point">
                <span className="complete-profile-pointdot" />
                <span>Add your intended majors and education history in My Profile.</span>
              </div>
              <div className="complete-profile-point">
                <span className="complete-profile-pointdot" />
                <span>Standard international dialing code support with verified phone formatting.</span>
              </div>
            </div>
          </div>

          {/* Right Form Card */}
          <form className="complete-profile-card" onSubmit={handleSubmit}>
            <div className="complete-profile-cardhead">
              <div>
                <p className="complete-profile-eyebrow">Student Identity</p>
                <h2>Personal Details</h2>
              </div>
              <button
                type="button"
                className="complete-profile-signout"
                onClick={signOut}
              >
                Sign out
              </button>
            </div>

            <div className="complete-profile-grid">
              {/* 1. First Name */}
              <label className="complete-profile-field">
                <span>First Name <em className="req-star">*</em></span>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. John"
                  autoComplete="given-name"
                  required
                />
              </label>

              {/* 2. Last Name */}
              <label className="complete-profile-field">
                <span>Last Name <em className="req-star">*</em></span>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Smith"
                  autoComplete="family-name"
                  required
                />
              </label>

              {/* 3. Mobile Phone with Clean Country Selector */}
              <div className="complete-profile-field complete-profile-field--full">
                <span>Mobile Phone <em className="req-star">*</em></span>
                <div className="phone-input-group">
                  <div className="phone-country-select-wrap">
                    <select
                      className="phone-country-select"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                    >
                      {COUNTRY_DIAL_CODES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="tel"
                    className="phone-number-input"
                    value={phoneRaw}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="50 123 45 67"
                    autoComplete="tel-national"
                    required
                  />
                </div>
                <small className="field-hint">Select your dialing code and enter your mobile number.</small>
              </div>

              {/* 4. Gender Selection */}
              <div className="complete-profile-field complete-profile-field--full">
                <span>Gender <em className="req-star">*</em></span>
                <div className="gender-btn-group">
                  {['Male', 'Female', 'Other'].map((g) => (
                    <button
                      key={g}
                      type="button"
                      className={`gender-pill-btn ${gender === g ? 'gender-pill-btn--active' : ''}`}
                      onClick={() => setGender(g)}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error ? <p className="complete-profile-error">{error}</p> : null}

            <div className="complete-profile-actions">
              <button
                type="submit"
                className="complete-profile-submit"
                disabled={saving || !firstName || !lastName || !phoneRaw || !gender}
              >
                {saving ? 'Saving profile...' : 'Save & Continue →'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
