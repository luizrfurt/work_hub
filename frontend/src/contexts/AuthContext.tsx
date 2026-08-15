import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { fetchMe, login as loginRequest, logout as logoutRequest } from '../api/auth'
import type { User } from '../types'
import { clearSession, getAccessToken, getRefreshToken, getStoredUser, setSession } from '../utils/storage'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<User>
  logout: () => Promise<void>
  applyUser: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getAccessToken()
    const stored = getStoredUser()
    if (stored) {
      setUser(JSON.parse(stored) as User)
    }
    if (!token) {
      setLoading(false)
      return
    }
    fetchMe()
      .then((current) => {
        setUser(current)
        const refresh = getRefreshToken()
        if (refresh && token) {
          setSession(token, refresh, JSON.stringify(current))
        }
      })
      .catch(() => {
        clearSession()
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const data = await loginRequest(username, password)
    setSession(data.access_token, data.refresh_token, JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    const refresh = getRefreshToken()
    try {
      await logoutRequest(refresh)
    } catch {
      // session is cleared locally regardless of API result
    }
    clearSession()
    setUser(null)
  }, [])

  const applyUser = useCallback((next: User) => {
    setUser(next)
    const access = getAccessToken()
    const refresh = getRefreshToken()
    if (access && refresh) {
      setSession(access, refresh, JSON.stringify(next))
    }
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, logout, applyUser }),
    [user, loading, login, logout, applyUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
