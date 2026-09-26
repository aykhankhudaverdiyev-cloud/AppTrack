import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import './CompleteProfilePage.css'

// Universitetlər və onlara aid real ixtisasların kataloqu
const UNIVERSITIES = [
  {
    name: "University of Glasgow",
    country: "United Kingdom",
    flag: "🇬🇧",
    majors: [
      "Chemical Engineering",
      "Computer Science",
      "Software Engineering",
      "Mechanical Engineering",
      "Aerospace Engineering",
      "Biomedical Engineering",
      "Medicine",
      "Economics",
      "Law",
      "Business Administration",
      "Psychology",
      "Mathematics",
      "Physics"
    ]
  },
  {
    name: "University of Oxford",
    country: "United Kingdom",
    flag: "🇬🇧",
    majors: [
      "Philosophy, Politics and Economics (PPE)",
      "Computer Science",
      "Law (Jurisprudence)",
      "Medicine",
      "Engineering Science",
      "Mathematics & Computer Science",
      "Economics & Management",
      "Physics",
      "Biochemistry",
      "History"
    ]
  },
  {
    name: "University of Cambridge",
    country: "United Kingdom",
    flag: "🇬🇧",
    majors: [
      "Computer Science",
      "Natural Sciences",
      "Engineering",
      "Medicine",
      "Law",
      "Economics",
      "Mathematics",
      "Architecture",
      "Psychological & Behavioural Sciences"
    ]
  },
  {
    name: "Imperial College London",
    country: "United Kingdom",
    flag: "🇬🇧",
    majors: [
      "Computing (Computer Science)",
      "Chemical Engineering",
      "Mechanical Engineering",
      "Electrical & Electronic Engineering",
      "Biomedical Engineering",
      "Aeronautical Engineering",
      "Mathematics with Statistics",
      "Physics",
      "Design Engineering"
    ]
  },
  {
    name: "University College London (UCL)",
    country: "United Kingdom",
    flag: "🇬🇧",
    majors: [
      "Computer Science",
      "Architecture",
      "Economics",
      "Law",
      "Biochemical Engineering",
      "Management Science",
      "Neuroscience",
      "Pharmacy",
      "Information Management for Business"
    ]
  },
  {
    name: "Harvard University",
    country: "United States",
    flag: "🇺🇸",
    majors: [
      "Computer Science",
      "Economics",
      "Applied Mathematics",
      "Government & Political Science",
      "Molecular & Cellular Biology",
      "Statistics & Data Science",
      "Psychology",
      "Bioengineering",
      "Social Studies"
    ]
  },
  {
    name: "Massachusetts Institute of Technology (MIT)",
    country: "United States",
    flag: "🇺🇸",
    majors: [
      "Computer Science and Engineering",
      "Artificial Intelligence & Decision Making",
      "Mechanical Engineering",
      "Electrical Engineering & Computer Science",
      "Chemical Engineering",
      "Aerospace Engineering",
      "Computation and Cognition",
      "Mathematics",
      "Physics"
    ]
  },
  {
    name: "Stanford University",
    country: "United States",
    flag: "🇺🇸",
    majors: [
      "Computer Science",
      "Symbolic Systems",
      "Management Science & Engineering",
      "Mechanical Engineering",
      "Economics",
      "Bioengineering",
      "Product Design",
      "Electrical Engineering"
    ]
  },
  {
    name: "ADA University",
    country: "Azerbaijan",
    flag: "🇦🇿",
    majors: [
      "Computer Science",
      "Information Technology",
      "Computer Engineering",
      "Business Administration",
      "Economics",
      "Finance",
      "International Studies",
      "Public Affairs",
      "Architecture",
      "Interior Design"
    ]
  },
  {
    name: "Baku Higher Oil School (BHOS / BANM)",
    country: "Azerbaijan",
    flag: "🇦🇿",
    majors: [
      "Chemical Engineering",
      "Petroleum Engineering",
      "Process Automation Engineering",
      "Information Security",
      "Computer Engineering",
      "Business Administration"
    ]
  },
  {
    name: "French-Azerbaijani University (UFAZ)",
    country: "Azerbaijan",
    flag: "🇦🇿",
    majors: [
      "Computer Science",
      "Chemical Engineering",
      "Geophysical Engineering",
      "Oil & Gas Engineering"
    ]
  },
  {
    name: "Baku State University (BDU)",
    country: "Azerbaijan",
    flag: "🇦🇿",
    majors: [
      "Computer Science",
      "Applied Mathematics & Cybernetics",
      "Law",
      "International Relations",
      "Physics",
      "Chemistry",
      "Biology",
      "Journalism",
      "Economics"
    ]
  },
  {
    name: "Azerbaijan State Oil and Industry University (ADNSU)",
    country: "Azerbaijan",
    flag: "🇦🇿",
    majors: [
      "Information Technologies",
      "Computer Engineering",
      "Chemical Engineering",
      "Oil and Gas Engineering",
      "Automation and Control Systems",
      "Energy Engineering",
      "Ecology Engineering"
    ]
  },
  {
    name: "Khazar University",
    country: "Azerbaijan",
    flag: "🇦🇿",
    majors: [
      "Computer Science",
      "Computer Engineering",
      "Petroleum Engineering",
      "Business Administration",
      "Economics",
      "Finance",
      "Psychology",
      "International Relations"
    ]
  },
  {
    name: "Azerbaijan State University of Economics (UNEC)",
    country: "Azerbaijan",
    flag: "🇦🇿",
    majors: [
      "Finance",
      "Accounting and Audit",
      "Economics",
      "Business Administration",
      "Marketing",
      "International Trade & Logistics",
      "Digital Economics",
      "Information Security"
    ]
  },
  {
    name: "Technical University of Munich (TUM)",
    country: "Germany",
    flag: "🇩🇪",
    majors: [
      "Informatics (Computer Science)",
      "Mechanical Engineering",
      "Electrical & Computer Engineering",
      "Chemical Engineering",
      "Management & Technology",
      "Data Engineering & Analytics"
    ]
  },
  {
    name: "ETH Zurich",
    country: "Switzerland",
    flag: "🇨🇭",
    majors: [
      "Computer Science",
      "Mechanical Engineering",
      "Electrical Engineering",
      "Chemical Engineering",
      "Civil Engineering",
      "Mathematics",
      "Physics"
    ]
  },
  {
    name: "University of Toronto",
    country: "Canada",
    flag: "🇨🇦",
    majors: [
      "Computer Science",
      "Engineering Science",
      "Rotman Commerce",
      "Mechanical Engineering",
      "Economics",
      "Life Sciences",
      "Data Science"
    ]
  }
]

