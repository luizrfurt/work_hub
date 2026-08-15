import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { getOverview } from '../../api/projects'
import { ErrorAlert } from '../../components/ErrorAlert'
import type { Overview } from '../../types'
import { getErrorMessage } from '../../utils/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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
      <div className="mb-[1.2rem] flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-[0.72rem] font-bold tracking-[0.12em] text-primary uppercase">
            Administração
          </p>
          <h1 className="mb-1 text-[1.75rem] font-bold tracking-[-0.02em]">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral dos projetos: tarefas ativas, concluídas e o que cada pessoa fez.
          </p>
        </div>
      </div>

      {error && <ErrorAlert>{error}</ErrorAlert>}

      {overview && (
        <>
          <div className="mb-[1.2rem] grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
            <Card className="gap-1">
              <CardContent className="grid gap-[0.2rem]">
                <span className="text-muted-foreground">Projetos</span>
                <strong className="text-[1.7rem] leading-[1.1] tracking-[-0.03em]">{overview.project_count}</strong>
              </CardContent>
            </Card>
            <Card className="gap-1">
              <CardContent className="grid gap-[0.2rem]">
                <span className="text-muted-foreground">Pessoas em projetos</span>
                <strong className="text-[1.7rem] leading-[1.1] tracking-[-0.03em]">{overview.people_count}</strong>
              </CardContent>
            </Card>
            <Card className="gap-1">
              <CardContent className="grid gap-[0.2rem]">
                <span className="text-muted-foreground">Tarefas ativas</span>
                <strong className="text-[1.7rem] leading-[1.1] tracking-[-0.03em]">{overview.active}</strong>
                <small className="text-muted-foreground">
                  {overview.todo} a fazer · {overview.in_progress} em andamento
                </small>
              </CardContent>
            </Card>
            <Card className="gap-1">
              <CardContent className="grid gap-[0.2rem]">
                <span className="text-muted-foreground">Concluídas</span>
                <strong className="text-[1.7rem] leading-[1.1] tracking-[-0.03em]">{overview.done}</strong>
                <small className="text-muted-foreground">
                  {percent(overview.done, overview.total)}% do total ({overview.total})
                </small>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-[1.05rem] font-semibold">Andamento por projeto</CardTitle>
            </CardHeader>
            <CardContent>
              {overview.projects.length === 0 ? (
                <p className="text-muted-foreground">Ainda não há projetos.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Projeto</TableHead>
                      <TableHead>Membros</TableHead>
                      <TableHead>A fazer</TableHead>
                      <TableHead>Em andamento</TableHead>
                      <TableHead>Concluídas</TableHead>
                      <TableHead>Progresso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.projects.map((project) => {
                      const donePct = percent(project.done, project.total)
                      return (
                        <TableRow key={project.id}>
                          <TableCell>
                            <Link
                              to={`/projects/${project.id}`}
                              className="font-semibold text-primary hover:underline"
                            >
                              {project.name}
                            </Link>
                          </TableCell>
                          <TableCell>{project.member_count}</TableCell>
                          <TableCell>{project.todo}</TableCell>
                          <TableCell>{project.in_progress}</TableCell>
                          <TableCell>{project.done}</TableCell>
                          <TableCell>
                            <div className="grid min-w-[140px] gap-[0.28rem]">
                              <Progress value={donePct} aria-hidden="true" />
                              <span className="text-muted-foreground">
                                {project.total === 0 ? 'Sem tarefas' : `${donePct}%`}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-[1.05rem] font-semibold">Tarefas por pessoa</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-muted-foreground">
                Contagem pelo responsável da tarefa. Concluídas = o que cada um fez.
              </p>
              {overview.contributors.length === 0 ? (
                <p className="text-muted-foreground">Nenhuma tarefa atribuída ainda.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pessoa</TableHead>
                      <TableHead>A fazer</TableHead>
                      <TableHead>Em andamento</TableHead>
                      <TableHead>Concluídas</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.contributors.map((person) => (
                      <TableRow key={person.user_id}>
                        <TableCell>
                          {person.name}
                          <div className="text-muted-foreground">{person.username}</div>
                        </TableCell>
                        <TableCell>{person.todo}</TableCell>
                        <TableCell>{person.in_progress}</TableCell>
                        <TableCell>{person.done}</TableCell>
                        <TableCell>{person.total}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </section>
  )
}
