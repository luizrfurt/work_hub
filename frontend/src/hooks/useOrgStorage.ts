import { useCallback, useEffect, useState } from 'react'

import { getStorageUsage } from '../api/projects'
import type { StorageUsage } from '../types'

export function useOrgStorage() {
  const [usage, setUsage] = useState<StorageUsage | null>(null)

  const refresh = useCallback(async () => {
    try {
      setUsage(await getStorageUsage())
    } catch {
      return
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { usage, refresh }
}
