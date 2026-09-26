import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import './CompleteProfilePage.css'

// Comprehensive Directory of Top World Universities (Global & Regional)
const TOP_UNIVERSITIES = [
  // United States (Ivy League, Top Private & Public)
  { name: "Massachusetts Institute of Technology (MIT)", country: "United States", code: "US" },
  { name: "Harvard University", country: "United States", code: "US" },
  { name: "Stanford University", country: "United States", code: "US" },
  { name: "California Institute of Technology (Caltech)", country: "United States", code: "US" },
  { name: "Princeton University", country: "United States", code: "US" },
  { name: "Yale University", country: "United States", code: "US" },
  { name: "Columbia University", country: "United States", code: "US" },
  { name: "University of Chicago", country: "United States", code: "US" },
  { name: "University of Pennsylvania (UPenn)", country: "United States", code: "US" },
  { name: "Cornell University", country: "United States", code: "US" },
  { name: "University of California, Berkeley (UC Berkeley)", country: "United States", code: "US" },
  { name: "University of California, Los Angeles (UCLA)", country: "United States", code: "US" },
  { name: "University of California, San Diego (UCSD)", country: "United States", code: "US" },
  { name: "Johns Hopkins University", country: "United States", code: "US" },
  { name: "Northwestern University", country: "United States", code: "US" },
  { name: "University of Michigan, Ann Arbor", country: "United States", code: "US" },
  { name: "Carnegie Mellon University (CMU)", country: "United States", code: "US" },
  { name: "Duke University", country: "United States", code: "US" },
  { name: "New York University (NYU)", country: "United States", code: "US" },
  { name: "Brown University", country: "United States", code: "US" },
  { name: "Dartmouth College", country: "United States", code: "US" },
  { name: "University of Washington", country: "United States", code: "US" },
  { name: "University of Texas at Austin", country: "United States", code: "US" },
  { name: "Georgia Institute of Technology (Georgia Tech)", country: "United States", code: "US" },
  { name: "University of Illinois Urbana-Champaign", country: "United States", code: "US" },
  { name: "University of Wisconsin-Madison", country: "United States", code: "US" },
  { name: "Boston University", country: "United States", code: "US" },
  { name: "University of Southern California (USC)", country: "United States", code: "US" },
  { name: "Purdue University", country: "United States", code: "US" },
  { name: "Rice University", country: "United States", code: "US" },
  { name: "Vanderbilt University", country: "United States", code: "US" },

  // United Kingdom (Russell Group & Top Institutions)
  { name: "University of Oxford", country: "United Kingdom", code: "UK" },
  { name: "University of Cambridge", country: "United Kingdom", code: "UK" },
  { name: "Imperial College London", country: "United Kingdom", code: "UK" },
  { name: "University College London (UCL)", country: "United Kingdom", code: "UK" },
  { name: "University of Edinburgh", country: "United Kingdom", code: "UK" },
  { name: "University of Manchester", country: "United Kingdom", code: "UK" },
  { name: "King's College London (KCL)", country: "United Kingdom", code: "UK" },
  { name: "London School of Economics and Political Science (LSE)", country: "United Kingdom", code: "UK" },
  { name: "University of Bristol", country: "United Kingdom", code: "UK" },
  { name: "University of Warwick", country: "United Kingdom", code: "UK" },
  { name: "University of Glasgow", country: "United Kingdom", code: "UK" },
  { name: "University of Southampton", country: "United Kingdom", code: "UK" },
  { name: "Durham University", country: "United Kingdom", code: "UK" },
  { name: "University of Birmingham", country: "United Kingdom", code: "UK" },
  { name: "University of St Andrews", country: "United Kingdom", code: "UK" },
  { name: "University of Leeds", country: "United Kingdom", code: "UK" },
  { name: "University of Sheffield", country: "United Kingdom", code: "UK" },
  { name: "University of Nottingham", country: "United Kingdom", code: "UK" },
  { name: "Queen Mary University of London", country: "United Kingdom", code: "UK" },
  { name: "Newcastle University", country: "United Kingdom", code: "UK" },
  { name: "University of Exeter", country: "United Kingdom", code: "UK" },
  { name: "University of York", country: "United Kingdom", code: "UK" },
  { name: "University of Liverpool", country: "United Kingdom", code: "UK" },
  { name: "Cardiff University", country: "United Kingdom", code: "UK" },
  { name: "Queen's University Belfast", country: "United Kingdom", code: "UK" },
  { name: "University of Aberdeen", country: "United Kingdom", code: "UK" },
  { name: "University of Bath", country: "United Kingdom", code: "UK" },
  { name: "Lancaster University", country: "United Kingdom", code: "UK" },

  // Canada
  { name: "University of Toronto", country: "Canada", code: "CA" },
  { name: "McGill University", country: "Canada", code: "CA" },
  { name: "University of British Columbia (UBC)", country: "Canada", code: "CA" },
  { name: "University of Alberta", country: "Canada", code: "CA" },
  { name: "University of Waterloo", country: "Canada", code: "CA" },
  { name: "Western University", country: "Canada", code: "CA" },
  { name: "Université de Montréal", country: "Canada", code: "CA" },
  { name: "McMaster University", country: "Canada", code: "CA" },
  { name: "Queen's University", country: "Canada", code: "CA" },

  // Europe (Germany, Switzerland, Netherlands, France, Italy, Sweden, etc.)
  { name: "ETH Zurich", country: "Switzerland", code: "CH" },
  { name: "EPFL (École Polytechnique Fédérale de Lausanne)", country: "Switzerland", code: "CH" },
  { name: "Technical University of Munich (TUM)", country: "Germany", code: "DE" },
  { name: "Ludwig Maximilian University of Munich (LMU)", country: "Germany", code: "DE" },
  { name: "Heidelberg University", country: "Germany", code: "DE" },
  { name: "Humboldt University of Berlin", country: "Germany", code: "DE" },
  { name: "Free University of Berlin", country: "Germany", code: "DE" },
  { name: "RWTH Aachen University", country: "Germany", code: "DE" },
  { name: "Karlsruhe Institute of Technology (KIT)", country: "Germany", code: "DE" },
  { name: "University of Amsterdam", country: "Netherlands", code: "NL" },
  { name: "Delft University of Technology (TU Delft)", country: "Netherlands", code: "NL" },
  { name: "Utrecht University", country: "Netherlands", code: "NL" },
  { name: "Erasmus University Rotterdam", country: "Netherlands", code: "NL" },
  { name: "Leiden University", country: "Netherlands", code: "NL" },
  { name: "KU Leuven", country: "Belgium", code: "BE" },
  { name: "Institut Polytechnique de Paris", country: "France", code: "FR" },
  { name: "Sorbonne University", country: "France", code: "FR" },
  { name: "École Normale Supérieure (ENS Paris)", country: "France", code: "FR" },
  { name: "Sciences Po", country: "France", code: "FR" },
  { name: "Karolinska Institute", country: "Sweden", code: "SE" },
  { name: "Lund University", country: "Sweden", code: "SE" },
  { name: "KTH Royal Institute of Technology", country: "Sweden", code: "SE" },
  { name: "University of Copenhagen", country: "Denmark", code: "DK" },
  { name: "Politecnico di Milano", country: "Italy", code: "IT" },
  { name: "Sapienza University of Rome", country: "Italy", code: "IT" },
  { name: "University of Bologna", country: "Italy", code: "IT" },
  { name: "Trinity College Dublin", country: "Ireland", code: "IE" },
  { name: "University College Dublin", country: "Ireland", code: "IE" },

  // Asia & Australia
  { name: "National University of Singapore (NUS)", country: "Singapore", code: "SG" },
  { name: "Nanyang Technological University (NTU)", country: "Singapore", code: "SG" },
  { name: "Tsinghua University", country: "China", code: "CN" },
  { name: "Peking University", country: "China", code: "CN" },
  { name: "The University of Tokyo", country: "Japan", code: "JP" },
  { name: "Kyoto University", country: "Japan", code: "JP" },
  { name: "University of Hong Kong (HKU)", country: "Hong Kong", code: "HK" },
  { name: "The Hong Kong University of Science and Technology (HKUST)", country: "Hong Kong", code: "HK" },
  { name: "Seoul National University (SNU)", country: "South Korea", code: "KR" },
  { name: "KAIST", country: "South Korea", code: "KR" },
  { name: "University of Melbourne", country: "Australia", code: "AU" },
  { name: "University of Sydney", country: "Australia", code: "AU" },
  { name: "Australian National University (ANU)", country: "Australia", code: "AU" },
  { name: "UNSW Sydney", country: "Australia", code: "AU" },
  { name: "University of Queensland", country: "Australia", code: "AU" },
  { name: "Monash University", country: "Australia", code: "AU" },

  // Regional & Partner Universities (Azerbaijan, Turkey, Georgia)
  { name: "ADA University", country: "Azerbaijan", code: "AZ" },
  { name: "Baku Higher Oil School (BHOS)", country: "Azerbaijan", code: "AZ" },
  { name: "French-Azerbaijani University (UFAZ)", country: "Azerbaijan", code: "AZ" },
  { name: "Baku State University (BSU)", country: "Azerbaijan", code: "AZ" },
  { name: "Azerbaijan State University of Economics (UNEC)", country: "Azerbaijan", code: "AZ" },
  { name: "Azerbaijan State Oil and Industry University (ASOIU)", country: "Azerbaijan", code: "AZ" },
  { name: "Azerbaijan Technical University (AzTU)", country: "Azerbaijan", code: "AZ" },
  { name: "Khazar University", country: "Azerbaijan", code: "AZ" },
  { name: "Azerbaijan Medical University (AMU)", country: "Azerbaijan", code: "AZ" },
  { name: "Azerbaijan University of Languages (ADU)", country: "Azerbaijan", code: "AZ" },
  { name: "Koç University", country: "Turkey", code: "TR" },
  { name: "Sabancı University", country: "Turkey", code: "TR" },
  { name: "Middle East Technical University (METU)", country: "Turkey", code: "TR" },
  { name: "Boğaziçi University", country: "Turkey", code: "TR" },
  { name: "Bilkent University", country: "Turkey", code: "TR" },
  { name: "Istanbul Technical University (ITU)", country: "Turkey", code: "TR" },
  { name: "Tbilisi State University", country: "Georgia", code: "GE" }
]

