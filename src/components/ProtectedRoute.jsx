import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export function ProtectedRoute({ children, requireRole }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-dvh bg-midnight flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-clipper-red border-t-transparent rounded-full animate-spin" />
          <span className="font-heading text-[11px] tracking-widest uppercase text-warm-grey">Loading...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requireRole && profile?.role !== requireRole && profile?.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return children
}
