import { Pencil, Trash2 } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { createProject, listProjects } from '../../api/projects'
import { DeleteProjectDialog } from '../../components/DeleteProjectDialog'
import { EditProjectDialog } from '../../components/EditProjectDialog'
import { ErrorAlert } from '../../components/ErrorAlert'
import { Field } from '../../components/Field'
import { useAuth } from '../../contexts/AuthContext'
import { useNotifications } from '../../contexts/NotificationsContext'
import type { Project } from '../../types'
import { getErrorMessage } from '../../utils/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export function DashboardPage() {
  const { user } = useAuth()
  const { unreadFor, syncFromProjects, markRead } = useNotifications()
  const [projects, setProjects] = useState<Project[]>([])
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState<Project | null>(null)
  const isAdmin = user?.role === 'ADMIN'

  async function loadProjects() {
    try {
      const items = await listProjects()
      setProjects(items)
      syncFromProjects(items)
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível carregar os projetos.'))
    }
  }

  useEffect(() => {
    void loadProjects()
  }, [])

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setCreating(true)
    setError('')
    try {
      await createProject({ name, description: description || undefined })
      setName('')
      setDescription('')
      setShowForm(false)
      await loadProjects()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível criar o projeto.'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <section>
      <div className="mb-[1.2rem] flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-[1.75rem] font-bold tracking-[-0.02em]">Projetos</h1>
          <p className="text-muted-foreground">
            {isAdmin
              ? 'Abra um projeto para conversar e acompanhar tarefas, ou use Dashboard para a visão geral.'
              : 'Escolha um projeto para conversar e acompanhar as tarefas.'}
          </p>
        </div>
        {isAdmin && (
          <Button type="button" onClick={() => setShowForm((value) => !value)}>
            + Novo projeto
          </Button>
        )}
      </div>

      {error && <ErrorAlert>{error}</ErrorAlert>}

      {showForm && isAdmin && (
        <Card className="mb-4">
          <CardContent>
            <form className="grid gap-[0.42rem]" onSubmit={(event) => void handleCreate(event)}>
              <h2 className="mb-2 text-[1.05rem] font-semibold">Novo projeto</h2>
              <Field label="Nome">
                <Input value={name} onChange={(event) => setName(event.target.value)} required />
              </Field>
              <Field label="Descrição" className="mt-2">
                <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
              </Field>
              <Button className="mt-3 w-fit" type="submit" disabled={creating}>
                {creating ? 'Criando...' : 'Criar projeto'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">
        {projects.map((project) => {
          const unread = unreadFor(project.id)
          return (
            <Card
              key={project.id}
              className={cn(
                'relative grid min-h-[168px] content-start overflow-hidden transition-[border-color,background] duration-150',
                'hover:border-[rgba(110,168,255,0.35)] hover:bg-[linear-gradient(180deg,rgba(110,168,255,0.08),transparent_40%),var(--card)]',
              )}
            >
              <Link to={`/projects/${project.id}`} className="text-inherit no-underline">
                <CardContent>
                  {unread > 0 && (
                    <Badge className="absolute top-[0.85rem] right-[0.9rem] h-auto min-h-[1.35rem] rounded-full bg-destructive px-[0.55rem] py-[0.22rem] text-[0.72rem] font-extrabold text-white">
                      {unread > 9 ? '9+' : unread} {unread === 1 ? 'nova' : 'novas'}
                    </Badge>
                  )}
                  <span
                    className="mb-[0.7rem] grid size-[38px] place-items-center rounded-[10px] border border-[rgba(110,168,255,0.22)] bg-[rgba(110,168,255,0.14)] font-extrabold text-primary"
                    aria-hidden="true"
                  >
                    {project.name.slice(0, 1).toUpperCase()}
                  </span>
                  <h2 className="text-[1.05rem] font-semibold">{project.name}</h2>
                  <p className="text-muted-foreground">{project.description || 'Sem descrição'}</p>
                  <Badge
                    variant="secondary"
                    className="mt-[0.85rem] w-fit rounded-full border border-[rgba(110,168,255,0.28)] bg-[rgba(110,168,255,0.12)] px-[0.7rem] py-[0.22rem] text-[0.78rem] font-semibold text-primary"
                  >
                    {project.member_count} {project.member_count === 1 ? 'membro' : 'membros'}
                  </Badge>
                </CardContent>
              </Link>
              {isAdmin && (
                <div className="flex flex-wrap gap-2 px-(--card-spacing) pb-(--card-spacing)">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="Editar"
                    aria-label="Editar"
                    onClick={() => setEditing(project)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon-sm"
                    title="Excluir"
                    aria-label="Excluir"
                    onClick={() => setDeleting(project)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              )}
            </Card>
          )
        })}
        {projects.length === 0 && (
          <Card className="col-span-full px-3 py-7 text-center text-muted-foreground">
            <CardContent>
              <strong className="text-foreground">Nenhum projeto por aqui ainda</strong>
              <p className="text-muted-foreground">
                {isAdmin
                  ? 'Crie o primeiro projeto para começar a conversar e organizar as tarefas.'
                  : 'Peça a um administrador para incluir você em um projeto.'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <EditProjectDialog
        project={editing}
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null)
          }
        }}
        onSaved={(updated) => {
          setProjects((items) => items.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)))
        }}
      />
      <DeleteProjectDialog
        project={deleting}
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null)
          }
        }}
        onDeleted={() => {
          if (!deleting) {
            return
          }
          markRead(deleting.id)
          setProjects((items) => items.filter((item) => item.id !== deleting.id))
        }}
      />
    </section>
  )
}