// Universal Accredited Degree Majors Across Faculties
const ACCREDITED_MAJORS = [
  // Engineering & Technology
  { name: "Computer Science", faculty: "Engineering & Tech" },
  { name: "Software Engineering", faculty: "Engineering & Tech" },
  { name: "Data Science & Artificial Intelligence", faculty: "Engineering & Tech" },
  { name: "Electrical & Electronics Engineering", faculty: "Engineering & Tech" },
  { name: "Mechanical Engineering", faculty: "Engineering & Tech" },
  { name: "Civil & Environmental Engineering", faculty: "Engineering & Tech" },
  { name: "Chemical Engineering", faculty: "Engineering & Tech" },
  { name: "Biomedical Engineering", faculty: "Engineering & Tech" },
  { name: "Aerospace Engineering", faculty: "Engineering & Tech" },
  { name: "Cybersecurity & Information Networks", faculty: "Engineering & Tech" },
  { name: "Robotics & Automation", faculty: "Engineering & Tech" },
  { name: "Petroleum & Gas Engineering", faculty: "Engineering & Tech" },
  { name: "Materials Science & Engineering", faculty: "Engineering & Tech" },

  // Business, Economics & Management
  { name: "Business Administration & Management", faculty: "Business & Management" },
  { name: "Finance & Financial Analytics", faculty: "Business & Management" },
  { name: "Economics", faculty: "Business & Management" },
  { name: "Accounting & Auditing", faculty: "Business & Management" },
  { name: "International Business & Global Affairs", faculty: "Business & Management" },
  { name: "Marketing & Brand Strategy", faculty: "Business & Management" },
  { name: "Operations & Supply Chain Management", faculty: "Business & Management" },
  { name: "Management Information Systems (MIS)", faculty: "Business & Management" },
  { name: "Entrepreneurship & Innovation", faculty: "Business & Management" },

  // Natural Sciences & Mathematics
  { name: "Mathematics & Applied Mathematics", faculty: "Natural Sciences" },
  { name: "Physics & Applied Physics", faculty: "Natural Sciences" },
  { name: "Chemistry & Biochemistry", faculty: "Natural Sciences" },
  { name: "Biological Sciences & Genetics", faculty: "Natural Sciences" },
  { name: "Statistics & Quantitative Analysis", faculty: "Natural Sciences" },
  { name: "Earth & Environmental Sciences", faculty: "Natural Sciences" },
  { name: "Neuroscience", faculty: "Natural Sciences" },

  // Medicine & Health Sciences
  { name: "Medicine (MD / MBBS)", faculty: "Health Sciences" },
  { name: "Pharmacy & Pharmaceutical Sciences", faculty: "Health Sciences" },
  { name: "Dentistry", faculty: "Health Sciences" },
  { name: "Public Health & Epidemiology", faculty: "Health Sciences" },
  { name: "Nursing", faculty: "Health Sciences" },
  { name: "Nutrition & Dietetics", faculty: "Health Sciences" },

  // Social Sciences, Humanities & Law
  { name: "International Relations & Diplomacy", faculty: "Social Sciences & Law" },
  { name: "Law / Jurisprudence (LLB / JD)", faculty: "Social Sciences & Law" },
  { name: "Political Science & Public Policy", faculty: "Social Sciences & Law" },
  { name: "Psychology & Behavioral Sciences", faculty: "Social Sciences & Law" },
  { name: "Sociology & Anthropology", faculty: "Social Sciences & Law" },
  { name: "Journalism, Media & Communications", faculty: "Social Sciences & Law" },
  { name: "Philosophy & Ethics", faculty: "Humanities" },
  { name: "Linguistics & Translation Studies", faculty: "Humanities" },
  { name: "English Literature & Modern Languages", faculty: "Humanities" },
  { name: "History & Global Studies", faculty: "Humanities" },

  // Architecture & Design
  { name: "Architecture & Urban Planning", faculty: "Architecture & Arts" },
  { name: "Graphic & Digital Product Design (UI/UX)", faculty: "Architecture & Arts" },
  { name: "Industrial Design", faculty: "Architecture & Arts" },
  { name: "Fine Arts & Visual Media", faculty: "Architecture & Arts" }
]

