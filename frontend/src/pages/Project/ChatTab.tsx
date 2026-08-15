import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'

import { listMessages, sendMessage, uploadAttachment } from '../../api/messages'
import { attachmentUrl } from '../../api/client'
import { useAuth } from '../../contexts/AuthContext'
import { useNotifications } from '../../contexts/NotificationsContext'
import { useProjectRealtime, useRealtimeMessages } from '../../contexts/ProjectRealtimeContext'
import type { Message } from '../../types'
import { formatDateTime, getErrorMessage } from '../../utils/format'
import { getAccessToken } from '../../utils/storage'

interface ChatTabProps {
  projectId: string
}

function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const byId = new Map(current.map((item) => [item.id, item]))
  for (const item of incoming) {
    byId.set(item.id, item)
  }
  return [...byId.values()].sort((left, right) => left.created_at.localeCompare(right.created_at))
}

export function ChatTab({ projectId }: ChatTabProps) {
  const { user } = useAuth()
  const { markRead } = useNotifications()
  const [messages, setMessages] = useState<Message[]>([])
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const historyRef = useRef<HTMLDivElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const appendMessage = useCallback((message: Message) => {
    setMessages((current) => mergeMessages(current, [message]))
  }, [])

  const { send } = useProjectRealtime()
  const connected = useRealtimeMessages(appendMessage)

  useEffect(() => {
    let active = true
    listMessages(projectId)
      .then((data) => {
        if (active) {
          setMessages(data.items)
        }
      })
      .catch((err) => setError(getErrorMessage(err, 'Não foi possível carregar o histórico.')))
    return () => {
      active = false
    }
  }, [projectId])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void listMessages(projectId).then((data) => {
        setMessages((current) => mergeMessages(current, data.items))
      })
    }, connected ? 8000 : 2500)
    return () => window.clearInterval(timer)
  }, [projectId, connected])

  useEffect(() => {
    const history = historyRef.current
    if (!history) {
      return
    }
    history.scrollTo({ top: history.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  async function handleSend(event: FormEvent) {
    event.preventDefault()
    const text = content.trim()
    if (!text) {
      return
    }
    setSending(true)
    setError('')
    try {
      const sent = send(text)
      if (!sent) {
        const message = await sendMessage(projectId, text)
        setMessages((current) => mergeMessages(current, [message]))
      }
      setContent('')
      markRead(Number(projectId))
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível enviar a mensagem.'))
    } finally {
      setSending(false)
    }
  }

  async function handleFile(file: File) {
    setSending(true)
    setError('')
    try {
      const message = await uploadAttachment(projectId, file, content.trim() || undefined)
      setMessages((current) => mergeMessages(current, [message]))
      setContent('')
      markRead(Number(projectId))
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível enviar o arquivo.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="chat-tab">
      {error && <div className="alert">{error}</div>}
      <div className="chat-panel">
      <div className="chat-history" ref={historyRef}>
        {messages.map((message) => (
          <article
            key={message.id}
            className={`chat-message ${message.user_id === user?.id ? 'mine' : ''}`}
          >
            <span className="avatar sm" aria-hidden="true">
              {message.author_name.slice(0, 1).toUpperCase()}
            </span>
            <div className="chat-bubble">
              <header className="chat-meta">
                <strong>{message.author_name}</strong>
                <time className="muted">{formatDateTime(message.created_at)}</time>
              </header>
              {message.content && <p>{message.content}</p>}
              {message.attachments.map((attachment) => (
                <AttachmentView
                  key={attachment.id}
                  projectId={projectId}
                  attachmentId={attachment.id}
                  mimeType={attachment.mime_type}
                  name={attachment.original_name}
                />
              ))}
            </div>
          </article>
        ))}
      </div>
      <form className="chat-composer" onSubmit={(event) => void handleSend(event)}>
        <input
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Escreva uma mensagem"
          aria-label="Mensagem"
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,text/plain,.jpg,.jpeg,.png,.webp,.txt"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) {
              void handleFile(file)
              event.target.value = ''
            }
          }}
        />
        <button className="button ghost" type="button" onClick={() => fileRef.current?.click()}>
          Anexar
        </button>
        <button className="button primary" type="submit" disabled={sending}>
          Enviar
        </button>
      </form>
    </div>
    </div>
  )
}

function AttachmentView({
  projectId,
  attachmentId,
  mimeType,
  name,
}: {
  projectId: string
  attachmentId: number
  mimeType: string
  name: string
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    const token = getAccessToken()
    if (!token) {
      return
    }
    let revoked = false
    let createdUrl: string | null = null
    fetch(attachmentUrl(projectId, attachmentId), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => response.blob())
      .then((blob) => {
        createdUrl = URL.createObjectURL(blob)
        if (!revoked) {
          setObjectUrl(createdUrl)
        } else {
          URL.revokeObjectURL(createdUrl)
        }
      })
      .catch(() => undefined)
    return () => {
      revoked = true
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl)
      }
    }
  }, [projectId, attachmentId])

  if (mimeType.startsWith('image/')) {
    return objectUrl ? <img className="chat-image" src={objectUrl} alt={name} /> : <p className="muted">{name}</p>
  }

  return objectUrl ? (
    <a className="file-link" href={objectUrl} download={name}>
      {name}
    </a>
  ) : (
    <span className="muted">{name}</span>
  )
}
