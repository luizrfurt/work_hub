import { useCallback, useEffect, useRef, useState } from 'react'

import { wsBaseUrl } from '../api/client'
import type { Message, Task } from '../types'
import { getAccessToken } from '../utils/storage'

export type ProjectSocketEvent =
  | { type: 'message'; payload: Message }
  | { type: 'task'; payload: Task }
  | { type: 'tasks'; payload: Task[] }
  | { type: 'task_deleted'; payload: { id: number } }

interface UseProjectSocketOptions {
  projectId: string
  enabled: boolean
  onEvent: (event: ProjectSocketEvent) => void
}

export function useProjectSocket({ projectId, enabled, onEvent }: UseProjectSocketOptions) {
  const socketRef = useRef<WebSocket | null>(null)
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

    const connect = () => {
      const token = getAccessToken()
      if (!token || stopped) {
        return
      }
      let socket: WebSocket
      try {
        socket = new WebSocket(
          `${wsBaseUrl}/ws/projects/${projectId}?token=${encodeURIComponent(token)}`,
        )
      } catch {
        return
      }
      socketRef.current = socket

      socket.onopen = () => {
        retries = 0
        setConnected(true)
      }

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as ProjectSocketEvent
          if (data.type === 'message' && data.payload) {
            onEventRef.current(data)
          }
          if (data.type === 'task' && data.payload) {
            onEventRef.current(data)
          }
          if (data.type === 'tasks' && Array.isArray(data.payload)) {
            onEventRef.current(data)
          }
          if (data.type === 'task_deleted' && data.payload?.id) {
            onEventRef.current(data)
          }
        } catch {
          // ignore malformed frames
        }
      }

      socket.onclose = () => {
        setConnected(false)
        if (socketRef.current === socket) {
          socketRef.current = null
        }
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
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [projectId, enabled])

  const send = useCallback((content: string, replyToId?: number | null): boolean => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false
    }
    socket.send(
      JSON.stringify({
        content,
        ...(replyToId != null ? { reply_to_id: replyToId } : {}),
      }),
    )
    return true
  }, [])

  return { send, connected }
}
