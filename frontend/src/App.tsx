import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'

import { AdminRoute, GuestRoute, ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider } from './contexts/AuthContext'
import { NotificationsProvider } from './contexts/NotificationsContext'
import { AppLayout } from './layouts/AppLayout'
import { DashboardPage } from './pages/Dashboard/DashboardPage'
import { LoginPage } from './pages/Login/LoginPage'
import { OverviewPage } from './pages/Overview/OverviewPage'
import { ProjectPage } from './pages/Project/ProjectPage'
import { UsersPage } from './pages/Users/UsersPage'

function LegacyGroupRedirect() {
  const { groupId } = useParams()
  return <Navigate to={`/projects/${groupId}`} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route
              element={
                <NotificationsProvider>
                  <AppLayout />
                </NotificationsProvider>
              }
            >
              <Route path="/projects" element={<DashboardPage />} />
              <Route path="/projects/:projectId" element={<ProjectPage />} />
              <Route path="/groups/:groupId" element={<LegacyGroupRedirect />} />
              <Route element={<AdminRoute />}>
                <Route path="/dashboard" element={<OverviewPage />} />
                <Route path="/users" element={<UsersPage />} />
              </Route>
              <Route path="/acompanhamento" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
