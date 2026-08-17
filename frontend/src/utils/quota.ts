import type { StorageUsage } from '../types'
import { formatBytes } from './format'

function formatQuota(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024)
  if (Math.abs(gb - Math.round(gb)) < 0.01) {
    return `${Math.round(gb)} GB`
  }
  return formatBytes(bytes)
}

export function checkUploadQuota(
  usage: StorageUsage | null,
  incomingBytes: number,
): { blocked?: string; warning?: string } {
  if (!usage || usage.storage_quota_bytes <= 0) {
    return {}
  }
  const used = usage.storage_used_bytes
  const quota = usage.storage_quota_bytes
  if (used + incomingBytes > quota) {
    return {
      blocked: `Não há espaço na cota de armazenamento (${formatQuota(quota)}). Remova anexos ou peça ao admin para aumentar a cota.`,
    }
  }
  const pct = ((used + incomingBytes) / quota) * 100
  if (pct >= 90) {
    return {
      warning: `A cota está quase cheia (${Math.round(pct)}% de ${formatQuota(quota)}). Considere remover anexos antigos.`,
    }
  }
  if (pct >= 70) {
    return {
      warning: `Você usou ${Math.round(pct)}% de ${formatQuota(quota)} reservados.`,
    }
  }
  return {}
}
