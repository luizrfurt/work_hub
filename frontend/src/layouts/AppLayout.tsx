import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'

import { ChangePasswordModal } from '../components/ChangePasswordModal'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationsContext'
import { homePath, initials, roleLabel } from '../utils/format'

export function AppLayout() {
  const { user, logout } = useAuth()
  const { totalUnread } = useNotifications()
  const location = useLocation()
  const [changingPassword, setChangingPassword] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const pageTitle = location.pathname.startsWith('/dashboard')
    ? 'Dashboard'
    : location.pathname.startsWith('/users')
      ? 'Usuários'
      : location.pathname.startsWith('/projects/')
        ? 'Projeto'
        : 'Projetos'

  return (
    <div className={`app-shell${sidebarOpen ? ' sidebar-open' : ''}`}>
      <div
        className="sidebar-backdrop"
        aria-hidden={!sidebarOpen}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className="sidebar" aria-label="Navegação principal">
        <Link to={homePath(user?.role)} className="sidebar-brand">
          <h1>WorkHub</h1>
          <p className="sub">Comunicação e tarefas da equipe</p>
        </Link>

        <nav className="sidebar-nav">
          {user?.role === 'ADMIN' && (
            <NavLink
              to="/dashboard"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              Dashboard
            </NavLink>
          )}
          <NavLink
            to="/projects"
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            <span>Projetos</span>
            {totalUnread > 0 && (
              <span className="nav-badge">{totalUnread > 9 ? '9+' : totalUnread}</span>
            )}
          </NavLink>
          {user?.role === 'ADMIN' && (
            <NavLink
              to="/users"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              Usuários
            </NavLink>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <span className="avatar" aria-hidden="true">
              {initials(user?.name ?? '')}
            </span>
            <span className="user-meta">
              <strong>{user?.name}</strong>
              <small>{roleLabel(user?.role ?? '')}</small>
            </span>
          </div>
          <button type="button" className="button ghost" onClick={() => setChangingPassword(true)}>
            {user?.role === 'ADMIN' ? 'Minha conta' : 'Alterar senha'}
          </button>
          <button type="button" className="button ghost sidebar-logout" onClick={() => void logout()}>
            Sair
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <button
            type="button"
            className="button ghost"
            aria-label={sidebarOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((open) => !open)}
          >
            Menu
          </button>
          <div className="app-topbar-title">
            <strong>{pageTitle}</strong>
          </div>
        </header>
        <main className="app-content">
          <Outlet />
        </main>
      </div>

      {changingPassword && (
        <ChangePasswordModal
          onClose={() => setChangingPassword(false)}
          userId={user?.id}
          currentUsername={user?.username}
          canEditUsername={user?.role === 'ADMIN'}
          onChanged={async () => {
            setChangingPassword(false)
            await logout()
          }}
        />
      )}
    </div>
  )
}
