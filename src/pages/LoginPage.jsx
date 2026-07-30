import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getMyProfile } from '../Services/ProfileService'
import './LoginPage.css'

export default function LoginPage() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    email: '',
    password: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleEmailSignIn(event) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: form.email.trim(),
      password: form.password,
    })

    if (signInError) {
      setLoading(false)
      setError(signInError.message)
      return
    }

    const user = data.user
    if (!user) {
      setLoading(false)
      setError('Unable to sign in. Please try again.')
      return
    }

    try {
      const profile = await getMyProfile(user.id)
      setLoading(false)

      if (!profile?.is_profile_completed) {
        navigate('/complete-profile', { replace: true })
        return
      }

      if (profile?.role === 'admin') {
        navigate('/admin', { replace: true })
        return
      }

      navigate('/student', { replace: true })
    } catch (profileError) {
      setLoading(false)
      setError(profileError.message || 'Failed to load your profile.')
    }
  }

  async function handleGoogleSignIn() {
    setLoading(true)
    setError('')

    // Supabase OAuth needs a valid redirect URL configured in your Supabase dashboard.
    const redirectTo = `${window.location.origin}/complete-profile`

    try {
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      })

      if (googleError) {
        setError(googleError.message)
        setLoading(false)
        return
      }
    
      // If OAuth succeeds, Supabase will redirect away from the page.
      // If it doesn't, user will see errors above.
    } catch (e) {
      setError(e?.message || 'Google sign-in failed')
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      {/* 3D floating orbs */}
      <div className="login-orb login-orb--1" />
      <div className="login-orb login-orb--2" />
      <div className="login-orb login-orb--3" />

      <div className="login-container">
        {/* Left — Brand / Information */}
        <aside className="login-brand-panel">
          <Link to="/" className="login-logo">
            <span className="login-logo-icon">A</span>
            AppTrack
          </Link>

          <div className="login-brand-content">
            <span className="login-badge">👋 Welcome back</span>
            <h1>Your applications,<br />one dashboard</h1>
            <p className="login-brand-desc">
              Sign in to manage your university applications, upload documents, 
              track certifications, and control your public profile.
            </p>

            <div className="login-features">
              <div className="login-feature">
                <span className="login-feature-icon">📄</span>
                <div>
                  <strong>Track applications</strong>
                  <small>Monitor every deadline and decision</small>
                </div>
              </div>
              <div className="login-feature">
                <span className="login-feature-icon">🔐</span>
                <div>
                  <strong>Privacy first</strong>
                  <small>You control what goes public</small>
                </div>
              </div>
              <div className="login-feature">
                <span className="login-feature-icon">🎯</span>
                <div>
                  <strong>Stay organized</strong>
                  <small>Documents, certifications, notes</small>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Right — Sign In Form */}
        <div className="login-form-wrap">
          <div className="login-form-card">
            <div className="login-form-header">
              <h2>Sign in</h2>
              <p>Welcome back to your workspace.</p>
            </div>

            {/* Google OAuth */}
            <button
              type="button"
              className="login-social-btn login-social-btn--google"
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

            <div className="login-divider">
              <span>or sign in with email</span>
            </div>

            <form onSubmit={handleEmailSignIn}>
              <div className="login-field">
                <label htmlFor="login-email">Email address</label>
                <input
                  id="login-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  inputMode="email"
                  required
                />
              </div>

              <div className="login-field">
                <label htmlFor="login-password">Password</label>
                <div className="login-password-wrap">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="login-pw-toggle"
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
              </div>

              {error && (
                <div className="login-msg login-msg--error" role="alert">
                  <span>⚠️</span> {error}
                </div>
              )}

              <button type="submit" className="login-submit-btn" disabled={loading}>
                {loading ? <span className="login-spinner" /> : 'Sign in'}
              </button>
            </form>

            <p className="login-footer-text">
              Don't have an account? <Link to="/register">Create one</Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
