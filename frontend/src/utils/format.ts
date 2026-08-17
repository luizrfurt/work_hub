export function formatDateTime(value: string): string {
  const date = new Date(value)
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function isEdited(createdAt: string, updatedAt?: string | null): boolean {
  if (!updatedAt) {
    return false
  }
  return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 1000
}

export function formatDate(value: string): string {
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) {
    return value
  }
  return `${day}/${month}/${year}`
}

export function isOverdue(dueDate: string | null | undefined, status: string): boolean {
  if (!dueDate || status === 'DONE') {
    return false
  }
  const [year, month, day] = dueDate.split('-').map(Number)
  if (!year || !month || !day) {
    return false
  }
  const due = new Date(year, month - 1, day)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return due < today
}

export function roleLabel(role: string): string {
  return role === 'ADMIN' ? 'Administrador' : 'Colaborador'
}

export function homePath(role?: string | null): string {
  return role === 'ADMIN' ? '/dashboard' : '/projects'
}

export function statusLabel(status: string): string {
  if (status === 'TODO') return 'A fazer'
  if (status === 'IN_PROGRESS') return 'Em andamento'
  return 'Concluído'
}

export function statusColumnClass(status: string): string {
  if (status === 'IN_PROGRESS') {
    return 'shadow-[inset_0_0_0_1px_rgba(110,168,255,0.34)] bg-[rgba(110,168,255,0.07)]'
  }
  if (status === 'DONE') {
    return 'shadow-[inset_0_0_0_1px_rgba(109,255,176,0.3)] bg-[rgba(109,255,176,0.06)]'
  }
  return 'shadow-[inset_0_0_0_1px_rgba(148,163,184,0.32)] bg-[rgba(148,163,184,0.07)]'
}

export function statusTitleClass(status: string): string {
  if (status === 'IN_PROGRESS') {
    return 'text-primary'
  }
  if (status === 'DONE') {
    return 'text-ok'
  }
  return 'text-[rgb(176,188,204)]'
}

export function statusBadgeClass(status: string): string {
  if (status === 'IN_PROGRESS') {
    return 'border-[rgba(110,168,255,0.35)] bg-[rgba(110,168,255,0.14)] text-primary'
  }
  if (status === 'DONE') {
    return 'border-[rgba(109,255,176,0.35)] bg-[rgba(109,255,176,0.12)] text-ok'
  }
  return 'border-[rgba(148,163,184,0.35)] bg-[rgba(148,163,184,0.12)] text-[rgb(176,188,204)]'
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return '?'
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2).replace('.', ',')} GB`
}

export function getErrorMessage(error: unknown, fallback = 'Ocorreu um erro.'): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response
    if (response?.data?.message) {
      return response.data.message
    }
  }
  return fallback
}
