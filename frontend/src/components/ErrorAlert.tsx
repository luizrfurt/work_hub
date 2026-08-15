import type { ReactNode } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'

export function ErrorAlert({ children }: { children: ReactNode }) {
  return (
    <Alert variant="destructive" className="mb-4 px-[0.9rem] py-3">
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}