// Country Codes for Mobile
const COUNTRY_CODES = [
  { code: "+994", label: "+994 (Azerbaijan)" },
  { code: "+90", label: "+90 (Turkey)" },
  { code: "+1", label: "+1 (United States / Canada)" },
  { code: "+44", label: "+44 (United Kingdom)" },
  { code: "+49", label: "+49 (Germany)" },
  { code: "+33", label: "+33 (France)" },
  { code: "+39", label: "+39 (Italy)" },
  { code: "+34", label: "+34 (Spain)" },
  { code: "+31", label: "+31 (Netherlands)" },
  { code: "+41", label: "+41 (Switzerland)" },
  { code: "+46", label: "+46 (Sweden)" },
  { code: "+47", label: "+47 (Norway)" },
  { code: "+48", label: "+48 (Poland)" },
  { code: "+971", label: "+971 (United Arab Emirates)" },
  { code: "+966", label: "+966 (Saudi Arabia)" },
  { code: "+86", label: "+86 (China)" },
  { code: "+81", label: "+81 (Japan)" },
  { code: "+82", label: "+82 (South Korea)" },
  { code: "+61", label: "+61 (Australia)" },
  { code: "+7", label: "+7 (Kazakhstan / Russia)" },
  { code: "+995", label: "+995 (Georgia)" }
]

