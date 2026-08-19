export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024
export const UPLOAD_ACCEPT =
  'image/jpeg,image/png,image/webp,text/plain,application/zip,.jpg,.jpeg,.png,.webp,.txt,.zip'
export const UPLOAD_HINT = 'JPEG, PNG, WEBP, TXT ou ZIP até 5 MB'

const IMAGE_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

export function isOverUploadLimit(size: number): boolean {
  return size > UPLOAD_MAX_BYTES
}

export function isFileDrag(event: { dataTransfer: DataTransfer | null }): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

export function filesFromDataTransfer(data: DataTransfer | null): File[] {
  return Array.from(data?.files ?? [])
}

export function filesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) {
    return []
  }
  const files: File[] = []
  const seen = new Set<string>()
  const push = (file: File) => {
    const key = `${file.name}:${file.size}:${file.type}:${file.lastModified}`
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    files.push(file)
  }
  for (const file of Array.from(data.files ?? [])) {
    push(file)
  }
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind !== 'file') {
      continue
    }
    const file = item.getAsFile()
    if (file) {
      push(file)
    }
  }
  return files
}

export function asChatImage(file: File): File | null {
  const mime = (file.type || '').split(';')[0].trim().toLowerCase()
  const extension = IMAGE_MIME_TO_EXT[mime]
  if (!extension) {
    return null
  }
  const name = file.name?.trim()
  if (name && /\.(jpe?g|png|webp)$/i.test(name)) {
    return file
  }
  return new File([file], `imagem${extension}`, {
    type: mime,
    lastModified: file.lastModified || Date.now(),
  })
}
