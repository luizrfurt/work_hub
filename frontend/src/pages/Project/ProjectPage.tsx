import { ArrowLeft, Pencil, Trash2, UserPlus } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { addMember, getProject, listMembers, removeMember } from '../../api/projects'
import { listUsers } from '../../api/users'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { DeleteProjectDialog } from '../../components/DeleteProjectDialog'
import { EditProjectDialog } from '../../components/EditProjectDialog'
import { ErrorAlert } from '../../components/ErrorAlert'
import { UserAvatar } from '../../components/UserAvatar'
import { useAuth } from '../../contexts/AuthContext'
import { ProjectRealtimeProvider } from '../../contexts/ProjectRealtimeContext'
import { useNotifications } from '../../contexts/NotificationsContext'
import type { Project, ProjectMember, User } from '../../types'
import { getErrorMessage } from '../../utils/format'
import { ChatTab } from './ChatTab'
import { TodoTab } from './TodoTab'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type Tab = 'chat' | 'tasks' | 'members'

export function ProjectPage() {
  const { projectId } = useParams()
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const [project, setProject] = useState<Project | null>(null)
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [tab, setTab] = useState<Tab>('chat')
  const [error, setError] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')

  async function load() {
    if (!projectId) {
      return
    }
    try {
      const [projectData, memberData] = await Promise.all([
        getProject(projectId),
        listMembers(projectId),
      ])
      setProject(projectData)
      setMembers(memberData)
      if (isAdmin) {
        setUsers(await listUsers())
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível abrir o projeto.'))
    }
  }

  useEffect(() => {
    void load()
  }, [projectId, isAdmin])

  async function handleAddMember(event: FormEvent) {
    event.preventDefault()
    if (!projectId || !selectedUserId) {
      return
    }
    setError('')
    try {
      await addMember(projectId, Number(selectedUserId))
      setSelectedUserId('')
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível adicionar o membro.'))
    }
  }

  async function handleRemove(userId: number) {
    if (!projectId) {
      return
    }
    setError('')
    try {
      await removeMember(projectId, userId)
      await load()
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível remover o membro.'))
    }
  }

  if (!projectId) {
    return <p className="text-muted-foreground">Projeto inválido.</p>
  }

  const availableUsers = users.filter(
    (item) => item.is_active && !members.some((member) => member.user_id === item.id),
  )

  return (
    <ProjectRealtimeProvider projectId={projectId}>
      <ProjectWorkspace
        tab={tab}
        setTab={setTab}
        project={project}
        members={members}
        availableUsers={availableUsers}
        selectedUserId={selectedUserId}
        setSelectedUserId={setSelectedUserId}
        error={error}
        projectId={projectId}
        isAdmin={isAdmin}
        onAddMember={handleAddMember}
        onRemove={handleRemove}
        onProjectUpdated={setProject}
      />
    </ProjectRealtimeProvider>
  )
}

function ProjectWorkspace({
  tab,
  setTab,
  project,
  members,
  availableUsers,
  selectedUserId,
  setSelectedUserId,
  error,
  projectId,
  isAdmin,
  onAddMember,
  onRemove,
  onProjectUpdated,
}: {
  tab: Tab
  setTab: (tab: Tab) => void
  project: Project | null
  members: ProjectMember[]
  availableUsers: User[]
  selectedUserId: string
  setSelectedUserId: (value: string) => void
  error: string
  projectId: string
  isAdmin: boolean
  onAddMember: (event: FormEvent) => void
  onRemove: (userId: number) => void
  onProjectUpdated: (project: Project) => void
}) {
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [pendingMember, setPendingMember] = useState<ProjectMember | null>(null)
  const currentTab = tab === 'members' && !isAdmin ? 'chat' : tab
  const { unreadFor, setActiveView, markRead } = useNotifications()
  const unreadCount = unreadFor(projectId)

  useEffect(() => {
    setActiveView(projectId, currentTab)
    return () => setActiveView(null, null)
  }, [projectId, currentTab, setActiveView, unreadCount])

  const tabTriggerClass =
    'group rounded-full px-4 py-2 font-semibold text-muted-foreground data-active:border data-active:border-[rgba(110,168,255,0.28)] data-active:bg-[rgba(110,168,255,0.16)] data-active:text-foreground dark:data-active:bg-[rgba(110,168,255,0.16)]'

  return (
    <>
    <Tabs
      value={currentTab}
      onValueChange={(value) => setTab(value as Tab)}
      className="project-workspace flex min-h-0 flex-1 flex-col gap-0"
    >
      <div className="shrink-0">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-4 max-[800px]:flex-col max-[800px]:items-start">
          <div className="min-w-0">
            <p className="mb-1 text-[0.72rem] font-bold tracking-[0.12em] text-primary uppercase">
              Projeto
            </p>
            <div className="flex min-w-0 items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                title="Voltar aos projetos"
                aria-label="Voltar aos projetos"
                onClick={() => navigate('/projects')}
              >
                <ArrowLeft />
              </Button>
              <h1 className="min-w-0 text-[1.75rem] font-bold tracking-[-0.02em]">
                {project?.name ?? 'Carregando...'}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && project && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title="Editar"
                  aria-label="Editar"
                  onClick={() => setEditing(true)}
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-sm"
                  title="Excluir"
                  aria-label="Excluir"
                  onClick={() => setDeleting(true)}
                >
                  <Trash2 />
                </Button>
              </>
            )}
            <TabsList className="h-auto w-fit max-w-full shrink-0 rounded-full border border-border bg-black/22 p-[0.3rem] max-[800px]:w-full max-[800px]:overflow-x-auto">
            <TabsTrigger value="chat" className={tabTriggerClass}>
              Conversa
              {unreadCount > 0 && (
                <Badge className="h-[1.15rem] min-w-[1.15rem] rounded-full bg-destructive px-[0.35rem] text-[0.68rem] font-extrabold text-white group-data-active:bg-primary group-data-active:text-primary-foreground">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="tasks" className={tabTriggerClass}>
              Tarefas
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="members" className={tabTriggerClass}>
                Membros
              </TabsTrigger>
            )}
          </TabsList>
          </div>
        </div>
        {project?.description && (
          <p className="mb-3 text-muted-foreground">{project.description}</p>
        )}
        {error && <ErrorAlert>{error}</ErrorAlert>}
      </div>
        <TabsContent
          value="chat"
          forceMount
          hidden={currentTab !== 'chat'}
          className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
        >
          <ChatTab projectId={projectId} />
        </TabsContent>
        <TabsContent
          value="tasks"
          forceMount
          hidden={currentTab !== 'tasks'}
          className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
        >
          <TodoTab projectId={projectId} members={members} />
        </TabsContent>
        {isAdmin && (
          <TabsContent
            value="members"
            forceMount
            hidden={currentTab !== 'members'}
            className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
          >
            <Card className="flex min-h-0 flex-1 flex-col">
              <CardContent className="flex min-h-0 flex-1 flex-col">
                <h3 className="shrink-0 text-[1.05rem] font-semibold">Integrantes do projeto</h3>
                <p className="shrink-0 text-muted-foreground">
                  Quem participa desta equipe e pode acessar conversa e tarefas.
                </p>
                <ul className="my-[0.7rem] mb-4 min-h-0 flex-1 list-none overflow-y-auto p-0">
                  {members.map((member) => (
                    <li
                      key={member.user_id}
                      className="flex items-center justify-between gap-3 border-b border-border py-[0.65rem]"
                    >
                      <span className="flex items-center gap-[0.65rem]">
                        <UserAvatar label={member.name.slice(0, 1).toUpperCase()} size="sm" />
                        <span>{member.name}</span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title="Remover"
                        aria-label={`Remover ${member.name}`}
                        onClick={() => setPendingMember(member)}
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
                <form
                  className="flex shrink-0 gap-[0.6rem] max-[800px]:grid max-[800px]:grid-cols-1"
                  onSubmit={(event) => void onAddMember(event)}
                >
                  <Select
                    value={selectedUserId || undefined}
                    onValueChange={setSelectedUserId}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecionar usuário" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {availableUsers.map((item) => (
                        <SelectItem key={item.id} value={String(item.id)}>
                          {item.name} ({item.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="submit"
                    size="icon"
                    className="size-10"
                    disabled={!selectedUserId}
                    title="Adicionar"
                    aria-label="Adicionar membro"
                  >
                    <UserPlus />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        )}
    </Tabs>
    <EditProjectDialog
      project={project}
      open={editing}
      onOpenChange={setEditing}
      onSaved={onProjectUpdated}
    />
    <DeleteProjectDialog
      project={project}
      open={deleting}
      onOpenChange={setDeleting}
      onDeleted={() => {
        markRead(Number(projectId))
        navigate('/projects')
      }}
    />
    <ConfirmDialog
      open={pendingMember !== null}
      title="Remover membro"
      description={
        pendingMember
          ? `Remover ${pendingMember.name} deste projeto?`
          : 'Este membro será removido do projeto.'
      }
      confirmLabel="Remover"
      onOpenChange={(open) => {
        if (!open) {
          setPendingMember(null)
        }
      }}
      onConfirm={() => {
        if (pendingMember) {
          void onRemove(pendingMember.user_id)
        }
        setPendingMember(null)
      }}
    />
    </>
  )
}