export default function CompleteProfilePage() {
  const navigate = useNavigate()
  const { user, profile, refreshProfile, loading, signOut } = useAuth()

  // Form Fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [countryCode, setCountryCode] = useState('+994')
  const [phoneRaw, setPhoneRaw] = useState('')
  const [university, setUniversity] = useState('')
  const [major, setMajor] = useState('')
  const [gender, setGender] = useState('')

  // Autocomplete UI dropdown controls
  const [uniQuery, setUniQuery] = useState('')
  const [showUniDropdown, setShowUniDropdown] = useState(false)
  const [majorQuery, setMajorQuery] = useState('')
  const [showMajorDropdown, setShowMajorDropdown] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const uniDropdownRef = useRef(null)
  const majorDropdownRef = useRef(null)

  // Populate existing data if available
  useEffect(() => {
    if (profile) {
      if (profile.full_name) {
        const parts = profile.full_name.trim().split(/\s+/)
        setFirstName(parts[0] || '')
        setLastName(parts.slice(1).join(' ') || '')
      }
      if (profile.phone) {
        const matched = COUNTRY_CODES.find(c => profile.phone.startsWith(c.code))
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

  // Auto-detect country code as user types in phone box
  function handlePhoneChange(val) {
    const clean = val.replace(/[^0-9+]/g, '')
    if (clean.startsWith('+')) {
      const match = COUNTRY_CODES.find(c => clean.startsWith(c.code))
      if (match) {
        setCountryCode(match.code)
        setPhoneRaw(clean.slice(match.code.length))
        return
      }
    }
    setPhoneRaw(val)
  }

  // Filtered universities
  const filteredUniversities = useMemo(() => {
    if (!uniQuery.trim()) return TOP_UNIVERSITIES
    const q = uniQuery.toLowerCase()
    return TOP_UNIVERSITIES.filter(u =>
      u.name.toLowerCase().includes(q) || u.country.toLowerCase().includes(q)
    )
  }, [uniQuery])

  // Filtered majors
  const filteredMajors = useMemo(() => {
    if (!majorQuery.trim()) return ACCREDITED_MAJORS
    const q = majorQuery.toLowerCase()
    return ACCREDITED_MAJORS.filter(m =>
      m.name.toLowerCase().includes(q) || m.faculty.toLowerCase().includes(q)
    )
  }, [majorQuery])

  function handleSelectUniversity(uniObj) {
    setUniversity(uniObj.name)
    setUniQuery(uniObj.name)
    setShowUniDropdown(false)
  }

  function handleSelectMajor(majObj) {
    setMajor(majObj.name)
    setMajorQuery(majObj.name)
    setShowMajorDropdown(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!user) return

    if (!firstName.trim()) {
      setError('Please enter your First Name.')
      return
    }
    if (!lastName.trim()) {
      setError('Please enter your Last Name.')
      return
    }
    if (!phoneRaw.trim()) {
      setError('Please enter your Phone Number.')
      return
    }
    if (!university.trim()) {
      setError('Please select or enter your University.')
      return
    }
    if (!major.trim()) {
      setError('Please select your Degree Major.')
      return
    }
    if (!gender) {
      setError('Please select your Gender (Male, Female, or Other).')
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
              Set up your verified student identity, contact mobile number, and target university program.
            </p>

            <div className="complete-profile-points">
              <div className="complete-profile-point">
                <span className="complete-profile-pointdot" />
                <span>Automatic international dialing code detection and validation.</span>
              </div>
              <div className="complete-profile-point">
                <span className="complete-profile-pointdot" />
                <span>Comprehensive directory of top world universities and colleges.</span>
              </div>
              <div className="complete-profile-point">
                <span className="complete-profile-pointdot" />
                <span>Accredited academic degrees mapped across all major faculties.</span>
              </div>
            </div>
          </div>

          {/* Right Form Card */}
          <form className="complete-profile-card" onSubmit={handleSubmit}>
            <div className="complete-profile-cardhead">
              <div>
                <p className="complete-profile-eyebrow">Student Setup</p>
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
                  placeholder="e.g. Doe"
                  autoComplete="family-name"
                  required
                />
              </label>

              {/* 3. Phone with Country Dropdown & Auto Detection */}
              <div className="complete-profile-field complete-profile-field--full">
                <span>Mobile Phone <em className="req-star">*</em></span>
                <div className="phone-input-combo">
                  <div className="phone-country-select-wrap">
                    <select
                      className="phone-country-select"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                    >
                      {COUNTRY_CODES.map((c) => (
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
                <small className="field-hint">e.g. Typing +994, +1, +44, or +90 detects country automatically</small>
              </div>

              {/* 4. University Search & Autocomplete */}
              <div className="complete-profile-field complete-profile-field--full" ref={uniDropdownRef}>
                <div className="field-label-row">
                  <span>University / Institution <em className="req-star">*</em></span>
                  <span className="field-badge-live">Live Search</span>
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
                    placeholder="Search top world universities or enter custom..."
                    autoComplete="off"
                    required
                  />
                  {showUniDropdown && (
                    <div className="autocomplete-dropdown">
                      {filteredUniversities.length > 0 ? (
                        filteredUniversities.map((u) => (
                          <button
                            key={u.name}
                            type="button"
                            className={`autocomplete-item ${u.name === university ? 'autocomplete-item--active' : ''}`}
                            onClick={() => handleSelectUniversity(u)}
                          >
                            <span className="autocomplete-icon">🏛️</span>
                            <div className="autocomplete-text">
                              <strong>{u.name}</strong>
                              <small>{u.country}</small>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="autocomplete-empty">
                          <p>"{uniQuery}"</p>
                          <small>Press Enter to use this institution name.</small>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 5. Major / Program (Appears after University is selected) */}
              <div className="complete-profile-field complete-profile-field--full" ref={majorDropdownRef}>
                <div className="field-label-row">
                  <span>Major / Academic Program <em className="req-star">*</em></span>
                  {!university && <span className="field-locked-pill">🔒 Enter university above first</span>}
                </div>
                <div className="autocomplete-wrap">
                  <input
                    type="text"
                    disabled={!university}
                    value={majorQuery}
                    onChange={(e) => {
                      setMajorQuery(e.target.value)
                      setMajor(e.target.value)
                      setShowMajorDropdown(true)
                    }}
                    onFocus={() => setShowMajorDropdown(true)}
                    placeholder={
                      university
                        ? `Search accredited majors offered at ${university}...`
                        : 'Select or enter university first'
                    }
                    autoComplete="off"
                    required
                  />
                  {showMajorDropdown && university && (
                    <div className="autocomplete-dropdown">
                      {filteredMajors.length > 0 ? (
                        filteredMajors.map((m) => (
                          <button
                            key={m.name}
                            type="button"
                            className={`autocomplete-item ${m.name === major ? 'autocomplete-item--active' : ''}`}
                            onClick={() => handleSelectMajor(m)}
                          >
                            <span className="autocomplete-icon">🎓</span>
                            <div className="autocomplete-text">
                              <strong>{m.name}</strong>
                              <small>{m.faculty} · Official Accredited Degree</small>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="autocomplete-empty">
                          <p>"{majorQuery}"</p>
                          <small>Press Enter to save this exact major.</small>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 6. Gender Selection */}
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
                disabled={saving || !firstName || !lastName || !phoneRaw || !university || !major || !gender}
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
