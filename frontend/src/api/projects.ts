import type { Overview, Project, ProjectMember } from '../types'
import { api } from './client'

export async function listProjects(): Promise<Project[]> {
  const { data } = await api.get<Project[]>('/projects')
  return data
}

export async function getOverview(): Promise<Overview> {
  const { data } = await api.get<Overview>('/projects/overview')
  return data
}

export async function getProject(projectId: number | string): Promise<Project> {
  const { data } = await api.get<Project>(`/projects/${projectId}`)
  return data
}

export async function createProject(payload: {
  name: string
  description?: string
}): Promise<Project> {
  const { data } = await api.post<Project>('/projects', payload)
  return data
}

export async function updateProject(
  projectId: number | string,
  payload: {
    name?: string
    description?: string | null
  },
): Promise<Project> {
  const { data } = await api.patch<Project>(`/projects/${projectId}`, payload)
  return data
}

export async function deleteProject(projectId: number | string): Promise<void> {
  await api.delete(`/projects/${projectId}`)
}

export async function listMembers(projectId: number | string): Promise<ProjectMember[]> {
  const { data } = await api.get<ProjectMember[]>(`/projects/${projectId}/members`)
  return data
}

export async function addMember(
  projectId: number | string,
  userId: number,
): Promise<ProjectMember> {
  const { data } = await api.post<ProjectMember>(`/projects/${projectId}/members`, {
    user_id: userId,
  })
  return data
}

export async function removeMember(projectId: number | string, userId: number): Promise<void> {
  await api.delete(`/projects/${projectId}/members/${userId}`)
}
