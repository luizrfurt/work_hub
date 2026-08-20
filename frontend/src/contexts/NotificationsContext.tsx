import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { listProjects, markProjectRead, syncReadStates } from '../api/projects'
import { useNotificationSocket } from '../hooks/useNotificationSocket'
import type { Project } from '../types'
import {
  isChatTab,
  isViewingConversation,
  notifyIncomingMessage,
  requestNotificationPermission,
  unlockAudio,
} from '../utils/alerts'
import { loadLastRead, loadUnreadCounts, saveLastRead, saveUnreadCounts } from '../utils/storage'
import { useAuth } from './AuthContext'

interface NotificationsValue {
  unreadByProject: Record<number, number>
  unreadProjectCount: number
  unreadFor: (projectId: number | string) => number
  setActiveView: (projectId: number | string | null, tab: string | null) => void
  markRead: (projectId: number) => void
  syncFromProjects: (projects: Project[]) => void
}

const NotificationsContext = createContext<NotificationsValue | undefined>(undefined)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [unreadByProject, setUnreadByProject] = useState<Record<number, number>>({})
  const lastReadRef = useRef<Record<number, string>>({})
  const unreadRef = useRef<Record<number, number>>({})
  const activeProjectRef = useRef<number | null>(null)
  const activeTabRef = useRef<string | null>(null)

  const persistUnread = useCallback(
    (next: Record<number, number>) => {
      unreadRef.current = next
      setUnreadByProject(next)
      if (user) {
        saveUnreadCounts(user.id, next)
      }
    },
    [user],
  )

  useEffect(() => {
    if (!user) {
      lastReadRef.current = {}
      unreadRef.current = {}
      setUnreadByProject({})
      return
    }
    lastReadRef.current = loadLastRead(user.id)
    const stored = loadUnreadCounts(user.id)
    unreadRef.current = stored
    setUnreadByProject(stored)

    let cancelled = false
    const hydrate = async () => {
      try {
        if (Object.keys(lastReadRef.current).length > 0) {
          await syncReadStates(lastReadRef.current)
        }
        const projects = await listProjects()
        if (cancelled) {
          return
        }
        const next: Record<number, number> = {}
        for (const project of projects) {
          if (project.unread_count > 0) {
            next[project.id] = project.unread_count
          }
        }
        persistUnread(next)
      } catch {
        // keep local cache if the server is unavailable
      }
    }
    void hydrate()
    return () => {
      cancelled = true
    }
  }, [persistUnread, user?.id])

  const markRead = useCallback(
    (projectId: number) => {
      lastReadRef.current = {
        ...lastReadRef.current,
        [projectId]: new Date().toISOString(),
      }
      if (user) {
        saveLastRead(user.id, lastReadRef.current)
        void markProjectRead(projectId).catch(() => undefined)
      }
      if (!unreadRef.current[projectId]) {
        return
      }
      const next = { ...unreadRef.current }
      delete next[projectId]
      persistUnread(next)
    },
    [persistUnread, user],
  )

  const setActiveView = useCallback(
    (projectId: number | string | null, tab: string | null) => {
      const id = projectId == null ? null : Number(projectId)
      activeProjectRef.current = Number.isInteger(id) ? id : null
      activeTabRef.current = tab
      if (id != null && Number.isInteger(id) && isChatTab(tab ?? '')) {
        markRead(id)
      }
    },
    [markRead],
  )

  const syncFromProjects = useCallback((projects: Project[]) => {
    const next: Record<number, number> = {}
    for (const project of projects) {
      if (project.unread_count > 0) {
        next[project.id] = project.unread_count
      }
    }
    persistUnread(next)
  }, [persistUnread])

  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    requestNotificationPermission()
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  useEffect(() => {
    const markIfViewing = () => {
      const projectId = activeProjectRef.current
      const tab = activeTabRef.current
      if (projectId != null && isViewingConversation(tab ?? '')) {
        markRead(projectId)
      }
    }
    document.addEventListener('visibilitychange', markIfViewing)
    window.addEventListener('focus', markIfViewing)
    return () => {
      document.removeEventListener('visibilitychange', markIfViewing)
      window.removeEventListener('focus', markIfViewing)
    }
  }, [markRead])

  useNotificationSocket({
    enabled: Boolean(user),
    onEvent: (event) => {
      const message = event.payload
      if (!user || message.user_id === user.id) {
        return
      }
      const viewingThisChat =
        activeProjectRef.current === message.project_id && isViewingConversation(activeTabRef.current ?? '')
      if (viewingThisChat) {
        markRead(message.project_id)
        return
      }
      persistUnread({
        ...unreadRef.current,
        [message.project_id]: (unreadRef.current[message.project_id] ?? 0) + 1,
      })
      notifyIncomingMessage(event.project_name || 'WorkHub', message)
    },
  })

  const unreadFor = useCallback(
    (projectId: number | string) => unreadByProject[Number(projectId)] ?? 0,
    [unreadByProject],
  )

  const unreadProjectCount = useMemo(
    () => Object.values(unreadByProject).filter((count) => count > 0).length,
    [unreadByProject],
  )

  useEffect(() => {
    document.title = unreadProjectCount > 0 ? `(${unreadProjectCount}) WorkHub` : 'WorkHub'
    return () => {
      document.title = 'WorkHub'
    }
  }, [unreadProjectCount])

  const value = useMemo(
    () => ({ unreadByProject, unreadProjectCount, unreadFor, setActiveView, markRead, syncFromProjects }),
    [unreadByProject, unreadProjectCount, unreadFor, setActiveView, markRead, syncFromProjects],
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotifications(): NotificationsValue {
  const context = useContext(NotificationsContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationsProvider')
  }
  return context
}
