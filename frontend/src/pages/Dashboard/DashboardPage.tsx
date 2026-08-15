import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { createProject, listProjects } from '../../api/projects'
import { useAuth } from '../../contexts/AuthContext'
import { useNotifications } from '../../contexts/NotificationsContext'
import type { Project } from '../../types'
import { getErrorMessage } from '../../utils/format'

export function DashboardPage() {
  const { user } = useAuth()
  const { unreadFor, syncFromProjects } = useNotifications()
  const [projects, setProjects] = useState<Project[]>([])
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)

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
      <div className="page-header">
        <div>
          <h1>Projetos</h1>
          <p className="muted">
            {user?.role === 'ADMIN'
              ? 'Abra um projeto para conversar e acompanhar tarefas, ou use Dashboard para a visão geral.'
              : 'Escolha um projeto para conversar e acompanhar as tarefas.'}
          </p>
        </div>
        {user && (
          <button className="button primary" type="button" onClick={() => setShowForm((value) => !value)}>
            + Novo projeto
          </button>
        )}
      </div>

      {error && <div className="alert">{error}</div>}

      {showForm && (
        <form className="card form-card" onSubmit={(event) => void handleCreate(event)}>
          <h2>Novo projeto</h2>
          <label>
            Nome
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            Descrição
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
          </label>
          <button className="button primary" type="submit" disabled={creating}>
            {creating ? 'Criando...' : 'Criar projeto'}
          </button>
        </form>
      )}

      <div className="project-grid">
        {projects.map((project) => {
          const unread = unreadFor(project.id)
          return (
            <Link key={project.id} to={`/projects/${project.id}`} className="card project-card">
              {unread > 0 && (
                <span className="project-unread">
                  {unread > 9 ? '9+' : unread} {unread === 1 ? 'nova' : 'novas'}
                </span>
              )}
              <span className="project-card-mark" aria-hidden="true">
                {project.name.slice(0, 1).toUpperCase()}
              </span>
              <h2>{project.name}</h2>
              <p className="muted">{project.description || 'Sem descrição'}</p>
              <span className="chip">
                {project.member_count} {project.member_count === 1 ? 'membro' : 'membros'}
              </span>
            </Link>
          )
        })}
        {projects.length === 0 && (
          <div className="empty-state card">
            <strong>Nenhum projeto por aqui ainda</strong>
            <p className="muted">Crie o primeiro projeto para começar a conversar e organizar as tarefas.</p>
          </div>
        )}
      </div>
    </section>
  )
}
