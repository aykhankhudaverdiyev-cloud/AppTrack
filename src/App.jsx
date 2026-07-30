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

function RootRedirect() {
  const { user, profile, loading } = useAuth()

  if (loading) return <div>Loading...</div>
  if (!user) return <HomePage />
  if (!profile?.is_profile_completed) return <Navigate to="/complete-profile" replace />
  if (profile?.role === 'admin') return <Navigate to="/admin" replace />
  return <Navigate to="/student" replace />
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/home-page" element={<HomePage />} />
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
      <Route
        path="/complete-profile"
        element={
          <ProtectedRoute>
            <CompleteProfilePage />
          </ProtectedRoute>
        }
      />
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