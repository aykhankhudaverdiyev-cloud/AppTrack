import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function HomeRedirect() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return <div>Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!profile || !profile.is_profile_completed) {
    return <Navigate to="/complete-profile" replace />
  }

  // Role-a görə dashboard seçimi
  if (profile.role === 'admin') {
    return <Navigate to="/admin" replace />
  }

  return <Navigate to="/student" replace />
}