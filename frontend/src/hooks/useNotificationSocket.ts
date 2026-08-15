import { useEffect, useRef, useState } from 'react'

import { wsBaseUrl } from '../api/client'
import type { Message } from '../types'
import { getAccessToken } from '../utils/storage'

export type NotificationSocketEvent = {
  type: 'message'
  payload: Message
  project_name?: string
}

interface UseNotificationSocketOptions {
  enabled: boolean
  onEvent: (event: NotificationSocketEvent) => void
}

export function useNotificationSocket({ enabled, onEvent }: UseNotificationSocketOptions) {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!enabled) {
      return
    }

    let stopped = false
    let retries = 0
    let reconnectTimer: number | undefined
    let socket: WebSocket | null = null

    const connect = () => {
      const token = getAccessToken()
      if (!token || stopped) {
        return
      }
      try {
        socket = new WebSocket(`${wsBaseUrl}/ws/notifications?token=${encodeURIComponent(token)}`)
      } catch {
        return
      }

      socket.onopen = () => {
        retries = 0
        setConnected(true)
      }

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as NotificationSocketEvent
          if (data.type === 'message' && data.payload) {
            onEventRef.current(data)
          }
        } catch {
          // ignore malformed frames
        }
      }

      socket.onclose = () => {
        setConnected(false)
        if (stopped) {
          return
        }
        const delay = Math.min(1000 * 2 ** retries, 8000)
        retries += 1
        reconnectTimer = window.setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      stopped = true
      setConnected(false)
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer)
      }
      socket?.close()
    }
  }, [enabled])

  return { connected }
}
