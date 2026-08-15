import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

export function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('grid gap-[0.42rem]', className)}>
      <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}
