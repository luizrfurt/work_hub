import type { User, UserRole } from '../types'
import { api } from './client'

export async function listUsers(): Promise<User[]> {
  const { data } = await api.get<User[]>('/users')
  return data
}

export async function createUser(payload: {
  username: string
  name: string
  password: string
  role: UserRole
}): Promise<User> {
  const { data } = await api.post<User>('/users', payload)
  return data
}

export async function updateUser(
  userId: number | string,
  payload: {
    username?: string
    name?: string
    password?: string
    role?: UserRole
    is_active?: boolean
  },
): Promise<User> {
  const { data } = await api.patch<User>(`/users/${userId}`, payload)
  return data
}
