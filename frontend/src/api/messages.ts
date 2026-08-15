import type { Message, MessageList } from '../types'
import { api } from './client'

export async function listMessages(
  projectId: number | string,
  limit = 50,
  offset = 0,
): Promise<MessageList> {
  const { data } = await api.get<MessageList>(`/projects/${projectId}/messages`, {
    params: { limit, offset },
  })
  return data
}

export async function sendMessage(projectId: number | string, content: string): Promise<Message> {
  const { data } = await api.post<Message>(`/projects/${projectId}/messages`, { content })
  return data
}

export async function uploadAttachment(
  projectId: number | string,
  file: File,
  content?: string,
): Promise<Message> {
  const form = new FormData()
  form.append('file', file)
  if (content) {
    form.append('content', content)
  }
  const { data } = await api.post<Message>(`/projects/${projectId}/attachments`, form)
  return data
}
