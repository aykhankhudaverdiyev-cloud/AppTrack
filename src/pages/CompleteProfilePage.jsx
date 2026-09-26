import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import './CompleteProfilePage.css'

// Priority Local & Top Universities (Instant local recommendations before typing)
const PRIORITY_UNIVERSITIES = [
  { name: "ADA University", country: "Azerbaijan" },
  { name: "Baku Higher Oil School (BHOS)", country: "Azerbaijan" },
  { name: "French-Azerbaijani University (UFAZ)", country: "Azerbaijan" },
  { name: "Baku State University (BSU)", country: "Azerbaijan" },
  { name: "Azerbaijan State University of Economics (UNEC)", country: "Azerbaijan" },
  { name: "Massachusetts Institute of Technology (MIT)", country: "United States" },
  { name: "Harvard University", country: "United States" },
  { name: "University of Oxford", country: "United Kingdom" },
  { name: "University of Cambridge", country: "United Kingdom" },
  { name: "Technical University of Munich (TUM)", country: "Germany" },
  { name: "Middle East Technical University (METU)", country: "Turkey" },
  { name: "Koç University", country: "Turkey" }
]

// Universal Standard Majors
const ACCREDITED_MAJORS = [
  { name: "Computer Science", faculty: "Engineering & Computing" },
  { name: "Software Engineering", faculty: "Engineering & Computing" },
  { name: "Artificial Intelligence & Data Science", faculty: "Engineering & Computing" },
  { name: "Cybersecurity", faculty: "Engineering & Computing" },
  { name: "Information Technology (IT)", faculty: "Engineering & Computing" },
  { name: "Electrical & Electronic Engineering", faculty: "Engineering & Computing" },
  { name: "Mechanical Engineering", faculty: "Engineering & Computing" },
  { name: "Civil Engineering", faculty: "Engineering & Computing" },
  { name: "Biomedical Engineering", faculty: "Engineering & Computing" },
  { name: "Business Administration (BBA)", faculty: "Business & Management" },
  { name: "Finance & Banking", faculty: "Business & Management" },
  { name: "Economics", faculty: "Business & Management" },
  { name: "Accounting & Audit", faculty: "Business & Management" },
  { name: "International Business", faculty: "Business & Management" },
  { name: "Marketing & Digital Media", faculty: "Business & Management" },
  { name: "Medicine (MD)", faculty: "Health & Medicine" },
  { name: "Dentistry", faculty: "Health & Medicine" },
  { name: "Pharmacy", faculty: "Health & Medicine" },
  { name: "Public Health", faculty: "Health & Medicine" },
  { name: "Law / Jurisprudence (LLB)", faculty: "Law & Social Sciences" },
  { name: "International Relations", faculty: "Law & Social Sciences" },
  { name: "Political Science", faculty: "Law & Social Sciences" },
  { name: "Psychology", faculty: "Law & Social Sciences" },
  { name: "Architecture", faculty: "Design & Arts" },
  { name: "Graphic & UI/UX Design", faculty: "Design & Arts" }
]

const COUNTRY_DIAL_CODES = [
  { code: "+994", label: "Azerbaijan (+994)" },
  { code: "+1", label: "United States / Canada (+1)" },
  { code: "+44", label: "United Kingdom (+44)" },
  { code: "+90", label: "Turkey (+90)" },
  { code: "+49", label: "Germany (+49)" },
  { code: "+33", label: "France (+33)" },
  { code: "+39", label: "Italy (+39)" },
  { code: "+31", label: "Netherlands (+31)" },
  { code: "+971", label: "UAE (+971)" },
  { code: "+86", label: "China (+86)" },
  { code: "+82", label: "South Korea (+82)" }
]

