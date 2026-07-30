import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './RegisterPage.css'

export default function RegisterPage() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleEmailSignUp(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: { full_name: form.fullName.trim() },
      },
    })

    setLoading(false)

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    if (data.session) {
      navigate('/complete-profile', { replace: true })
      return
    }

    setSuccess(
      'Account created successfully! Please check your email and confirm your account before signing in.'
    )
  }

  async function handleGoogleSignIn() {
    setLoading(true)
    setError('')
    setSuccess('')

    // Supabase OAuth needs a valid redirect URL configured in your Supabase dashboard.
    // We keep it explicit to reduce confusion during local dev.
    const redirectTo = `${window.location.origin}/complete-profile`

    try {
      // Some errors only appear after attempting OAuth.
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      })

      if (googleError) {
        setError(googleError.message)
        setLoading(false)
        return
      }

      setSuccess('Redirecting to Google...')
    } catch (e) {
      setError(e?.message || 'Google sign-in failed')
      setLoading(false)
    }
  }

  return (
    <main className="reg-page">
      {/* 3D floating orbs */}
      <div className="reg-orb reg-orb--1" />
      <div className="reg-orb reg-orb--2" />
      <div className="reg-orb reg-orb--3" />

      <div className="reg-container">
        {/* Left — Brand / Information */}
        <aside className="reg-brand">
          <Link to="/" className="reg-logo">
            <span className="reg-logo-icon">A</span>
            AppTrack
          </Link>

          <div className="reg-brand-content">
            <span className="reg-badge">🎓 Student Platform</span>
            <h1>Start your journey</h1>
            <p className="reg-brand-desc">
              Create your account and track every university application, document, 
              and certification from one beautiful workspace.
            </p>

            <div className="reg-steps">
              <div className="reg-step reg-step--active">
                <span className="reg-step-num">1</span>
                <div className="reg-step-text">
                  <strong>Create account</strong>
                  <small>Sign up with email or Google</small>
                </div>
              </div>
              <div className="reg-step">
                <span className="reg-step-num">2</span>
                <div className="reg-step-text">
                  <strong>Complete profile</strong>
                  <small>Add your academic details</small>
                </div>
              </div>
              <div className="reg-step">
                <span className="reg-step-num">3</span>
                <div className="reg-step-text">
                  <strong>Start tracking</strong>
                  <small>Manage applications & certifications</small>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Right — Registration Form */}
        <div className="reg-form-wrap">
          <div className="reg-form-card">
            <div className="reg-form-header">
              <h2>Create account</h2>
              <p>Sign up to start organizing your applications.</p>
            </div>

            {/* Google OAuth */}
            <button
              type="button"
              className="reg-social-btn reg-social-btn--google"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div className="reg-divider">
              <span>or sign up with email</span>
            </div>

            <form onSubmit={handleEmailSignUp}>
              <div className="reg-field">
                <label htmlFor="reg-name">Full name</label>
                <input
                  id="reg-name"
                  type="text"
                  value={form.fullName}
                  onChange={(e) => updateField('fullName', e.target.value)}
                  placeholder="Your full name"
                  autoComplete="name"
                  required
                />
              </div>

              <div className="reg-field">
                <label htmlFor="reg-email">Email address</label>
                <input
                  id="reg-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  inputMode="email"
                  required
                />
              </div>

              <div className="reg-field">
                <label htmlFor="reg-password">Password</label>
                <div className="reg-password-wrap">
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    placeholder="Create a password"
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    className="reg-pw-toggle"
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={showPassword ? 'Hide' : 'Show'}
                  >
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
                <small className="reg-hint">At least 6 characters</small>
              </div>

              {error && (
                <div className="reg-msg reg-msg--error" role="alert">
                  <span>⚠️</span> {error}
                </div>
              )}

              {success && (
                <div className="reg-msg reg-msg--success" role="status">
                  <span>📬</span> {success}
                </div>
              )}

              <button type="submit" className="reg-submit" disabled={loading}>
                {loading ? (
                  <span className="reg-spinner" />
                ) : 'Create account'}
              </button>
            </form>

            <p className="reg-footer-text">
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
