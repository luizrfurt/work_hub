import { useEffect, useState } from 'react'

import { getAccessToken } from '../utils/storage'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export function AttachmentView({
  url,
  mimeType,
  name,
  imageClassName,
  compact = false,
}: {
  url: string
  mimeType: string
  name: string
  imageClassName?: string
  compact?: boolean
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const isImage = mimeType.startsWith('image/')

  useEffect(() => {
    const token = getAccessToken()
    if (!token) {
      return
    }
    let revoked = false
    let createdUrl: string | null = null
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => response.blob())
      .then((blob) => {
        createdUrl = URL.createObjectURL(blob)
        if (!revoked) {
          setObjectUrl(createdUrl)
        } else {
          URL.revokeObjectURL(createdUrl)
        }
      })
      .catch(() => undefined)
    return () => {
      revoked = true
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl)
      }
    }
  }, [url])

  if (!compact && isImage) {
    return objectUrl ? (
      <>
        <button
          type="button"
          className={cn(
            'my-[0.45rem] block max-w-[260px] cursor-zoom-in rounded-[10px] p-0',
            imageClassName,
          )}
          title="Ampliar imagem"
          aria-label={`Ampliar ${name}`}
          onClick={() => setPreview(true)}
        >
          <img className="block max-w-[260px] rounded-[10px]" src={objectUrl} alt={name} />
        </button>
        <ImagePreviewDialog name={name} objectUrl={objectUrl} open={preview} onOpenChange={setPreview} />
      </>
    ) : (
      <p className="text-muted-foreground">{name}</p>
    )
  }

  if (compact && isImage) {
    return (
      <>
        <button
          type="button"
          className="min-w-0 truncate text-left text-[0.9rem] text-primary underline"
          disabled={!objectUrl}
          onClick={() => setPreview(true)}
        >
          {name}
        </button>
        {objectUrl && (
          <ImagePreviewDialog name={name} objectUrl={objectUrl} open={preview} onOpenChange={setPreview} />
        )}
      </>
    )
  }

  return objectUrl ? (
    <a
      className={cn('text-primary underline', compact && 'min-w-0 truncate text-[0.9rem]')}
      href={objectUrl}
      download={name}
    >
      {name}
    </a>
  ) : (
    <span className={cn('text-muted-foreground', compact && 'min-w-0 truncate text-[0.9rem]')}>
      {name}
    </span>
  )
}

function ImagePreviewDialog({
  name,
  objectUrl,
  open,
  onOpenChange,
}: {
  name: string
  objectUrl: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[min(92vw,900px)] p-3 sm:max-w-[min(92vw,900px)]"
        onClick={() => onOpenChange(false)}
      >
        <DialogTitle className="sr-only">{name}</DialogTitle>
        <DialogDescription className="sr-only">Pré-visualização da imagem</DialogDescription>
        <img
          src={objectUrl}
          alt={name}
          className="max-h-[80vh] w-full rounded-[10px] object-contain"
        />
      </DialogContent>
    </Dialog>
  )
}
