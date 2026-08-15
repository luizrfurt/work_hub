import type { AuthResponse, User } from '../types'
import { api } from './client'

export async function login(username: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', { username, password })
  return data
}

export async function logout(refreshToken: string | null): Promise<void> {
  await api.post('/auth/logout', { refresh_token: refreshToken })
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await api.post('/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  })
}

export async function fetchMe(): Promise<User> {
  const { data } = await api.get<User>('/auth/me')
  return data
}
