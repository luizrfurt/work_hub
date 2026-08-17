import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

import { clearSession, getAccessToken, getRefreshToken, updateTokens } from '../utils/storage'

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}

function currentHostname(): string {
  return typeof window === 'undefined' ? 'localhost' : window.location.hostname
}

function rewriteForLan(rawUrl: string, asWebSocket: boolean): string {
  const url = new URL(rawUrl)
  if (isLocalHost(url.hostname) && !isLocalHost(currentHostname())) {
    url.hostname = currentHostname()
  }
  if (asWebSocket) {
    if (url.protocol === 'http:') {
      url.protocol = 'ws:'
    } else if (url.protocol === 'https:') {
      url.protocol = 'wss:'
    }
    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      url.protocol = 'wss:'
    }
    return url.origin
  }
  const path = url.pathname.replace(/\/$/, '')
  return `${url.origin}${path === '/' ? '' : path}`
}

const configuredApi = import.meta.env.VITE_API_URL || `http://${currentHostname()}:8000`
const API_URL = rewriteForLan(configuredApi, false)

export const api = axios.create({
  baseURL: API_URL,
})

const refreshClient = axios.create({
  baseURL: API_URL,
})

let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = getRefreshToken()
      if (!refreshToken) {
        throw new Error('Sessão expirada.')
      }
      const { data } = await refreshClient.post<{
        access_token: string
        refresh_token: string
      }>('/auth/refresh', { refresh_token: refreshToken })
      updateTokens(data.access_token, data.refresh_token)
      return data.access_token
    })().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined
    if (!original || error.response?.status !== 401 || original._retry) {
      if (error.response?.status === 401 && original?.url?.includes('/auth/refresh')) {
        clearSession()
        window.location.href = '/login'
      }
      return Promise.reject(error)
    }

    if (original.url?.includes('/auth/login') || original.url?.includes('/auth/refresh')) {
      return Promise.reject(error)
    }

    original._retry = true
    try {
      const accessToken = await refreshAccessToken()
      original.headers.Authorization = `Bearer ${accessToken}`
      return api(original)
    } catch (refreshError) {
      clearSession()
      window.location.href = '/login'
      return Promise.reject(refreshError)
    }
  },
)

export function attachmentUrl(projectId: number | string, attachmentId: number | string): string {
  return `${API_URL}/projects/${projectId}/attachments/${attachmentId}`
}

export function taskAttachmentUrl(
  projectId: number | string,
  taskId: number | string,
  attachmentId: number | string,
): string {
  return `${API_URL}/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}`
}

export const wsBaseUrl = rewriteForLan(import.meta.env.VITE_WS_URL || configuredApi, true)
