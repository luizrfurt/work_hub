import { type FormEvent, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { addMember, getProject, listMembers, removeMember } from '../../api/projects'
import { listUsers } from '../../api/users'
import { useAuth } from '../../contexts/AuthContext'
import { ProjectRealtimeProvider } from '../../contexts/ProjectRealtimeContext'
import { useNotifications } from '../../contexts/NotificationsContext'
import type { Project, ProjectMember, User } from '../../types'
import { getErrorMessage } from '../../utils/format'
import { ChatTab } from './ChatTab'
import { TodoTab } from './TodoTab'

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
    return <p className="muted">Projeto inválido.</p>
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
        user={user}
        isAdmin={isAdmin}
        onAddMember={handleAddMember}
        onRemove={handleRemove}
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
  user,
  isAdmin,
  onAddMember,
  onRemove,
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
  user: User | null | undefined
  isAdmin: boolean
  onAddMember: (event: FormEvent) => void
  onRemove: (userId: number) => void
}) {
  const currentTab = tab === 'members' && !isAdmin ? 'chat' : tab
  const { unreadFor, setActiveView } = useNotifications()
  const unreadCount = unreadFor(projectId)

  useEffect(() => {
    setActiveView(projectId, currentTab)
    return () => setActiveView(null, null)
  }, [projectId, currentTab, setActiveView, unreadCount])

  return (
    <section className="project-workspace">
      <div className="project-chrome">
        <div className="page-header project-header">
          <div>
            <p className="eyebrow">Projeto</p>
            <h1>{project?.name ?? 'Carregando...'}</h1>
          </div>
          <div className="tabs">
            <button
              type="button"
              className={currentTab === 'chat' ? 'tab active' : 'tab'}
              onClick={() => setTab('chat')}
            >
              Conversa
              {unreadCount > 0 && (
                <span className="tab-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </button>
            <button
              type="button"
              className={currentTab === 'tasks' ? 'tab active' : 'tab'}
              onClick={() => setTab('tasks')}
            >
              Tarefas
            </button>
            {isAdmin && (
              <button
                type="button"
                className={currentTab === 'members' ? 'tab active' : 'tab'}
                onClick={() => setTab('members')}
              >
                Membros
              </button>
            )}
          </div>
        </div>
        {project?.description && <p className="project-description muted">{project.description}</p>}
        {error && <div className="alert">{error}</div>}
      </div>

      <div className="project-body">
        <div className="project-pane" hidden={currentTab !== 'chat'}>
          <ChatTab projectId={projectId} />
        </div>
        <div className="project-pane" hidden={currentTab !== 'tasks'}>
          <TodoTab projectId={projectId} members={members} />
        </div>
        {isAdmin && (
          <div className="project-pane" hidden={currentTab !== 'members'}>
          <div className="card members-box">
            <h3>Integrantes do projeto</h3>
            <p className="muted">Quem participa desta equipe e pode acessar conversa e tarefas.</p>
            <ul className="member-list">
              {members.map((member) => (
                <li key={member.user_id}>
                  <span className="member-identity">
                    <span className="avatar sm" aria-hidden="true">
                      {member.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span>{member.name}</span>
                  </span>
                  <button
                    type="button"
                    className="button ghost small"
                    onClick={() => void onRemove(member.user_id)}
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
            <form className="inline-form" onSubmit={(event) => void onAddMember(event)}>
              <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
                <option value="">Selecionar usuário</option>
                {availableUsers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.username})
                  </option>
                ))}
              </select>
              <button className="button primary" type="submit" disabled={!selectedUserId}>
                Adicionar
              </button>
            </form>
          </div>
        </div>
        )}
      </div>
    </section>
  )
}
