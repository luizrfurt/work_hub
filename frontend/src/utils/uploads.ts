export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024
export const UPLOAD_ACCEPT =
  'image/jpeg,image/png,image/webp,text/plain,application/zip,.jpg,.jpeg,.png,.webp,.txt,.zip'
export const UPLOAD_HINT = 'JPEG, PNG, WEBP, TXT ou ZIP até 5 MB'

export function isOverUploadLimit(size: number): boolean {
  return size > UPLOAD_MAX_BYTES
}

export function isFileDrag(event: { dataTransfer: DataTransfer | null }): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

export function filesFromDataTransfer(data: DataTransfer | null): File[] {
  return Array.from(data?.files ?? [])
}
