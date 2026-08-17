import { useEffect, useState } from 'react'

import { getAccessToken } from '../utils/storage'
import { cn } from '@/lib/utils'

export function AttachmentView({
  url,
  mimeType,
  name,
  imageClassName,
}: {
  url: string
  mimeType: string
  name: string
  imageClassName?: string
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

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

  if (mimeType.startsWith('image/')) {
    return objectUrl ? (
      <img
        className={cn('my-[0.45rem] block max-w-[260px] rounded-[10px]', imageClassName)}
        src={objectUrl}
        alt={name}
      />
    ) : (
      <p className="text-muted-foreground">{name}</p>
    )
  }

  return objectUrl ? (
    <a className="text-primary underline" href={objectUrl} download={name}>
      {name}
    </a>
  ) : (
    <span className="text-muted-foreground">{name}</span>
  )
}
