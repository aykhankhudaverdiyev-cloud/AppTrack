import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function PublicRoute({ children }) {
  const { user, profile, loading } = useAuth()

  if (loading) return null

  if (!user) return children

  if (!profile) return null

  if (profile?.role === 'admin') {
    return <Navigate to="/admin" replace />
  }

  if (profile?.is_profile_completed) {
    return <Navigate to="/student" replace />
  }

  return children
}