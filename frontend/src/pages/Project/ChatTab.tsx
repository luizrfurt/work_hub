import { Paperclip, Send } from 'lucide-react'
import { type DragEvent, type FormEvent, useCallback, useEffect, useRef, useState } from 'react'

import { listMessages, sendMessage, uploadAttachment } from '../../api/messages'
import { attachmentUrl } from '../../api/client'
import { AttachmentView } from '../../components/AttachmentView'
import { ErrorAlert } from '../../components/ErrorAlert'
import { UserAvatar } from '../../components/UserAvatar'
import { useAuth } from '../../contexts/AuthContext'
import { useNotifications } from '../../contexts/NotificationsContext'
import { useProjectRealtime, useRealtimeMessages } from '../../contexts/ProjectRealtimeContext'
import { useOrgStorage } from '../../hooks/useOrgStorage'
import type { Message } from '../../types'
import { formatDateTime, getErrorMessage } from '../../utils/format'
import { checkUploadQuota } from '../../utils/quota'
import {
  filesFromDataTransfer,
  isFileDrag,
  isOverUploadLimit,
  UPLOAD_ACCEPT,
  UPLOAD_HINT,
} from '../../utils/uploads'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface ChatTabProps {
  projectId: string
}

const PAGE_SIZE = 50

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
  const { usage, refresh: refreshStorage } = useOrgStorage()
  const [messages, setMessages] = useState<Message[]>([])
  const [total, setTotal] = useState(0)
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [fileOver, setFileOver] = useState(false)
  const historyRef = useRef<HTMLDivElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const skipScrollRef = useRef(false)
  const restoreScrollRef = useRef<{ height: number; top: number } | null>(null)

  const appendMessage = useCallback((message: Message) => {
    setMessages((current) => mergeMessages(current, [message]))
  }, [])

  const { send } = useProjectRealtime()
  const connected = useRealtimeMessages(appendMessage)

  useEffect(() => {
    let active = true
    setMessages([])
    setTotal(0)
    setLoading(true)
    listMessages(projectId, PAGE_SIZE, 0)
      .then((data) => {
        if (!active) {
          return
        }
        setMessages(data.items)
        setTotal(data.total)
      })
      .catch((err) => setError(getErrorMessage(err, 'Não foi possível carregar o histórico.')))
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [projectId])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void listMessages(projectId, PAGE_SIZE, 0).then((data) => {
        setMessages((current) => mergeMessages(current, data.items))
        setTotal(data.total)
      })
    }, connected ? 8000 : 2500)
    return () => window.clearInterval(timer)
  }, [projectId, connected])

  useEffect(() => {
    const history = historyRef.current
    if (!history) {
      return
    }
    const restore = restoreScrollRef.current
    if (restore) {
      restoreScrollRef.current = null
      skipScrollRef.current = false
      history.scrollTop = history.scrollHeight - restore.height + restore.top
      return
    }
    if (skipScrollRef.current) {
      skipScrollRef.current = false
      return
    }
    history.scrollTo({ top: history.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  useEffect(() => {
    setTotal((current) => Math.max(current, messages.length))
  }, [messages.length])

  const hasMore = messages.length < total

  async function loadOlder() {
    if (loadingOlder || !hasMore) {
      return
    }
    const history = historyRef.current
    const previousHeight = history?.scrollHeight ?? 0
    const previousTop = history?.scrollTop ?? 0
    setLoadingOlder(true)
    setError('')
    try {
      const data = await listMessages(projectId, PAGE_SIZE, messages.length)
      skipScrollRef.current = true
      restoreScrollRef.current = { height: previousHeight, top: previousTop }
      setMessages((current) => mergeMessages(current, data.items))
      setTotal(data.total)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar mensagens anteriores.'))
    } finally {
      setLoadingOlder(false)
    }
  }

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

  async function handleFiles(files: File[]) {
    const accepted = files.filter((file) => !isOverUploadLimit(file.size))
    const rejected = files.length - accepted.length
    if (accepted.length === 0) {
      setError('Arquivo excede o limite de 5 MB.')
      return
    }
    const quota = checkUploadQuota(
      usage,
      accepted.reduce((sum, file) => sum + file.size, 0),
    )
    if (quota.blocked) {
      setError(quota.blocked)
      return
    }
    setSending(true)
    setError(quota.warning ?? (rejected > 0 ? 'Arquivos acima de 5 MB foram ignorados.' : ''))
    try {
      let caption = content.trim() || undefined
      for (const file of accepted) {
        const message = await uploadAttachment(projectId, file, caption)
        setMessages((current) => mergeMessages(current, [message]))
        caption = undefined
      }
      setContent('')
      markRead(Number(projectId))
      await refreshStorage()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível enviar o arquivo.'))
    } finally {
      setSending(false)
    }
  }

  function handleFileDragOver(event: DragEvent<HTMLElement>) {
    if (!isFileDrag(event)) {
      return
    }
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setFileOver(true)
  }

  function handleFileDrop(event: DragEvent<HTMLElement>) {
    const files = filesFromDataTransfer(event.dataTransfer)
    if (files.length === 0) {
      setFileOver(false)
      return
    }
    event.preventDefault()
    setFileOver(false)
    void handleFiles(files)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[0.6rem]">
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <div
        className={cn(
          'grid min-h-0 flex-1 grid-rows-[1fr_auto] overflow-hidden rounded-[14px] border border-border bg-card',
          fileOver && 'border-[rgba(110,168,255,0.55)] bg-[rgba(110,168,255,0.08)]',
        )}
        onDragOver={handleFileDragOver}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            setFileOver(false)
          }
        }}
        onDrop={handleFileDrop}
      >
        <div className="flex flex-col gap-[0.85rem] overflow-y-auto bg-black/12 p-[1.1rem]" ref={historyRef}>
          {hasMore && (
            <div className="flex justify-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={loadingOlder}
                onClick={() => void loadOlder()}
              >
                {loadingOlder ? 'Carregando...' : 'Carregar mensagens anteriores'}
              </Button>
            </div>
          )}
          {!loading && messages.length === 0 && (
            <p className="m-auto text-center text-muted-foreground">Nenhuma mensagem ainda</p>
          )}
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
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Escreva uma mensagem"
            aria-label="Mensagem"
            rows={1}
            className="min-h-10 max-h-32 resize-none py-2"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept={UPLOAD_ACCEPT}
            multiple
            hidden
            onChange={(event) => {
              const files = Array.from(event.target.files ?? [])
              if (files.length > 0) {
                void handleFiles(files)
                event.target.value = ''
              }
            }}
          />
          <Button
            variant="ghost"
            type="button"
            size="icon"
            className="size-10"
            title={UPLOAD_HINT}
            aria-label="Anexar"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip />
          </Button>
          <Button
            type="submit"
            size="icon"
            className="size-10"
            disabled={sending}
            title="Enviar"
            aria-label="Enviar"
          >
            <Send />
          </Button>
        </form>
      </div>
    </div>
  )
}
