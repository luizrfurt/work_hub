import { type DragEvent, type FormEvent, useCallback, useEffect, useState } from 'react'

import { createTask, listTasks, updateTask } from '../../api/tasks'
import { useRealtimeTasks } from '../../contexts/ProjectRealtimeContext'
import type { ProjectMember, Task, TaskStatus } from '../../types'
import { formatDate, getErrorMessage, statusLabel } from '../../utils/format'

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
  const [tasks, setTasks] = useState<Task[]>([])
  const [error, setError] = useState('')
  const [creatingIn, setCreatingIn] = useState<TaskStatus | null>(null)
  const [draggingId, setDraggingId] = useState<number | null>(null)
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

  function columnTasks(status: TaskStatus) {
    return tasks.filter((task) => task.status === status).slice().sort(byBoardOrder)
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
      if (draggingId) {
        return
      }
      void listTasks(projectId).then((items) => setTasks(items))
    }, connected ? 8000 : 2500)
    return () => window.clearInterval(timer)
  }, [projectId, connected, draggingId])

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

  function readDraggedTask(event: DragEvent) {
    const raw = event.dataTransfer.getData('text/task-id') || event.dataTransfer.getData('text/plain')
    const taskId = Number(raw)
    if (!Number.isInteger(taskId)) {
      return null
    }
    return tasks.find((item) => item.id === taskId) ?? null
  }

  return (
    <div className="todo-tab">
      {error && <div className="alert">{error}</div>}
      <p className="hint">Arraste o card para cima, para baixo ou para outra coluna.</p>

      <div className="kanban">
        {COLUMNS.map((status) => {
          const column = columnTasks(status)
          return (
            <section
              key={status}
              className={`kanban-column ${overStatus === status ? 'drag-over' : ''}`}
              onDragOver={(event) => {
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
                const task = readDraggedTask(event)
                if (task) {
                  void placeTask(task, status, column.filter((item) => item.id !== task.id).length)
                }
                setDraggingId(null)
              }}
            >
              <h3>
                {statusLabel(status)}
                <span className="count-pill">{column.length}</span>
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
                <button
                  type="button"
                  className="button ghost add-card"
                  onClick={() => setCreatingIn(status)}
                >
                  + Adicionar cartão
                </button>
              )}
              <div className="kanban-cards">
                {column.map((task) => (
                  <TaskCard
                    key={task.id}
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
                      event.preventDefault()
                      event.stopPropagation()
                      const rect = event.currentTarget.getBoundingClientRect()
                      const after = event.clientY > rect.top + rect.height / 2
                      setOverStatus(status)
                      setOverCard({ taskId: task.id, after })
                    }}
                    onDropCard={(event) => {
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
    <form className="card composer-card" onSubmit={(event) => void handleSubmit(event)}>
      <label>
        Título
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Nome da tarefa"
          autoFocus
          required
        />
      </label>
      <label>
        Responsável
        <select
          value={assignedUserId}
          onChange={(event) => setAssignedUserId(Number(event.target.value))}
          required
        >
          {members.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {member.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Prazo
        <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
      </label>
      <label>
        Descrição
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
          placeholder="Opcional"
        />
      </label>
      <div className="inline-form">
        <button className="button primary" type="submit" disabled={saving || members.length === 0}>
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
        <button className="button ghost" type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

function TaskCard({
  task,
  members,
  dropEdge,
  dragging,
  onDragStart,
  onDragEnd,
  onDragOverCard,
  onDropCard,
  onSave,
}: {
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
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [assignedUserId, setAssignedUserId] = useState(task.assigned_user_id)
  const [status, setStatus] = useState<TaskStatus>(task.status)

  useEffect(() => {
    setTitle(task.title)
    setDescription(task.description ?? '')
    setDueDate(task.due_date ?? '')
    setAssignedUserId(task.assigned_user_id)
    setStatus(task.status)
  }, [task])

  if (editing) {
    return (
      <article className="card task-card">
        <label>
          Título
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          Descrição
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} />
        </label>
        <label>
          Prazo
          <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </label>
        <label>
          Responsável
          <select value={assignedUserId} onChange={(event) => setAssignedUserId(Number(event.target.value))}>
            {members.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)}>
            {COLUMNS.map((option) => (
              <option key={option} value={option}>
                {statusLabel(option)}
              </option>
            ))}
          </select>
        </label>
        <div className="inline-form">
          <button
            className="button primary"
            type="button"
            onClick={() => {
              onSave({
                title,
                description,
                due_date: dueDate,
                assigned_user_id: assignedUserId,
                status,
              })
              setEditing(false)
            }}
          >
            Salvar
          </button>
          <button className="button ghost" type="button" onClick={() => setEditing(false)}>
            Cancelar
          </button>
        </div>
      </article>
    )
  }

  return (
    <article
      className={`card task-card draggable ${dragging ? 'dragging' : ''} ${
        dropEdge === 'before' ? 'drop-before' : dropEdge === 'after' ? 'drop-after' : ''
      }`}
      draggable
      onDragOver={onDragOverCard}
      onDrop={onDropCard}
      onDragStart={(event) => {
        if ((event.target as HTMLElement).closest('button, form')) {
          event.preventDefault()
          return
        }
        event.dataTransfer.setData('text/plain', String(task.id))
        event.dataTransfer.setData('text/task-id', String(task.id))
        event.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
    >
      <h4>{task.title}</h4>
      {task.description && <p>{task.description}</p>}
      <p className="muted">Responsável: {task.assigned_user_name}</p>
      {task.due_date && <p className="muted">Prazo: {formatDate(task.due_date)}</p>}
      <button className="button ghost small" type="button" onClick={() => setEditing(true)}>
        Editar
      </button>
    </article>
  )
}
