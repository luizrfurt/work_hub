import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'

import { listMessages, sendMessage, uploadAttachment } from '../../api/messages'
import { attachmentUrl } from '../../api/client'
import { AttachmentView } from '../../components/AttachmentView'
import { ErrorAlert } from '../../components/ErrorAlert'
import { UserAvatar } from '../../components/UserAvatar'
import { useAuth } from '../../contexts/AuthContext'
import { useNotifications } from '../../contexts/NotificationsContext'
import { useProjectRealtime, useRealtimeMessages } from '../../contexts/ProjectRealtimeContext'
import type { Message } from '../../types'
import { formatDateTime, getErrorMessage } from '../../utils/format'
import { isOverUploadLimit, UPLOAD_ACCEPT, UPLOAD_HINT } from '../../utils/uploads'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

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
    if (isOverUploadLimit(file.size)) {
      setError('Arquivo excede o limite de 5 MB.')
      return
    }
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
    <div className="flex min-h-0 flex-1 flex-col gap-[0.6rem]">
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <div className="grid min-h-0 flex-1 grid-rows-[1fr_auto] overflow-hidden rounded-[14px] border border-border bg-card">
        <div className="flex flex-col gap-[0.85rem] overflow-y-auto bg-black/12 p-[1.1rem]" ref={historyRef}>
          {messages.map((message) => {
            const mine = message.user_id === user?.id
            return (
              <article
                key={message.id}
                className={cn(
                  'flex max-w-[74%] items-end gap-[0.6rem] max-[800px]:max-w-[94%]',
                  mine && 'flex-row-reverse self-end',
                )}
              >
                <UserAvatar label={message.author_name.slice(0, 1).toUpperCase()} size="sm" />
                <div
                  className={cn(
                    'rounded-[14px] border border-border bg-white/4 px-[0.85rem] py-[0.7rem]',
                    mine
                      ? 'rounded-br-[6px] border-[rgba(110,168,255,0.28)] bg-[rgba(110,168,255,0.14)]'
                      : 'rounded-bl-[6px]',
                  )}
                >
                  <header className="mb-[0.2rem] flex items-baseline justify-between gap-3">
                    <strong>{message.author_name}</strong>
                    <time className="whitespace-nowrap text-[0.72rem] text-muted-foreground">
                      {formatDateTime(message.created_at)}
                    </time>
                  </header>
                  {message.content && <p>{message.content}</p>}
                  {message.attachments.map((attachment) => (
                    <AttachmentView
                      key={attachment.id}
                      url={attachmentUrl(projectId, attachment.id)}
                      mimeType={attachment.mime_type}
                      name={attachment.original_name}
                    />
                  ))}
                </div>
              </article>
            )
          })}
        </div>
        <form
          className="flex gap-[0.55rem] border-t border-border bg-[rgba(12,18,36,0.85)] p-[0.9rem] max-[800px]:grid max-[800px]:grid-cols-1"
          onSubmit={(event) => void handleSend(event)}
        >
          <Input
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Escreva uma mensagem"
            aria-label="Mensagem"
          />
          <input
            ref={fileRef}
            type="file"
            accept={UPLOAD_ACCEPT}
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                void handleFile(file)
                event.target.value = ''
              }
            }}
          />
          <Button
            variant="ghost"
            type="button"
            title={UPLOAD_HINT}
            onClick={() => fileRef.current?.click()}
          >
            Anexar
          </Button>
          <Button type="submit" disabled={sending}>
            Enviar
          </Button>
        </form>
      </div>
    </div>
  )
}
