import { Navigate, Outlet } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import { homePath } from '../utils/format'

export function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="grid min-h-svh place-items-center text-muted-foreground">Carregando...</div>
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

export function GuestRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="grid min-h-svh place-items-center text-muted-foreground">Carregando...</div>
  }
  if (user) {
    return <Navigate to={homePath(user.role)} replace />
  }
  return <Outlet />
}

export function AdminRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="grid min-h-svh place-items-center text-muted-foreground">Carregando...</div>
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (user.role !== 'ADMIN') {
    return <Navigate to={homePath(user.role)} replace />
  }
  return <Outlet />
}
