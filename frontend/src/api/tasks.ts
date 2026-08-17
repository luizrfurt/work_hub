import type { Task, TaskStatus } from '../types'
import { api } from './client'

export async function listTasks(projectId: number | string): Promise<Task[]> {
  const { data } = await api.get<Task[]>(`/projects/${projectId}/tasks`)
  return data
}

export async function createTask(
  projectId: number | string,
  payload: {
    title: string
    description?: string
    due_date?: string
    assigned_user_id: number
    status?: TaskStatus
    position?: number
  },
): Promise<Task> {
  const { data } = await api.post<Task>(`/projects/${projectId}/tasks`, payload)
  return data
}

export async function updateTask(
  projectId: number | string,
  taskId: number | string,
  payload: {
    title?: string
    description?: string
    due_date?: string | null
    assigned_user_id?: number
    status?: TaskStatus
    position?: number
  },
): Promise<Task> {
  const { data } = await api.patch<Task>(`/projects/${projectId}/tasks/${taskId}`, payload)
  return data
}

export async function deleteTask(
  projectId: number | string,
  taskId: number | string,
): Promise<void> {
  await api.delete(`/projects/${projectId}/tasks/${taskId}`)
}

export async function uploadTaskAttachment(
  projectId: number | string,
  taskId: number | string,
  file: File,
): Promise<Task> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<Task>(`/projects/${projectId}/tasks/${taskId}/attachments`, form)
  return data
}

export async function deleteTaskAttachment(
  projectId: number | string,
  taskId: number | string,
  attachmentId: number | string,
): Promise<Task> {
  const { data } = await api.delete<Task>(
    `/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}`,
  )
  return data
}
