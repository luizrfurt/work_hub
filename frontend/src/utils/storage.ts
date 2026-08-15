const ACCESS_KEY = 'work_hub_access_token'
const REFRESH_KEY = 'work_hub_refresh_token'
const USER_KEY = 'work_hub_user'

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY)
}

export function getStoredUser(): string | null {
  return localStorage.getItem(USER_KEY)
}

export function setSession(accessToken: string, refreshToken: string, userJson: string): void {
  localStorage.setItem(ACCESS_KEY, accessToken)
  localStorage.setItem(REFRESH_KEY, refreshToken)
  localStorage.setItem(USER_KEY, userJson)
}

export function updateTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_KEY, accessToken)
  localStorage.setItem(REFRESH_KEY, refreshToken)
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USER_KEY)
}

function readsKey(userId: number): string {
  return `work_hub_last_read_${userId}`
}

function unreadKey(userId: number): string {
  return `work_hub_unread_${userId}`
}

function readMap(key: string): Record<string, string | number> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, string | number>
    }
  } catch {
    // ignore invalid cache
  }
  return {}
}

export function loadLastRead(userId: number): Record<number, string> {
  const stored = readMap(readsKey(userId))
  const result: Record<number, string> = {}
  for (const [key, value] of Object.entries(stored)) {
    const id = Number(key)
    if (Number.isInteger(id) && typeof value === 'string') {
      result[id] = value
    }
  }
  return result
}

export function saveLastRead(userId: number, values: Record<number, string>): void {
  localStorage.setItem(readsKey(userId), JSON.stringify(values))
}

export function loadUnreadCounts(userId: number): Record<number, number> {
  const stored = readMap(unreadKey(userId))
  const result: Record<number, number> = {}
  for (const [key, value] of Object.entries(stored)) {
    const id = Number(key)
    const count = Number(value)
    if (Number.isInteger(id) && count > 0) {
      result[id] = count
    }
  }
  return result
}

export function saveUnreadCounts(userId: number, values: Record<number, number>): void {
  localStorage.setItem(unreadKey(userId), JSON.stringify(values))
}
