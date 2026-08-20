import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { getOverview } from '../../api/projects'
import { ErrorAlert } from '../../components/ErrorAlert'
import type { Overview } from '../../types'
import { formatBytes, getErrorMessage, statusTitleClass } from '../../utils/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
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

function storagePercent(used: number, quota: number) {
  if (quota <= 0) {
    return 0
  }
  return Math.min(100, (used / quota) * 100)
}

function storageLevel(pct: number): 'ok' | 'warning' | 'critical' {
  if (pct >= 90) {
    return 'critical'
  }
  if (pct >= 70) {
    return 'warning'
  }
  return 'ok'
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
                <small>
                  <span className={statusTitleClass('TODO')}>{overview.todo} a fazer</span>
                  {' · '}
                  <span className={statusTitleClass('IN_PROGRESS')}>
                    {overview.in_progress} em andamento
                  </span>
                </small>
              </CardContent>
            </Card>
            <Card className="gap-1">
              <CardContent className="grid gap-[0.2rem]">
                <span className={statusTitleClass('DONE')}>Concluídas</span>
                <strong className="text-[1.7rem] leading-[1.1] tracking-[-0.03em]">{overview.done}</strong>
                <small className="text-muted-foreground">
                  {percent(overview.done, overview.total)}% do total ({overview.total})
                </small>
              </CardContent>
            </Card>
          </div>

          <StorageUsage overview={overview} />

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
                      <TableHead className={statusTitleClass('TODO')}>A fazer</TableHead>
                      <TableHead className={statusTitleClass('IN_PROGRESS')}>Em andamento</TableHead>
                      <TableHead className={statusTitleClass('DONE')}>Concluídas</TableHead>
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
                      <TableHead className={statusTitleClass('TODO')}>A fazer</TableHead>
                      <TableHead className={statusTitleClass('IN_PROGRESS')}>Em andamento</TableHead>
                      <TableHead className={statusTitleClass('DONE')}>Concluídas</TableHead>
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

function formatQuota(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024)
  if (Math.abs(gb - Math.round(gb)) < 0.01) {
    return `${Math.round(gb)} GB`
  }
  return formatBytes(bytes)
}

function formatStoragePercent(pct: number, used: number): string {
  if (used <= 0 || pct <= 0) {
    return '0%'
  }
  if (pct < 0.1) {
    return '< 0,1%'
  }
  if (pct < 1) {
    return `${pct.toFixed(1).replace('.', ',')}%`
  }
  return `${Math.round(pct)}%`
}

function StorageUsage({ overview }: { overview: Overview }) {
  const used = overview.storage_used_bytes
  const quota = overview.storage_quota_bytes
  const pct = storagePercent(used, quota)
  const level = storageLevel(pct)
  const quotaLabel = formatQuota(quota)
  const pctLabel = formatStoragePercent(pct, used)
  const fileLabel =
    overview.storage_file_count === 1
      ? '1 anexo'
      : `${overview.storage_file_count} anexos`

  return (
    <Card
      className={cn(
        'mb-4',
        level === 'critical' && 'border-[rgba(255,107,107,0.35)]',
        level === 'warning' && 'border-[rgba(255,196,92,0.35)]',
      )}
    >
      <CardHeader>
        <CardTitle className="text-[1.05rem] font-semibold">Armazenamento</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <strong className="text-[1.35rem] leading-[1.1] tracking-[-0.03em]">
            {formatBytes(used)} de {quotaLabel}
          </strong>
          <span className="text-muted-foreground">
            {pctLabel} · {fileLabel}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/6" aria-hidden="true">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              level === 'critical' && 'bg-destructive',
              level === 'warning' && 'bg-[rgba(255,196,92,0.85)]',
              level === 'ok' && 'bg-[rgba(110,168,255,0.65)]',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        {level === 'ok' ? (
          <p className="text-muted-foreground">
            Cota definida para o WorkHub ({quotaLabel}). Não reserva espaço no disco da VPS.
          </p>
        ) : (
          <p
            className={cn(
              level === 'critical' ? 'text-destructive' : 'text-[rgb(232,176,70)]',
            )}
          >
            Você usou {pctLabel} de {quotaLabel} reservados.
            {level === 'critical' ? ' Considere remover anexos antigos ou aumentar a cota.' : ''}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
