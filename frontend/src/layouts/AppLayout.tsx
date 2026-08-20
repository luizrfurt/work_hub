import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'

import { BrandLogo } from '../components/BrandLogo'
import { ChangePasswordModal } from '../components/ChangePasswordModal'
import { UserAvatar } from '../components/UserAvatar'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationsContext'
import { homePath, initials, roleLabel } from '../utils/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function AppLayout() {
  const { user, logout } = useAuth()
  const { unreadProjectCount } = useNotifications()
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
    <div
      data-sidebar-open={sidebarOpen ? 'true' : 'false'}
      className="group/shell flex min-h-svh items-stretch"
    >
      <div
        className="fixed inset-0 z-30 hidden bg-black/45 opacity-0 pointer-events-none transition-opacity duration-[180ms] ease-in max-md:block group-data-[sidebar-open=true]/shell:pointer-events-auto group-data-[sidebar-open=true]/shell:opacity-100"
        aria-hidden={!sidebarOpen}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className="fixed top-0 left-0 z-40 flex h-svh w-60 flex-col gap-2 border-r border-sidebar-border bg-sidebar p-5 px-3.5 backdrop-blur-[10px] max-md:-translate-x-[105%] max-md:transition-transform max-md:duration-[180ms] max-md:ease-in group-data-[sidebar-open=true]/shell:max-md:translate-x-0"
        aria-label="Navegação principal"
      >
        <Link to={homePath(user?.role)} className="flex items-start gap-2.5 text-inherit">
          <BrandLogo size={40} className="mt-0.5" />
          <span className="min-w-0">
            <h1 className="mb-1 text-[22px] font-bold tracking-[-0.02em]">WorkHub</h1>
            <p className="text-xs leading-[1.35] text-muted-foreground">
              Comunicação e tarefas da equipe
            </p>
          </span>
        </Link>

        <nav className="mt-[18px] flex flex-1 flex-col gap-1 overflow-y-auto">
          {user?.role === 'ADMIN' && (
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                cn(
                  'flex items-center justify-between gap-2 rounded-lg border border-transparent px-3 py-2.5 text-sm text-muted-foreground',
                  isActive
                    ? 'border-[rgba(110,168,255,0.28)] bg-[rgba(110,168,255,0.12)] text-foreground'
                    : 'hover:bg-white/4 hover:text-foreground',
                )
              }
            >
              Dashboard
            </NavLink>
          )}
          <NavLink
            to="/projects"
            className={({ isActive }) =>
              cn(
                'flex items-center justify-between gap-2 rounded-lg border border-transparent px-3 py-2.5 text-sm text-muted-foreground',
                isActive
                  ? 'border-[rgba(110,168,255,0.28)] bg-[rgba(110,168,255,0.12)] text-foreground'
                  : 'hover:bg-white/4 hover:text-foreground',
              )
            }
          >
            <span>Projetos</span>
            {unreadProjectCount > 0 && (
              <Badge className="h-[1.15rem] min-w-[1.15rem] rounded-full bg-destructive px-[0.35rem] text-[0.68rem] font-extrabold text-white">
                {unreadProjectCount > 9 ? '9+' : unreadProjectCount}
              </Badge>
            )}
          </NavLink>
          {user?.role === 'ADMIN' && (
            <NavLink
              to="/users"
              className={({ isActive }) =>
                cn(
                  'flex items-center justify-between gap-2 rounded-lg border border-transparent px-3 py-2.5 text-sm text-muted-foreground',
                  isActive
                    ? 'border-[rgba(110,168,255,0.28)] bg-[rgba(110,168,255,0.12)] text-foreground'
                    : 'hover:bg-white/4 hover:text-foreground',
                )
              }
            >
              Usuários
            </NavLink>
          )}
        </nav>

        <div className="flex flex-col gap-2.5 border-t border-border pt-3">
          <div className="flex items-center gap-[0.65rem] rounded-[10px] border border-border bg-white/4 py-1 pr-2 pl-1">
            <UserAvatar label={initials(user?.name ?? '')} />
            <span className="grid min-w-0 leading-[1.15]">
              <strong className="truncate text-[0.88rem]">{user?.name}</strong>
              <small className="text-[0.72rem] text-muted-foreground">{roleLabel(user?.role ?? '')}</small>
            </span>
          </div>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setChangingPassword(true)}>
            {user?.role === 'ADMIN' ? 'Minha conta' : 'Alterar senha'}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => void logout()}>
            Sair
          </Button>
        </div>
      </aside>

      <div className="app-main ml-60 flex min-h-svh min-w-0 flex-1 flex-col max-md:ml-0">
        <header className="sticky top-0 z-20 hidden items-center gap-3 border-b border-border bg-[rgba(12,18,36,0.85)] px-4 py-3 max-md:flex">
          <Button
            type="button"
            variant="ghost"
            aria-label={sidebarOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((open) => !open)}
          >
            Menu
          </Button>
          <div className="flex min-w-0 items-center gap-2 text-[15px]">
            <BrandLogo size={28} />
            <strong>{pageTitle}</strong>
          </div>
        </header>
        <main className="app-content box-border min-h-0 w-full flex-1 px-6 py-[22px] pb-12">
          <Outlet />
        </main>
      </div>

      <ChangePasswordModal
        open={changingPassword}
        onClose={() => setChangingPassword(false)}
        userId={user?.id}
        currentUsername={user?.username}
        canEditUsername={user?.role === 'ADMIN'}
        onChanged={async () => {
          setChangingPassword(false)
          await logout()
        }}
      />
    </div>
  )
}
