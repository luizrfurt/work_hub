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

export function formatDate(value: string): string {
  const [year, month, day] = value.split('-')
  if (!year || !month || !day) {
    return value
  }
  return `${day}/${month}/${year}`
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

export function getErrorMessage(error: unknown, fallback = 'Ocorreu um erro.'): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response
    if (response?.data?.message) {
      return response.data.message
    }
  }
  return fallback
}
