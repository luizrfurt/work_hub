import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { getOverview } from '../../api/projects'
import type { Overview } from '../../types'
import { getErrorMessage } from '../../utils/format'

function percent(done: number, total: number) {
  if (total <= 0) {
    return 0
  }
  return Math.round((done / total) * 100)
}

export function OverviewPage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getOverview()
      .then(setOverview)
      .catch((err) => setError(getErrorMessage(err, 'Não foi possível carregar o dashboard.')))
  }, [])

  return (
    <section>
      <div className="page-header">
        <div>
          <p className="eyebrow">Administração</p>
          <h1>Dashboard</h1>
          <p className="muted">
            Visão geral dos projetos: tarefas ativas, concluídas e o que cada pessoa fez.
          </p>
        </div>
      </div>

      {error && <div className="alert">{error}</div>}

      {overview && (
        <>
          <div className="stat-grid">
            <article className="card stat-card">
              <span className="muted">Projetos</span>
              <strong className="stat-value">{overview.project_count}</strong>
            </article>
            <article className="card stat-card">
              <span className="muted">Pessoas em projetos</span>
              <strong className="stat-value">{overview.people_count}</strong>
            </article>
            <article className="card stat-card">
              <span className="muted">Tarefas ativas</span>
              <strong className="stat-value">{overview.active}</strong>
              <small className="muted">
                {overview.todo} a fazer · {overview.in_progress} em andamento
              </small>
            </article>
            <article className="card stat-card">
              <span className="muted">Concluídas</span>
              <strong className="stat-value">{overview.done}</strong>
              <small className="muted">
                {percent(overview.done, overview.total)}% do total ({overview.total})
              </small>
            </article>
          </div>

          <div className="card overview-block">
            <h2>Andamento por projeto</h2>
            {overview.projects.length === 0 ? (
              <p className="muted">Ainda não há projetos.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Projeto</th>
                      <th>Membros</th>
                      <th>A fazer</th>
                      <th>Em andamento</th>
                      <th>Concluídas</th>
                      <th>Progresso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.projects.map((project) => {
                      const donePct = percent(project.done, project.total)
                      return (
                        <tr key={project.id}>
                          <td>
                            <Link to={`/projects/${project.id}`} className="table-link">
                              {project.name}
                            </Link>
                          </td>
                          <td>{project.member_count}</td>
                          <td>{project.todo}</td>
                          <td>{project.in_progress}</td>
                          <td>{project.done}</td>
                          <td>
                            <div className="progress-cell">
                              <div className="progress-track" aria-hidden="true">
                                <span className="progress-fill" style={{ width: `${donePct}%` }} />
                              </div>
                              <span className="muted">
                                {project.total === 0 ? 'Sem tarefas' : `${donePct}%`}
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card overview-block">
            <h2>Tarefas por pessoa</h2>
            <p className="muted">Contagem pelo responsável da tarefa. Concluídas = o que cada um fez.</p>
            {overview.contributors.length === 0 ? (
              <p className="muted">Nenhuma tarefa atribuída ainda.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Pessoa</th>
                      <th>A fazer</th>
                      <th>Em andamento</th>
                      <th>Concluídas</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.contributors.map((person) => (
                      <tr key={person.user_id}>
                        <td>
                          {person.name}
                          <div className="muted">{person.username}</div>
                        </td>
                        <td>{person.todo}</td>
                        <td>{person.in_progress}</td>
                        <td>{person.done}</td>
                        <td>{person.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
