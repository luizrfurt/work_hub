import { Paperclip, Pencil, Plus, Trash2 } from 'lucide-react'
import { type DragEvent, type FormEvent, useCallback, useEffect, useRef, useState } from 'react'

import { createTask, deleteTask, deleteTaskAttachment, listTasks, updateTask, uploadTaskAttachment } from '../../api/tasks'
import { taskAttachmentUrl } from '../../api/client'
import { AttachmentView } from '../../components/AttachmentView'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ErrorAlert } from '../../components/ErrorAlert'
import { Field } from '../../components/Field'
import { useAuth } from '../../contexts/AuthContext'
import { useRealtimeTaskDeleted, useRealtimeTasks } from '../../contexts/ProjectRealtimeContext'
import { useOrgStorage } from '../../hooks/useOrgStorage'
import type { ProjectMember, Task, TaskStatus } from '../../types'
import {
  formatDate,
  getErrorMessage,
  isOverdue,
  statusBadgeClass,
  statusColumnClass,
  statusLabel,
  statusTitleClass,
} from '../../utils/format'
import { checkUploadQuota } from '../../utils/quota'
import {
  filesFromDataTransfer,
  isFileDrag,
  isOverUploadLimit,
  UPLOAD_ACCEPT,
  UPLOAD_HINT,
} from '../../utils/uploads'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface TodoTabProps {
  projectId: string
  members: ProjectMember[]
}

const COLUMNS: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE']

function byBoardOrder(left: Task, right: Task) {
  return left.position - right.position || left.created_at.localeCompare(right.created_at)
}

function siblingIndex(
  column: Task[],
  draggingId: number | null,
  hoverTaskId: number,
  after: boolean,
) {
  const hoverIndex = column.findIndex((item) => item.id === hoverTaskId)
  let target = hoverIndex + (after ? 1 : 0)
  const dragIndex = column.findIndex((item) => item.id === draggingId)
  if (dragIndex !== -1 && dragIndex < target) {
    target -= 1
  }
  return Math.max(0, target)
}