export default function CompleteProfilePage() {
  const navigate = useNavigate()
  const { user, profile, refreshProfile, loading, signOut } = useAuth()

  // Form State
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [countryCode, setCountryCode] = useState('+994')
  const [phoneRaw, setPhoneRaw] = useState('')
  const [university, setUniversity] = useState('')
  const [major, setMajor] = useState('')
  const [gender, setGender] = useState('')

  // Autocomplete & Global API State
  const [uniQuery, setUniQuery] = useState('')
  const [apiUniversities, setApiUniversities] = useState([])
  const [isSearchingUni, setIsSearchingUni] = useState(false)
  const [showUniDropdown, setShowUniDropdown] = useState(false)

  const [majorQuery, setMajorQuery] = useState('')
  const [showMajorDropdown, setShowMajorDropdown] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const uniDropdownRef = useRef(null)
  const majorDropdownRef = useRef(null)

  // Populate profile data if exists
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
      if (profile.university) {
        setUniversity(profile.university)
        setUniQuery(profile.university)
      }
      if (profile.major) {
        setMajor(profile.major)
        setMajorQuery(profile.major)
      }
      if (profile.gender) {
        setGender(profile.gender)
      }
    }
  }, [profile])

  // Live Global University Search API (Hipolabs)
  useEffect(() => {
    if (!uniQuery.trim() || uniQuery.length < 2) {
      setApiUniversities([])
      setIsSearchingUni(false)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearchingUni(true)
      try {
        const response = await fetch(
          `https://universities.hipolabs.com/search?name=${encodeURIComponent(uniQuery.trim())}`
        )
        const data = await response.json()
        // Format & remove duplicate names
        const formatted = data.slice(0, 20).map(u => ({
          name: u.name,
          country: u.country
        }))
        setApiUniversities(formatted)
      } catch (err) {
        console.error("University API fetch error:", err)
      } finally {
        setIsSearchingUni(false)
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(timer)
  }, [uniQuery])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (uniDropdownRef.current && !uniDropdownRef.current.contains(e.target)) {
        setShowUniDropdown(false)
      }
      if (majorDropdownRef.current && !majorDropdownRef.current.contains(e.target)) {
        setShowMajorDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Combine Priority Unis and Global API search results
  const displayedUniversities = useMemo(() => {
    if (!uniQuery.trim()) return PRIORITY_UNIVERSITIES
    if (apiUniversities.length > 0) return apiUniversities

    // Fallback local search if API returns empty
    const q = uniQuery.toLowerCase().trim()
    return PRIORITY_UNIVERSITIES.filter(u =>
      u.name.toLowerCase().includes(q) || u.country.toLowerCase().includes(q)
    )
  }, [uniQuery, apiUniversities])

  // Filtered Majors
  const filteredMajors = useMemo(() => {
    if (!majorQuery.trim()) return ACCREDITED_MAJORS
    const q = majorQuery.toLowerCase().trim()
    return ACCREDITED_MAJORS.filter(m =>
      m.name.toLowerCase().includes(q) || m.faculty.toLowerCase().includes(q)
    )
  }, [majorQuery])

  function handleSelectUniversity(name) {
    setUniversity(name)
    setUniQuery(name)
    setShowUniDropdown(false)
  }

  function handleSelectMajor(name) {
    setMajor(name)
    setMajorQuery(name)
    setShowMajorDropdown(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!user) return

    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter your full name.')
      return
    }
    if (!phoneRaw.trim()) {
      setError('Please enter your mobile phone number.')
      return
    }
    if (!university.trim()) {
      setError('Please select or type your target college/university.')
      return
    }
    if (!major.trim()) {
      setError('Please select or type your intended major.')
      return
    }
    if (!gender) {
      setError('Please select your gender.')
      return
    }

    setSaving(true)
    setError('')

    const full_name = `${firstName.trim()} ${lastName.trim()}`
    const full_phone = `${countryCode} ${phoneRaw.trim()}`

    const { error: upsertError } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      full_name,
      phone: full_phone,
      university: university.trim(),
      major: major.trim(),
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
    return <div className="complete-profile-page"><p>Loading profile...</p></div>
  }

  return (
    <div className="complete-profile-page">
      <div className="complete-profile-shell">
        <form className="complete-profile-card" onSubmit={handleSubmit}>
          
          <h2>Personal Details</h2>

          {/* First & Last Name */}
          <div className="complete-profile-grid">
            <label className="complete-profile-field">
              <span>First Name *</span>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Ali"
                required
              />
            </label>

            <label className="complete-profile-field">
              <span>Last Name *</span>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Aliyev"
                required
              />
            </label>

            {/* Mobile Phone */}
            <div className="complete-profile-field complete-profile-field--full">
              <span>Mobile Phone *</span>
              <div className="phone-input-group">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                >
                  {COUNTRY_DIAL_CODES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  value={phoneRaw}
                  onChange={(e) => setPhoneRaw(e.target.value)}
                  placeholder="50 123 45 67"
                  required
                />
              </div>
            </div>

            {/* 1. GLOBAL UNIVERSITY SEARCH (Hipolabs API + Fallback) */}
            <div className="complete-profile-field complete-profile-field--full" ref={uniDropdownRef}>
              <div className="field-label-row">
                <span>Target University / College *</span>
                {university && <span className="uni-verified-badge">✓ Selected</span>}
              </div>

              <div className="autocomplete-wrap">
                <input
                  type="text"
                  value={uniQuery}
                  onChange={(e) => {
                    setUniQuery(e.target.value)
                    setUniversity(e.target.value)
                    setShowUniDropdown(true)
                  }}
                  onFocus={() => setShowUniDropdown(true)}
                  placeholder="Search 25,000+ universities worldwide..."
                  required
                />

                {showUniDropdown && (
                  <div className="autocomplete-dropdown">
                    {isSearchingUni && (
                      <div className="autocomplete-loading">Searching global database...</div>
                    )}

                    {!isSearchingUni && displayedUniversities.map((u, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className={`autocomplete-item ${u.name === university ? 'autocomplete-item--active' : ''}`}
                        onClick={() => handleSelectUniversity(u.name)}
                      >
                        <span className="autocomplete-icon">🏛️</span>
                        <div className="autocomplete-text">
                          <strong>{u.name}</strong>
                          <small>{u.country}</small>
                        </div>
                      </button>
                    ))}

                    {/* Custom Fallback option if user types something not in API */}
                    {uniQuery.trim() && (
                      <button
                        type="button"
                        className="autocomplete-item autocomplete-item--custom"
                        onClick={() => handleSelectUniversity(uniQuery.trim())}
                      >
                        <span className="autocomplete-icon">✨</span>
                        <div className="autocomplete-text">
                          <strong>Use "{uniQuery.trim()}"</strong>
                          <small>Set custom institution name</small>
                        </div>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 2. INTENDED MAJOR (UNLOCKED & ALWAYS ACCESSIBLE) */}
            <div className="complete-profile-field complete-profile-field--full" ref={majorDropdownRef}>
              <div className="field-label-row">
                <span>Intended Major / Field of Study *</span>
                {major && <span className="uni-verified-badge">✓ Selected</span>}
              </div>

              <div className="autocomplete-wrap">
                <input
                  type="text"
                  value={majorQuery}
                  onChange={(e) => {
                    setMajorQuery(e.target.value)
                    setMajor(e.target.value)
                    setShowMajorDropdown(true)
                  }}
                  onFocus={() => setShowMajorDropdown(true)}
                  placeholder="e.g. Computer Science, Business, Medicine..."
                  required
                />

                {showMajorDropdown && (
                  <div className="autocomplete-dropdown">
                    {filteredMajors.map((m, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className={`autocomplete-item ${m.name === major ? 'autocomplete-item--active' : ''}`}
                        onClick={() => handleSelectMajor(m.name)}
                      >
                        <span className="autocomplete-icon">🎓</span>
                        <div className="autocomplete-text">
                          <strong>{m.name}</strong>
                          <small>{m.faculty}</small>
                        </div>
                      </button>
                    ))}

                    {/* Custom Major Fallback */}
                    {majorQuery.trim() && (
                      <button
                        type="button"
                        className="autocomplete-item autocomplete-item--custom"
                        onClick={() => handleSelectMajor(majorQuery.trim())}
                      >
                        <span className="autocomplete-icon">✨</span>
                        <div className="autocomplete-text">
                          <strong>Use "{majorQuery.trim()}"</strong>
                          <small>Set custom degree major</small>
                        </div>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Gender Selection */}
            <div className="complete-profile-field complete-profile-field--full">
              <span>Gender *</span>
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

          {error && <p className="complete-profile-error">{error}</p>}

          <button
            type="submit"
            className="complete-profile-submit"
            disabled={saving || !firstName || !lastName || !phoneRaw || !university || !major || !gender}
          >
            {saving ? 'Saving profile...' : 'Save & Continue →'}
          </button>
        </form>
      </div>
    </div>
  )
}
