/**
 * ============================================================================
 * App.jsx — Application Root Component
 * ============================================================================
 *
 * PURPOSE:
 *   Defines the entire routing structure of AppTrack.
 *   Determines which page a user sees based on their authentication state,
 *   profile completion status, and role (student or admin).
 *
 * ROUTING FLOW:
 *   1. User visits "/" → RootRedirect decides where to send them:
 *      - Not logged in            → HomePage (landing page)
 *      - Logged in, no profile    → /complete-profile
 *      - Logged in as admin       → /admin
 *      - Logged in as student     → /student
 *
 *   2. Public routes (only for guests):    /login, /register
 *   3. Protected routes (require auth):    /complete-profile
 *   4. Role-based routes (require role):   /student, /admin
 *
 * ROUTE GUARDS:
 *   - <PublicRoute>    → Redirects logged-in users away from login/register
 *   - <ProtectedRoute> → Redirects guests to login
 *   - <RoleRoute>      → Ensures user has the correct role
 * ============================================================================
 */

import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import PublicRoute from './components/PublicRoute'
import ProtectedRoute from './components/ProtectedRoute'
import RoleRoute from './components/RoleRoute'

import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import CompleteProfilePage from './pages/CompleteProfilePage'
import StudentDashboard from './pages/StudentDashboard'
import AdminDashboard from './pages/AdminDashboard'

/**
 * RootRedirect
 * ------------
 * Smart entry point for the "/" route.
 * Redirects the user to the appropriate page based on their auth state
 * and profile status. Shown while the auth context is still loading.
 */
function RootRedirect() {
  const { user, profile, loading } = useAuth()

  // While auth state is being resolved, render nothing (prevents flicker)
  if (loading) return null

  // Guest → show the public landing page
  if (!user) return <HomePage />

  // Logged in but profile not yet completed → force complete-profile flow
  if (!profile?.is_profile_completed) {
    return <Navigate to="/complete-profile" replace />
  }

  // Route the user based on their role
  if (profile?.role === 'admin') return <Navigate to="/admin" replace />
  return <Navigate to="/student" replace />
}

/**
 * App
 * ---
 * The top-level component that defines all application routes.
 */
function App() {
  return (
    <Routes>
      {/* Landing / smart redirect */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="/home-page" element={<HomePage />} />

      {/* ── Public routes (guests only) ─────────────────────────── */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />

      {/* ── Protected route (any authenticated user) ────────────── */}
      <Route
        path="/complete-profile"
        element={
          <ProtectedRoute>
            <CompleteProfilePage />
          </ProtectedRoute>
        }
      />

      {/* ── Role-based routes ───────────────────────────────────── */}
      <Route
        path="/student"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRole="student">
              <StudentDashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRole="admin">
              <AdminDashboard />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App