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

export async function sendMessage(
  projectId: number | string,
  content: string,
  replyToId?: number | null,
): Promise<Message> {
  const { data } = await api.post<Message>(`/projects/${projectId}/messages`, {
    content,
    reply_to_id: replyToId ?? null,
  })
  return data
}

export async function updateMessage(
  projectId: number | string,
  messageId: number | string,
  content: string,
): Promise<Message> {
  const { data } = await api.patch<Message>(`/projects/${projectId}/messages/${messageId}`, {
    content,
  })
  return data
}

export async function deleteMessage(
  projectId: number | string,
  messageId: number | string,
): Promise<Message> {
  const { data } = await api.delete<Message>(`/projects/${projectId}/messages/${messageId}`)
  return data
}

export async function uploadAttachment(
  projectId: number | string,
  file: File,
  content?: string,
  replyToId?: number | null,
): Promise<Message> {
  const form = new FormData()
  form.append('file', file)
  if (content) {
    form.append('content', content)
  }
  if (replyToId != null) {
    form.append('reply_to_id', String(replyToId))
  }
  const { data } = await api.post<Message>(`/projects/${projectId}/attachments`, form)
  return data
}