export function TodoTab({ projectId, members }: TodoTabProps) {
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const { usage, refresh: refreshStorage } = useOrgStorage()
  const [tasks, setTasks] = useState<Task[]>([])
  const [error, setError] = useState('')
  const [onlyMine, setOnlyMine] = useState(false)
  const [creatingIn, setCreatingIn] = useState<TaskStatus | null>(null)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [overStatus, setOverStatus] = useState<TaskStatus | null>(null)
  const [overCard, setOverCard] = useState<{ taskId: number; after: boolean } | null>(null)

  const upsertTask = useCallback((task: Task) => {
    setTasks((current) => {
      const exists = current.some((item) => item.id === task.id)
      if (exists) {
        return current.map((item) => (item.id === task.id ? task : item))
      }
      return [...current, task]
    })
  }, [])

  const connected = useRealtimeTasks(upsertTask)
  useRealtimeTaskDeleted(
    useCallback((taskId: number) => {
      setTasks((current) => current.filter((item) => item.id !== taskId))
    }, []),
  )

  function columnTasks(status: TaskStatus) {
    return tasks.filter((task) => task.status === status).slice().sort(byBoardOrder)
  }

  function canManageTask(task: Task) {
    return isAdmin || task.assigned_user_id === user?.id
  }

  function visibleColumn(status: TaskStatus) {
    const column = columnTasks(status)
    if (!onlyMine) {
      return column
    }
    return column.filter((task) => task.assigned_user_id === user?.id)
  }

  function guardUpload(files: File[]): File[] | null {
    const accepted = files.filter((file) => !isOverUploadLimit(file.size))
    const rejected = files.length - accepted.length
    if (accepted.length === 0) {
      setError('Arquivo excede o limite de 5 MB.')
      return null
    }
    const quota = checkUploadQuota(
      usage,
      accepted.reduce((sum, file) => sum + file.size, 0),
    )
    if (quota.blocked) {
      setError(quota.blocked)
      return null
    }
    if (quota.warning) {
      setError(quota.warning)
    } else if (rejected > 0) {
      setError(
        rejected === 1
          ? '1 arquivo acima de 5 MB foi ignorado.'
          : `${rejected} arquivos acima de 5 MB foram ignorados.`,
      )
    } else {
      setError('')
    }
    return accepted
  }

  async function loadTasks() {
    try {
      setTasks(await listTasks(projectId))
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar as tarefas.'))
    }
  }

  useEffect(() => {
    void loadTasks()
  }, [projectId])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (draggingId || editingId) {
        return
      }
      void listTasks(projectId).then((items) => setTasks(items))
    }, connected ? 8000 : 2500)
    return () => window.clearInterval(timer)
  }, [projectId, connected, draggingId, editingId])

  async function handleCreate(
    status: TaskStatus,
    payload: {
      title: string
      description: string
      due_date: string
      assigned_user_id: number
    },
  ) {
    setError('')
    const created = await createTask(projectId, {
      title: payload.title,
      description: payload.description || undefined,
      due_date: payload.due_date || undefined,
      assigned_user_id: payload.assigned_user_id,
      status,
    })
    upsertTask(created)
    setCreatingIn(null)
  }

  async function placeTask(task: Task, status: TaskStatus, index: number) {
    if (!canManageTask(task)) {
      setError('Somente o administrador ou o responsável podem mover esta tarefa.')
      return
    }
    const currentIndex = columnTasks(task.status).findIndex((item) => item.id === task.id)
    if (task.status === status && currentIndex === index) {
      return
    }
    setError('')
    setTasks((current) => {
      const moving = current.find((item) => item.id === task.id)
      if (!moving) {
        return current
      }
      const rest = current.filter((item) => item.id !== task.id)
      const target = rest.filter((item) => item.status === status).slice().sort(byBoardOrder)
      const others = rest.filter((item) => item.status !== status)
      const nextIndex = Math.max(0, Math.min(index, target.length))
      target.splice(nextIndex, 0, { ...moving, status, position: nextIndex })
      const placed = target.map((item, position) => ({ ...item, position }))
      const origin =
        moving.status === status
          ? []
          : others
              .filter((item) => item.status === moving.status)
              .slice()
              .sort(byBoardOrder)
              .map((item, position) => ({ ...item, position }))
      const remaining = others.filter((item) => item.status !== moving.status)
      return [...remaining, ...origin, ...placed]
    })
    try {
      const updated = await updateTask(projectId, task.id, { status, position: index })
      upsertTask(updated)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível mover a tarefa.'))
      await loadTasks()
    }
  }

  async function handleSave(
    task: Task,
    payload: {
      title: string
      description: string
      due_date: string
      assigned_user_id: number
      status: TaskStatus
    },
  ) {
    setError('')
    try {
      const updated = await updateTask(projectId, task.id, {
        title: payload.title,
        description: payload.description,
        due_date: payload.due_date || null,
        assigned_user_id: payload.assigned_user_id,
        status: payload.status,
      })
      setTasks((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível atualizar a tarefa.'))
    }
  }

  async function handleDelete(task: Task) {
    setError('')
    try {
      await deleteTask(projectId, task.id)
      setTasks((current) => current.filter((item) => item.id !== task.id))
      void refreshStorage()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível excluir a tarefa.'))
    }
  }

  function readDraggedTask(event: DragEvent) {
    const raw = event.dataTransfer.getData('text/task-id') || event.dataTransfer.getData('text/plain')
    const taskId = Number(raw)
    if (!Number.isInteger(taskId)) {
      return null
    }
    return tasks.find((item) => item.id === taskId) ?? null
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[0.55rem]">
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <div className="mb-0 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <p className="text-[0.92rem] leading-[1.45] text-muted-foreground">
          Arraste o card para cima, para baixo ou para outra coluna.
        </p>
        <Button
          type="button"
          variant={onlyMine ? 'default' : 'ghost'}
          size="sm"
          aria-pressed={onlyMine}
          onClick={() => setOnlyMine((current) => !current)}
        >
          {onlyMine ? 'Todas as tarefas' : 'Minhas tarefas'}
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-4 max-[800px]:grid-cols-1 max-[800px]:overflow-y-auto">
        {COLUMNS.map((status) => {
          const column = columnTasks(status)
          const visible = visibleColumn(status)
          return (
            <section
              key={status}
              className={cn(
                'flex min-h-0 flex-col overflow-hidden rounded-xl border border-dashed border-transparent p-[0.85rem] transition-[border-color,background] duration-150 max-[800px]:min-h-[240px]',
                statusColumnClass(status),
                overStatus === status &&
                  'border-[rgba(110,168,255,0.55)] bg-[rgba(110,168,255,0.08)]',
              )}
              onDragOver={(event) => {
                if (isFileDrag(event)) {
                  event.preventDefault()
                  return
                }
                event.preventDefault()
                setOverStatus(status)
              }}
              onDragLeave={() => {
                if (overStatus === status) {
                  setOverStatus(null)
                }
              }}
              onDrop={(event) => {
                event.preventDefault()
                setOverStatus(null)
                setOverCard(null)
                if (filesFromDataTransfer(event.dataTransfer).length > 0) {
                  setDraggingId(null)
                  return
                }
                const task = readDraggedTask(event)
                if (task) {
                  void placeTask(task, status, column.filter((item) => item.id !== task.id).length)
                }
                setDraggingId(null)
              }}
            >
              <h3 className={cn('mb-3 flex shrink-0 items-center justify-between gap-2 text-[0.95rem] font-semibold', statusTitleClass(status))}>
                {statusLabel(status)}
                <Badge
                  variant="outline"
                  className={cn('h-6 min-w-6 rounded-full px-1.5', statusBadgeClass(status))}
                >
                  {visible.length}
                </Badge>
              </h3>
              {creatingIn === status && (
                <ColumnComposer
                  members={members}
                  onCancel={() => setCreatingIn(null)}
                  onCreate={(payload) => handleCreate(status, payload)}
                  onError={(message) => setError(message)}
                />
              )}
              {creatingIn !== status && (
                <Button
                  type="button"
                  variant="ghost"
                  className="mb-[0.7rem] w-full shrink-0 border-dashed text-muted-foreground"
                  title="Adicionar cartão"
                  aria-label="Adicionar cartão"
                  onClick={() => setCreatingIn(status)}
                >
                  <Plus />
                </Button>
              )}
              <div className="min-h-0 flex-1 overflow-y-auto max-[800px]:overflow-visible">
                {visible.map((task) => (
                  <TaskCard
                    key={task.id}
                    projectId={projectId}
                    task={task}
                    members={members}
                    dropEdge={
                      overCard?.taskId === task.id ? (overCard.after ? 'after' : 'before') : null
                    }
                    dragging={draggingId === task.id}
                    onDragStart={() => setDraggingId(task.id)}
                    onDragEnd={() => {
                      setDraggingId(null)
                      setOverStatus(null)
                      setOverCard(null)
                    }}
                    onDragOverCard={(event) => {
                      if (isFileDrag(event)) {
                        event.preventDefault()
                        event.stopPropagation()
                        return
                      }
                      event.preventDefault()
                      event.stopPropagation()
                      const rect = event.currentTarget.getBoundingClientRect()
                      const after = event.clientY > rect.top + rect.height / 2
                      setOverStatus(status)
                      setOverCard({ taskId: task.id, after })
                    }}
                    onDropCard={(event) => {
                      const files = filesFromDataTransfer(event.dataTransfer)
                      if (files.length > 0) {
                        return
                      }
                      event.preventDefault()
                      event.stopPropagation()
                      const dragged = readDraggedTask(event)
                      const after = overCard?.taskId === task.id ? overCard.after : false
                      setOverStatus(null)
                      setOverCard(null)
                      setDraggingId(null)
                      if (dragged) {
                        void placeTask(
                          dragged,
                          status,
                          siblingIndex(column, dragged.id, task.id, after),
                        )
                      }
                    }}
                    onSave={(payload) => void handleSave(task, payload)}
                    onError={(message) => setError(message)}
                    onTaskChange={upsertTask}
                    onGuardUpload={guardUpload}
                    onUploaded={() => void refreshStorage()}
                    canDelete={isAdmin}
                    canManage={canManageTask(task)}
                    onEditingChange={(open) => {
                      setEditingId((current) => {
                        if (open) {
                          return task.id
                        }
                        return current === task.id ? null : current
                      })
                    }}
                    onDelete={() => void handleDelete(task)}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function ColumnComposer({
  members,
  onCancel,
  onCreate,
  onError,
}: {
  members: ProjectMember[]
  onCancel: () => void
  onCreate: (payload: {
    title: string
    description: string
    due_date: string
    assigned_user_id: number
  }) => Promise<void>
  onError: (message: string) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [assignedUserId, setAssignedUserId] = useState<number | ''>(members[0]?.user_id ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!assignedUserId) {
      onError('O projeto precisa ter pelo menos um membro para criar a tarefa.')
      return
    }
    setSaving(true)
    try {
      await onCreate({ title, description, due_date: dueDate, assigned_user_id: Number(assignedUserId) })
    } catch (err) {
      onError(getErrorMessage(err, 'Não foi possível criar a tarefa.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="mb-[0.6rem] shrink-0">
      <CardContent>
        <form className="grid gap-[0.55rem]" onSubmit={(event) => void handleSubmit(event)}>
          <Field label="Título">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Nome da tarefa"
              autoFocus
              required
            />
          </Field>
          <Field label="Responsável">
            <Select
              value={assignedUserId === '' ? undefined : String(assignedUserId)}
              onValueChange={(value) => setAssignedUserId(Number(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent position="popper">
                {members.map((member) => (
                  <SelectItem key={member.user_id} value={String(member.user_id)}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Prazo">
            <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </Field>
          <Field label="Descrição">
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              placeholder="Opcional"
            />
          </Field>
          <div className="flex gap-[0.6rem] max-[800px]:grid max-[800px]:grid-cols-1">
            <Button type="submit" disabled={saving || members.length === 0}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function TaskCard({
  projectId,
  task,
  members,
  dropEdge,
  dragging,
  onDragStart,
  onDragEnd,
  onDragOverCard,
  onDropCard,
  onSave,
  onError,
  onTaskChange,
  onGuardUpload,
  onUploaded,
  canDelete,
  canManage,
  onEditingChange,
  onDelete,
}: {
  projectId: string
  task: Task
  members: ProjectMember[]
  dropEdge: 'before' | 'after' | null
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onDragOverCard: (event: DragEvent<HTMLElement>) => void
  onDropCard: (event: DragEvent<HTMLElement>) => void
  onSave: (payload: {
    title: string
    description: string
    due_date: string
    assigned_user_id: number
    status: TaskStatus
  }) => void
  onError: (message: string) => void
  onTaskChange: (task: Task) => void
  onGuardUpload: (files: File[]) => File[] | null
  onUploaded: () => void
  canDelete: boolean
  canManage: boolean
  onEditingChange: (open: boolean) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [assignedUserId, setAssignedUserId] = useState(task.assigned_user_id)
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [attaching, setAttaching] = useState(false)
  const [fileOver, setFileOver] = useState(false)
  const [pendingRemove, setPendingRemove] = useState<{ id: number; name: string } | null>(null)
  const [pendingDelete, setPendingDelete] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const skipClick = useRef(false)
  const onEditingChangeRef = useRef(onEditingChange)
  onEditingChangeRef.current = onEditingChange

  function setEditingOpen(open: boolean) {
    setEditing(open)
    onEditingChange(open)
  }

  useEffect(() => {
    return () => {
      onEditingChangeRef.current(false)
    }
  }, [])

  useEffect(() => {
    if (editing) {
      return
    }
    setTitle(task.title)
    setDescription(task.description ?? '')
    setDueDate(task.due_date ?? '')
    setAssignedUserId(task.assigned_user_id)
    setStatus(task.status)
  }, [task, editing])

  useEffect(() => {
    if (!canManage) {
      setEditingOpen(false)
    }
  }, [canManage])

  async function handleAttach(files: File[]) {
    const accepted = onGuardUpload(files)
    if (!accepted) {
      return
    }
    setAttaching(true)
    try {
      let latest = task
      for (const file of accepted) {
        latest = await uploadTaskAttachment(projectId, task.id, file)
        onTaskChange(latest)
      }
      onUploaded()
    } catch (err) {
      onError(getErrorMessage(err, 'Não foi possível enviar o arquivo.'))
    } finally {
      setAttaching(false)
    }
  }

  async function handleRemoveAttachment(attachmentId: number) {
    onError('')
    try {
      onTaskChange(await deleteTaskAttachment(projectId, task.id, attachmentId))
      onUploaded()
    } catch (err) {
      onError(getErrorMessage(err, 'Não foi possível remover o anexo.'))
    }
  }

  function handleCardDrop(event: DragEvent<HTMLElement>) {
    const files = filesFromDataTransfer(event.dataTransfer)
    if (files.length > 0) {
      event.preventDefault()
      event.stopPropagation()
      setFileOver(false)
      if (canManage) {
        void handleAttach(files)
      }
      return
    }
    onDropCard(event)
  }

  if (editing) {
    return (
      <Card className="mb-3">
        <CardContent>
          <div className="grid gap-[0.45rem]">
            <Field label="Título">
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </Field>
            <Field label="Descrição">
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} />
            </Field>
            <Field label="Prazo">
              <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </Field>
            <Field label="Responsável">
              <Select
                value={String(assignedUserId)}
                onValueChange={(value) => setAssignedUserId(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {members.map((member) => (
                    <SelectItem key={member.user_id} value={String(member.user_id)}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={status} onValueChange={(value) => setStatus(value as TaskStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {COLUMNS.map((option) => (
                    <SelectItem key={option} value={option} className={statusTitleClass(option)}>
                      {statusLabel(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Anexos">
              <TaskAttachments
                projectId={projectId}
                task={task}
                canRemove={canManage}
                onRemove={(attachment) => setPendingRemove(attachment)}
              />
              {canManage && (
                <>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="mt-2"
                disabled={attaching}
                title={`${UPLOAD_HINT}. Dá para escolher vários arquivos de uma vez.`}
                aria-label="Anexar"
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip />
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept={UPLOAD_ACCEPT}
                multiple
                hidden
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? [])
                  if (files.length > 0) {
                    void handleAttach(files)
                    event.target.value = ''
                  }
                }}
              />
                </>
              )}
            </Field>
            <div className="flex gap-[0.6rem] max-[800px]:grid max-[800px]:grid-cols-1">
              <Button
                type="button"
                onClick={() => {
                  onSave({
                    title,
                    description,
                    due_date: dueDate,
                    assigned_user_id: assignedUserId,
                    status,
                  })
                  setEditingOpen(false)
                }}
              >
                Salvar
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditingOpen(false)}>
                Cancelar
              </Button>
              {canDelete && (
                <Button type="button" variant="destructive" onClick={() => setPendingDelete(true)}>
                  Excluir
                </Button>
              )}
            </div>
          </div>
        </CardContent>
        <ConfirmDialog
          open={pendingRemove !== null}
          title="Remover anexo"
          description={
            pendingRemove
              ? `Remover o anexo “${pendingRemove.name}”?`
              : 'Este anexo será removido.'
          }
          confirmLabel="Remover"
          onOpenChange={(open) => {
            if (!open) {
              setPendingRemove(null)
            }
          }}
          onConfirm={() => {
            if (pendingRemove) {
              void handleRemoveAttachment(pendingRemove.id)
            }
            setPendingRemove(null)
          }}
        />
        <ConfirmDialog
          open={pendingDelete}
          title="Excluir tarefa"
          description={`Excluir “${task.title}”? Anexos desta tarefa também serão apagados.`}
          confirmLabel="Excluir"
          onOpenChange={setPendingDelete}
          onConfirm={() => {
            setPendingDelete(false)
            onDelete()
          }}
        />
      </Card>
    )
  }

  const overdue = isOverdue(task.due_date, task.status)

  return (
    <article
      className={cn(
        'mb-2 grid gap-1 rounded-[12px] border border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_40%),var(--card)] px-3 py-2.5 hover:border-[rgba(110,168,255,0.28)]',
        canManage ? 'cursor-grab' : 'cursor-default',
        dragging && 'cursor-grabbing opacity-45',
        dropEdge === 'before' && 'shadow-[0_-3px_0_var(--primary)]',
        dropEdge === 'after' && 'shadow-[0_3px_0_var(--primary)]',
        fileOver && 'border-[rgba(110,168,255,0.55)] bg-[rgba(110,168,255,0.08)]',
      )}
      draggable={canManage}
      onDragOver={(event) => {
        if (isFileDrag(event)) {
          if (!canManage) {
            return
          }
          event.preventDefault()
          event.stopPropagation()
          event.dataTransfer.dropEffect = 'copy'
          setFileOver(true)
          return
        }
        onDragOverCard(event)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setFileOver(false)
        }
      }}
      onDrop={handleCardDrop}
      onDragStart={(event) => {
        if (!canManage || (event.target as HTMLElement).closest('button, form, a, input')) {
          event.preventDefault()
          return
        }
        skipClick.current = true
        event.dataTransfer.setData('text/plain', String(task.id))
        event.dataTransfer.setData('text/task-id', String(task.id))
        event.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={() => {
        skipClick.current = true
        setFileOver(false)
        onDragEnd()
        window.setTimeout(() => {
          skipClick.current = false
        }, 200)
      }}
      onClick={(event) => {
        if (!canManage || skipClick.current) {
          return
        }
        if ((event.target as HTMLElement).closest('button, a, input')) {
          return
        }
        setEditingOpen(true)
      }}
    >
      <div className="flex min-w-0 items-center gap-1">
        <h4 className="min-w-0 flex-1 truncate font-semibold" title={task.title}>
          {task.title}
        </h4>
        <div className="flex shrink-0">
          {canManage && (
            <>
          <Button
            variant="ghost"
            size="icon-xs"
            type="button"
            title="Editar"
            aria-label="Editar"
            onClick={() => setEditingOpen(true)}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            type="button"
            disabled={attaching}
            title={`${UPLOAD_HINT}. Dá para escolher vários arquivos de uma vez.`}
            aria-label="Anexar"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip />
          </Button>
            </>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="icon-xs"
              type="button"
              className="text-muted-foreground"
              title="Excluir"
              aria-label="Excluir"
              onClick={() => setPendingDelete(true)}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </div>
      {task.description && (
        <p className="line-clamp-1 text-[0.82rem] text-muted-foreground" title={task.description}>
          {task.description}
        </p>
      )}
      <p className="truncate text-[0.78rem] text-muted-foreground">
        {task.assigned_user_name}
        {task.due_date ? (
          <span className={overdue ? 'text-destructive' : undefined}>
            {` · ${formatDate(task.due_date)}`}
          </span>
        ) : null}
      </p>
      <TaskAttachments
        projectId={projectId}
        task={task}
        canRemove={canManage}
        onRemove={(attachment) => setPendingRemove(attachment)}
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
            void handleAttach(files)
            event.target.value = ''
          }
        }}
      />
      <ConfirmDialog
        open={pendingRemove !== null}
        title="Remover anexo"
        description={
          pendingRemove
            ? `Remover o anexo “${pendingRemove.name}”?`
            : 'Este anexo será removido.'
        }
        confirmLabel="Remover"
        onOpenChange={(open) => {
          if (!open) {
            setPendingRemove(null)
          }
        }}
          onConfirm={() => {
            if (pendingRemove) {
              void handleRemoveAttachment(pendingRemove.id)
            }
            setPendingRemove(null)
          }}
        />
        <ConfirmDialog
          open={pendingDelete}
          title="Excluir tarefa"
          description={`Excluir “${task.title}”? Anexos desta tarefa também serão apagados.`}
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

function TaskAttachments({
  projectId,
  task,
  canRemove,
  onRemove,
}: {
  projectId: string
  task: Task
  canRemove?: boolean
  onRemove?: (attachment: { id: number; name: string }) => void
}) {
  const attachments = task.attachments ?? []
  if (attachments.length === 0) {
    return null
  }
  return (
    <div className="grid gap-1">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="flex min-w-0 items-center gap-2">
          <AttachmentView
            url={taskAttachmentUrl(projectId, task.id, attachment.id)}
            mimeType={attachment.mime_type}
            name={attachment.original_name}
            compact
          />
          {canRemove && onRemove && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground"
              title="Remover"
              aria-label={`Remover ${attachment.original_name}`}
              onClick={() => onRemove({ id: attachment.id, name: attachment.original_name })}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}
