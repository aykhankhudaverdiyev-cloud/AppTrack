import { Navigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export default function RoleRoute({ allowedRole, children }) {
  const { user, profile, loading } = useAuth()

  if (loading) return <div>Loading...</div>

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Admins don't need to complete profile - auto-set is_profile_completed to true
  if (profile?.role === "admin") {
    // Admins are automatically considered as having completed profile
    return children
  }

  // For students, require profile completion
  if (!profile) {
    return <Navigate to="/complete-profile" replace />
  }

  if (!profile.is_profile_completed) {
    return <Navigate to="/complete-profile" replace />
  }

  if (profile.role !== allowedRole) {
    if (profile.role === "admin") {
      return <Navigate to="/admin" replace />
    }

    return <Navigate to="/student" replace />
  }

  return children
}
