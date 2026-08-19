import { Paperclip, Pencil, Reply, Send, Trash2, X } from 'lucide-react'
import { type DragEvent, type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

import { deleteMessage, listMessages, sendMessage, updateMessage, uploadAttachment } from '../../api/messages'
import { attachmentUrl } from '../../api/client'
import { AttachmentView } from '../../components/AttachmentView'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ErrorAlert } from '../../components/ErrorAlert'
import { UserAvatar } from '../../components/UserAvatar'
import { useAuth } from '../../contexts/AuthContext'
import { useNotifications } from '../../contexts/NotificationsContext'
import {
  useProjectRealtime,
  useRealtimeMessages,
} from '../../contexts/ProjectRealtimeContext'
import { useOrgStorage } from '../../hooks/useOrgStorage'
import type { Message, ReplyPreview } from '../../types'
import { formatDateTime, getErrorMessage, isEdited } from '../../utils/format'
import { checkUploadQuota } from '../../utils/quota'
import {
  asChatImage,
  filesFromClipboard,
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

function previewFromMessage(message: Message): ReplyPreview {
  const deleted = Boolean(message.deleted_at)
  return {
    id: message.id,
    author_name: message.author_name,
    content: deleted ? null : message.content,
    deleted,
    has_attachment: !deleted && message.attachments.length > 0,
  }
}

function replySnippet(preview: ReplyPreview): string {
  if (preview.deleted) {
    return 'Mensagem excluída'
  }
  const text = preview.content?.trim()
  if (text) {
    const readable = text.replace(/https?:\/\/\S+/gi, ' ').replace(/\s+/g, ' ').trim()
    return readable || 'Link'
  }
  if (preview.has_attachment) {
    return 'Anexo'
  }
  return 'Mensagem'
}

function MessageText({ text }: { text: string }) {
  const nodes: ReactNode[] = []
  const pattern = /https?:\/\/[^\s<>"'`]+/gi
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }
    let href = match[0]
    let trailing = ''
    while (/[.,;:!?)]$/.test(href)) {
      const last = href.slice(-1)
      if (last === ')' && href.includes('(')) {
        break
      }
      trailing = last + trailing
      href = href.slice(0, -1)
    }
    if (href.startsWith('http://') || href.startsWith('https://')) {
      nodes.push(
        <a
          key={`link-${key}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="wrap-anywhere text-[rgba(110,168,255,0.95)] underline underline-offset-2"
        >
          {href}
        </a>,
      )
      key += 1
    } else {
      nodes.push(match[0])
    }
    if (trailing) {
      nodes.push(trailing)
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return <p className="whitespace-pre-wrap wrap-anywhere">{nodes}</p>
}

function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const byId = new Map(current.map((item) => [item.id, item]))
  for (const item of incoming) {
    byId.set(item.id, item)
  }
  return [...byId.values()]
    .map((item) => {
      if (!item.reply_to) {
        return item
      }
      const original = byId.get(item.reply_to.id)
      if (!original) {
        return item
      }
      return { ...item, reply_to: previewFromMessage(original) }
    })
    .sort((left, right) => left.created_at.localeCompare(right.created_at))
}

function dropDeletedFromNewest(current: Message[], newest: Message[]): Message[] {
  if (newest.length === 0) {
    return current
  }
  const ids = new Set(newest.map((item) => item.id))
  const oldestKept = newest[0].created_at
  return current.filter((item) => ids.has(item.id) || item.created_at < oldestKept)
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
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [highlightedId, setHighlightedId] = useState<number | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const historyRef = useRef<HTMLDivElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const skipScrollRef = useRef(false)
  const restoreScrollRef = useRef<{ height: number; top: number } | null>(null)
  const pendingJumpRef = useRef<number | null>(null)

  const appendMessage = useCallback((message: Message) => {
    setMessages((current) => mergeMessages(current, [message]))
  }, [])

  const { send } = useProjectRealtime()
  const connected = useRealtimeMessages(appendMessage)

  useEffect(() => {
    let active = true
    setMessages([])
    setTotal(0)
    setReplyTo(null)
    setHighlightedId(null)
    setPendingFiles([])
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
        setMessages((current) => {
          if (data.total === 0) {
            return []
          }
          return dropDeletedFromNewest(mergeMessages(current, data.items), data.items)
        })
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
      pendingJumpRef.current = null
      setError(getErrorMessage(err, 'Não foi possível carregar mensagens anteriores.'))
    } finally {
      setLoadingOlder(false)
    }
  }

  async function handleSend(event: FormEvent) {
    event.preventDefault()
    const text = content.trim()
    if (pendingFiles.length > 0) {
      await uploadFiles(pendingFiles)
      return
    }
    if (!text) {
      return
    }
    setSending(true)
    setError('')
    try {
      const sent = send(text, replyTo?.id)
      if (!sent) {
        const message = await sendMessage(projectId, text, replyTo?.id)
        setMessages((current) => mergeMessages(current, [message]))
      }
      setContent('')
      setReplyTo(null)
      markRead(Number(projectId))
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível enviar a mensagem.'))
    } finally {
      setSending(false)
    }
  }

  function queueFiles(files: File[]) {
    const accepted = files.filter((file) => !isOverUploadLimit(file.size))
    const rejected = files.length - accepted.length
    if (accepted.length === 0) {
      setError('Arquivo excede o limite de 5 MB.')
      return
    }
    const quota = checkUploadQuota(
      usage,
      pendingFiles.reduce((sum, file) => sum + file.size, 0) +
        accepted.reduce((sum, file) => sum + file.size, 0),
    )
    if (quota.blocked) {
      setError(quota.blocked)
      return
    }
    setError(quota.warning ?? (rejected > 0 ? 'Arquivos acima de 5 MB foram ignorados.' : ''))
    setPendingFiles((current) => [...current, ...accepted])
    window.setTimeout(() => composerRef.current?.focus(), 0)
  }

  async function uploadFiles(files: File[]) {
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
      let replyId = replyTo?.id ?? null
      for (const file of accepted) {
        const message = await uploadAttachment(projectId, file, caption, replyId)
        setMessages((current) => mergeMessages(current, [message]))
        caption = undefined
        replyId = null
      }
      setContent('')
      setReplyTo(null)
      setPendingFiles([])
      markRead(Number(projectId))
      await refreshStorage()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível enviar o arquivo.'))
    } finally {
      setSending(false)
    }
  }

  async function handleEdit(message: Message, nextContent: string) {
    setError('')
    try {
      appendMessage(await updateMessage(projectId, message.id, nextContent))
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível editar a mensagem.'))
    }
  }

  async function handleDelete(message: Message) {
    setError('')
    try {
      appendMessage(await deleteMessage(projectId, message.id))
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível excluir a mensagem.'))
    }
  }

  function highlightMessage(id: number) {
    setHighlightedId(id)
    window.setTimeout(() => {
      setHighlightedId((current) => (current === id ? null : current))
    }, 1600)
  }

  function startReply(message: Message) {
    if (message.deleted_at) {
      return
    }
    setReplyTo(message)
    window.setTimeout(() => composerRef.current?.focus(), 0)
  }

  function jumpToMessage(id: number) {
    const el = document.getElementById(`chat-message-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      highlightMessage(id)
      return
    }
    pendingJumpRef.current = id
    if (hasMore && !loadingOlder) {
      void loadOlder()
    } else if (!hasMore) {
      pendingJumpRef.current = null
    }
  }

  useEffect(() => {
    if (replyTo == null) {
      return
    }
    const latest = messages.find((item) => item.id === replyTo.id)
    if (!latest || latest.deleted_at) {
      setReplyTo(null)
    }
  }, [messages, replyTo])

  useEffect(() => {
    const targetId = pendingJumpRef.current
    if (targetId == null || loadingOlder) {
      return
    }
    const el = document.getElementById(`chat-message-${targetId}`)
    if (el) {
      pendingJumpRef.current = null
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      highlightMessage(targetId)
      return
    }
    if (hasMore) {
      void loadOlder()
    } else {
      pendingJumpRef.current = null
    }
  }, [messages, loadingOlder, hasMore])

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
    queueFiles(files)
  }

  const queueFilesRef = useRef(queueFiles)
  queueFilesRef.current = queueFiles

  useEffect(() => {
    function onPaste(event: globalThis.ClipboardEvent) {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]') && target !== composerRef.current) {
        return
      }
      const images = filesFromClipboard(event.clipboardData)
        .map(asChatImage)
        .filter((file): file is File => file != null)
      if (images.length === 0) {
        return
      }
      event.preventDefault()
      queueFilesRef.current(images)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

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
          {messages.map((message) => (
            <ChatBubble
              key={message.id}
              projectId={projectId}
              message={message}
              mine={message.user_id === user?.id}
              highlighted={highlightedId === message.id}
              onReply={() => startReply(message)}
              onJump={jumpToMessage}
              onEdit={(next) => void handleEdit(message, next)}
              onDelete={() => void handleDelete(message)}
            />
          ))}
        </div>
        <form
          className="flex min-w-0 gap-[0.55rem] border-t border-border bg-[rgba(12,18,36,0.85)] p-[0.9rem] max-[800px]:grid max-[800px]:grid-cols-1"
          onSubmit={(event) => void handleSend(event)}
        >
          <div className="min-w-0 flex-1 overflow-hidden">
            {replyTo && (
              <div className="mb-2 flex min-w-0 items-start gap-2 overflow-hidden rounded-[10px] border border-border bg-white/4 px-3 py-2">
                <span className="mt-0.5 w-[3px] shrink-0 self-stretch rounded-full bg-[rgba(110,168,255,0.8)]" />
                <div className="min-w-0 flex-1 overflow-hidden">
                  <strong className="block truncate text-[0.8rem]">{replyTo.author_name}</strong>
                  <p className="line-clamp-2 wrap-anywhere text-[0.8rem] text-muted-foreground">
                    {replySnippet(previewFromMessage(replyTo))}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  title="Cancelar resposta"
                  aria-label="Cancelar resposta"
                  onClick={() => setReplyTo(null)}
                >
                  <X />
                </Button>
              </div>
            )}
            {pendingFiles.length > 0 && (
              <PendingFileDrafts
                files={pendingFiles}
                onRemove={(index) => {
                  setPendingFiles((current) => current.filter((_, item) => item !== index))
                }}
              />
            )}
            <Textarea
              ref={composerRef}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder={
                pendingFiles.length > 0
                  ? 'Adicione uma legenda'
                  : replyTo
                    ? `Responder a ${replyTo.author_name}`
                    : 'Escreva uma mensagem'
              }
              aria-label="Mensagem"
              rows={1}
              className="min-h-10 max-h-32 resize-none py-2"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
                if (event.key === 'Escape') {
                  if (replyTo) {
                    setReplyTo(null)
                    return
                  }
                  if (pendingFiles.length > 0) {
                    setPendingFiles([])
                  }
                }
              }}
            />
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={UPLOAD_ACCEPT}
            multiple
            hidden
            onChange={(event) => {
              const files = Array.from(event.target.files ?? [])
              if (files.length > 0) {
                queueFiles(files)
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
            disabled={sending || (!content.trim() && pendingFiles.length === 0)}
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

function PendingFileDrafts({
  files,
  onRemove,
}: {
  files: File[]
  onRemove: (index: number) => void
}) {
  const [previews, setPreviews] = useState<string[]>([])

  useEffect(() => {
    const urls = files.map((file) =>
      file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
    )
    setPreviews(urls)
    return () => {
      urls.forEach((url) => {
        if (url) {
          URL.revokeObjectURL(url)
        }
      })
    }
  }, [files])

  return (
    <div className="mb-2 flex min-w-0 gap-2 overflow-x-auto pb-0.5">
      {files.map((file, index) => (
        <div
          key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
          className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-[10px] border border-border bg-black/30"
        >
          {previews[index] ? (
            <img src={previews[index]} alt={file.name} className="size-full object-cover" />
          ) : (
            <p className="flex size-full items-center p-1 text-center text-[0.65rem] leading-tight text-muted-foreground">
              {file.name}
            </p>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="absolute top-0.5 right-0.5 size-6 bg-black/70 text-white hover:bg-black/85"
            title="Remover arquivo"
            aria-label="Remover arquivo"
            onClick={() => onRemove(index)}
          >
            <X />
          </Button>
        </div>
      ))}
    </div>
  )
}

function ChatBubble({
  projectId,
  message,
  mine,
  highlighted,
  onReply,
  onJump,
  onEdit,
  onDelete,
}: {
  projectId: string
  message: Message
  mine: boolean
  highlighted: boolean
  onReply: () => void
  onJump: (messageId: number) => void
  onEdit: (content: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(message.content ?? '')
  const [pendingDelete, setPendingDelete] = useState(false)

  useEffect(() => {
    if (!editing) {
      setDraft(message.content ?? '')
    }
  }, [message.content, editing])

  function handleSave() {
    const text = draft.trim()
    if (!text && message.attachments.length === 0) {
      return
    }
    onEdit(text)
    setEditing(false)
  }

  const deleted = Boolean(message.deleted_at)

  return (
    <article
      id={`chat-message-${message.id}`}
      className={cn(
        'flex w-fit min-w-0 max-w-[min(32rem,62%)] items-end gap-[0.6rem] max-[800px]:max-w-[85%]',
        mine && 'flex-row-reverse self-end',
        highlighted && 'rounded-[16px] ring-2 ring-[rgba(110,168,255,0.55)]',
      )}
    >
      <UserAvatar label={message.author_name.slice(0, 1).toUpperCase()} size="sm" />
      <div
        className={cn(
          'min-w-0 max-w-full overflow-hidden rounded-[14px] border border-border bg-white/4 px-[0.85rem] py-[0.7rem]',
          mine
            ? 'rounded-br-[6px] border-[rgba(110,168,255,0.28)] bg-[rgba(110,168,255,0.14)]'
            : 'rounded-bl-[6px]',
          deleted && 'opacity-70',
        )}
      >
        <header className="mb-[0.2rem] flex min-w-0 items-center justify-between gap-2">
          <strong className="min-w-0 truncate">{message.author_name}</strong>
          <span className="flex shrink-0 items-center gap-0.5">
            <time className="whitespace-nowrap text-[0.72rem] text-muted-foreground">
              {formatDateTime(message.created_at)}
              {!deleted && isEdited(message.created_at, message.updated_at) ? ' · editada' : ''}
            </time>
            {!deleted && !editing && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                title="Responder"
                aria-label="Responder"
                onClick={onReply}
              >
                <Reply />
              </Button>
            )}
            {mine && !editing && !deleted && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  title="Editar"
                  aria-label="Editar"
                  onClick={() => setEditing(true)}
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  title="Excluir"
                  aria-label="Excluir"
                  onClick={() => setPendingDelete(true)}
                >
                  <Trash2 />
                </Button>
              </>
            )}
          </span>
        </header>
        {!deleted && message.reply_to && (
          <button
            type="button"
            className="mb-2 w-full min-w-0 overflow-hidden rounded-[8px] bg-black/20 px-2.5 py-1.5 text-left"
            onClick={() => onJump(message.reply_to!.id)}
          >
            <span className="flex min-w-0 gap-2">
              <span className="w-[3px] shrink-0 self-stretch rounded-full bg-[rgba(110,168,255,0.8)]" />
              <span className="min-w-0 flex-1 overflow-hidden">
                <strong className="block truncate text-[0.75rem]">{message.reply_to.author_name}</strong>
                <span
                  className={cn(
                    'line-clamp-2 wrap-anywhere text-[0.78rem] text-muted-foreground',
                    message.reply_to.deleted && 'italic',
                  )}
                >
                  {replySnippet(message.reply_to)}
                </span>
              </span>
            </span>
          </button>
        )}
        {deleted ? (
          <p className="italic text-muted-foreground">Mensagem excluída</p>
        ) : editing ? (
          <div className="grid gap-2">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={2}
              autoFocus
              className="min-h-16"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  handleSave()
                }
                if (event.key === 'Escape') {
                  setEditing(false)
                  setDraft(message.content ?? '')
                }
              }}
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={handleSave}>
                Salvar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false)
                  setDraft(message.content ?? '')
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          message.content && <MessageText text={message.content} />
        )}
        {!deleted &&
          message.attachments.map((attachment) => (
            <AttachmentView
              key={attachment.id}
              url={attachmentUrl(projectId, attachment.id)}
              mimeType={attachment.mime_type}
              name={attachment.original_name}
            />
          ))}
      </div>
      <ConfirmDialog
        open={pendingDelete}
        title="Excluir mensagem"
        description="A conversa vai mostrar que a mensagem foi excluída. O conteúdo sai da tela."
        confirmLabel="Excluir"
        onOpenChange={setPendingDelete}
        onConfirm={() => {
          setPendingDelete(false)
          onDelete()
        }}
      />
    </article>
  )
}
