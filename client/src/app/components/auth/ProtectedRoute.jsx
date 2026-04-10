import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../../context/AuthContext'
import { AlertCircle } from 'lucide-react'

/**
 * ProtectedRoute Wrapper
 * Ensures a user is authenticated and checks if their role matches the permitted roles.
 */
export function ProtectedRoute({ children, allowedRoles = [] }) {
  const { isAuthenticated, isLoadingUser, getUserRole } = useAuth()
  const location = useLocation()

  if (isLoadingUser) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[var(--gold-primary)]/30 border-t-[var(--gold-primary)] rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    // Redirect unauthenticated users to the login page, maintaining their intended destination
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const role = getUserRole() || 'customer'

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    // If the user's role is not allowed, redirect them to their respective dashboard
    if (role === 'super_admin' || role === 'admin') {
      return <Navigate to="/admin" replace />
    }
    if (role === 'staff') {
      return <Navigate to="/staff" replace />
    }
    return <Navigate to="/dashboard" replace />
  }

  return children
}