// Beynəlxalq ölkə və nömrə prefiksləri
const COUNTRY_CODES = [
  { code: "+994", flag: "🇦🇿", name: "Azerbaijan" },
  { code: "+90", flag: "🇹🇷", name: "Turkey" },
  { code: "+1", flag: "🇺🇸", name: "United States / Canada" },
  { code: "+44", flag: "🇬🇧", name: "United Kingdom" },
  { code: "+49", flag: "🇩🇪", name: "Germany" },
  { code: "+7", flag: "🇷🇺", name: "Russia / Kazakhstan" },
  { code: "+971", flag: "🇦🇪", name: "UAE" },
  { code: "+995", flag: "🇬🇪", name: "Georgia" },
  { code: "+998", flag: "🇺🇿", name: "Uzbekistan" },
  { code: "+33", flag: "🇫🇷", name: "France" },
  { code: "+39", flag: "🇮🇹", name: "Italy" },
  { code: "+34", flag: "🇪🇸", name: "Spain" },
  { code: "+48", flag: "🇵🇱", name: "Poland" },
  { code: "+86", flag: "🇨🇳", name: "China" },
  { code: "+82", flag: "🇰🇷", name: "South Korea" },
  { code: "+81", flag: "🇯🇵", name: "Japan" },
]

export default function CompleteProfilePage() {
  const navigate = useNavigate()
  const { user, profile, loading, refreshProfile, signOut } = useAuth()

  // Form sahələri: Ad və Soyad ayrı
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [countryCode, setCountryCode] = useState('+994')
  const [phoneRaw, setPhoneRaw] = useState('')
  const [university, setUniversity] = useState('')
  const [major, setMajor] = useState('')
  const [gender, setGender] = useState('')

  // Autocomplete UI dropdown vəziyyətləri
  const [uniQuery, setUniQuery] = useState('')
  const [showUniDropdown, setShowUniDropdown] = useState(false)
  const [majorQuery, setMajorQuery] = useState('')
  const [showMajorDropdown, setShowMajorDropdown] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const uniDropdownRef = useRef(null)
  const majorDropdownRef = useRef(null)

  // Mövcud profildən yükləmə
  useEffect(() => {
    if (profile) {
      if (profile.full_name) {
        const parts = profile.full_name.trim().split(' ')
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

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login')
    }
  }, [loading, user, navigate])

  // Kənara basanda dropdown-u bağlamaq
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

  // Nömrə yazarkən +994 kimi kodları avtomatik tanımaq
  const handlePhoneChange = (val) => {
    const clean = val.replace(/\s+/g, '')
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

  // Filtrələnmiş universitetlər
  const filteredUniversities = useMemo(() => {
    if (!uniQuery.trim()) return UNIVERSITIES
    const q = uniQuery.toLowerCase()
    return UNIVERSITIES.filter(u =>
      u.name.toLowerCase().includes(q) || u.country.toLowerCase().includes(q)
    )
  }, [uniQuery])

  // Seçilmiş universitet obyekti
  const selectedUniObj = useMemo(() => {
    return UNIVERSITIES.find(u => u.name.toLowerCase() === university.toLowerCase())
  }, [university])

  // Həmin universitetdə mövcud olan ixtisaslar
  const availableMajors = useMemo(() => {
    if (!selectedUniObj) return []
    if (!majorQuery.trim()) return selectedUniObj.majors
    const q = majorQuery.toLowerCase()
    return selectedUniObj.majors.filter(m => m.toLowerCase().includes(q))
  }, [selectedUniObj, majorQuery])

  // Universitet seçiləndə
  const handleSelectUniversity = (uniObj) => {
    setUniversity(uniObj.name)
    setUniQuery(uniObj.name)
    setShowUniDropdown(false)
    if (!uniObj.majors.includes(major)) {
      setMajor('')
      setMajorQuery('')
    }
  }

  // İxtisas seçiləndə
  const handleSelectMajor = (majName) => {
    setMajor(majName)
    setMajorQuery(majName)
    setShowMajorDropdown(false)
  }

  const currentCountry = useMemo(() => {
    return COUNTRY_CODES.find(c => c.code === countryCode) || COUNTRY_CODES[0]
  }, [countryCode])

  // Ciddi yoxlama ilə formu göndərmək
  async function handleSubmit(e) {
    e.preventDefault()
    if (!user) return

    if (!firstName.trim()) {
      setError('Zəhmət olmasa Adınızı qeyd edin.')
      return
    }
    if (!lastName.trim()) {
      setError('Zəhmət olmasa Soyadınızı qeyd edin.')
      return
    }
    if (!phoneRaw.trim()) {
      setError('Zəhmət olmasa Əlaqə nömrənizi qeyd edin.')
      return
    }
    if (!university.trim()) {
      setError('Zəhmət olmasa siyahıdan Universitet seçin.')
      return
    }
    if (!major.trim()) {
      setError('Zəhmət olmasa seçdiyiniz Universitetdəki aktiv İxtisası (Major) seçin.')
      return
    }
    if (!gender) {
      setError('Zəhmət olmasa Cinsiyyəti (Male, Female, Other) seçin.')
      return
    }

    const full_name = `${firstName.trim()} ${lastName.trim()}`
    const full_phone = `${countryCode} ${phoneRaw.trim()}`

    setSaving(true)
    setError('')

    const payload = {
      full_name,
      phone: full_phone,
      major: major.trim(),
      university: university.trim(),
      gender,
      is_profile_completed: true,
    }

    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert({ id: user.id, ...payload })

    setSaving(false)

    if (upsertError) {
      setError(upsertError.message)
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
            <p className="complete-profile-loading">Profil məlumatları yüklənir...</p>
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
              Təsdiqlənmiş şəxsi məlumatlarınızı, telefon nömrənizi və rəsmi akademik ixtisasınızı daxil edin.
              Bütün xanaların doldurulması məcburidir.
            </p>

            <div className="complete-profile-points">
              <div className="complete-profile-point">
                <span className="complete-profile-pointdot" />
                <span>+994 və digər beynəlxalq ölkə kodlarının avtomatik tanınması.</span>
              </div>
              <div className="complete-profile-point">
                <span className="complete-profile-pointdot" />
                <span>Universitet seçiminə əsasən avtomatik təklif edilən akkreditə olunmuş ixtisaslar.</span>
              </div>
              <div className="complete-profile-point">
                <span className="complete-profile-pointdot" />
                <span>Tələbə və kurator panelləri ilə birbaşa sinxronizasiya.</span>
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
              {/* 1. First Name */}
              <label className="complete-profile-field">
                <span>First name <em className="req-star">*</em></span>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Kojiro"
                  autoComplete="given-name"
                  required
                />
              </label>

              {/* 2. Last Name */}
              <label className="complete-profile-field">
                <span>Last name <em className="req-star">*</em></span>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Hyugor"
                  autoComplete="family-name"
                  required
                />
              </label>

              {/* 3. Phone with Country Dropdown & Auto Detection */}
              <div className="complete-profile-field complete-profile-field--full">
                <span>Phone number <em className="req-star">*</em></span>
                <div className="phone-input-group">
                  <div className="phone-country-select-wrap">
                    <span className="phone-country-flag">{currentCountry.flag}</span>
                    <select
                      className="phone-country-select"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.code} ({c.name})
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
                <small className="field-hint">Məsələn: +994 yazdıqda Azərbaycan avtomatik tanınır</small>
              </div>

              {/* 4. University Autocomplete */}
              <div className="complete-profile-field complete-profile-field--full" ref={uniDropdownRef}>
                <div className="field-label-row">
                  <span>University <em className="req-star">*</em></span>
                  {selectedUniObj && <span className="uni-verified-badge">✓ {selectedUniObj.country}</span>}
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
                    placeholder="Universitet axtarın (e.g. Glasgow, Oxford, ADA)..."
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
                            <span className="autocomplete-flag">{u.flag}</span>
                            <div className="autocomplete-text">
                              <strong>{u.name}</strong>
                              <small>{u.country} · {u.majors.length} ixtisas</small>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="autocomplete-empty">
                          <p>"{uniQuery}" siyahıda tapılmadı.</p>
                          <small>Özəl ad kimi saxlaya və aşağıdan ixtisası yaza bilərsiniz.</small>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 5. Major Autocomplete (Universitetdən asılı) */}
              <div className="complete-profile-field complete-profile-field--full" ref={majorDropdownRef}>
                <div className="field-label-row">
                  <span>Major / Program <em className="req-star">*</em></span>
                  {!university && <span className="field-locked-pill">🔒 Əvvəlcə universiteti seçin</span>}
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
                        ? `${university} üzrə aktiv ixtisası axtarın...`
                        : 'Yuxarıdan universiteti seçin'
                    }
                    autoComplete="off"
                    required
                  />
                  {showMajorDropdown && university && (
                    <div className="autocomplete-dropdown">
                      {availableMajors.length > 0 ? (
                        availableMajors.map((m) => (
                          <button
                            key={m}
                            type="button"
                            className={`autocomplete-item ${m === major ? 'autocomplete-item--active' : ''}`}
                            onClick={() => handleSelectMajor(m)}
                          >
                            <span className="autocomplete-icon">🎓</span>
                            <div className="autocomplete-text">
                              <strong>{m}</strong>
                              <small>{university} üzrə təsdiqlənmiş proqram</small>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="autocomplete-empty">
                          <p>"{majorQuery}" uyğun gələn ixtisas tapılmadı.</p>
                          <small>Dəqiq ixtisas adını əllə daxil edə bilərsiniz.</small>
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
                      {g === 'Male' ? '👨 Male' : g === 'Female' ? '👩 Female' : '⚧ Other'}
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
                {saving ? 'Yadda saxlanılır...' : 'Save & Continue →'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
