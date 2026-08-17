import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'

import { useProjectSocket } from '../hooks/useProjectSocket'
import type { Message, Task } from '../types'

type MessageListener = (message: Message) => void
type MessageDeletedListener = (messageId: number) => void
type TaskListener = (task: Task) => void
type TaskDeletedListener = (taskId: number) => void

interface ProjectRealtimeValue {
  send: (content: string) => boolean
  connected: boolean
  subscribeMessages: (listener: MessageListener) => () => void
  subscribeMessageDeleted: (listener: MessageDeletedListener) => () => void
  subscribeTasks: (listener: TaskListener) => () => void
  subscribeTaskDeleted: (listener: TaskDeletedListener) => () => void
}

const ProjectRealtimeContext = createContext<ProjectRealtimeValue | undefined>(undefined)

export function ProjectRealtimeProvider({
  projectId,
  children,
}: {
  projectId: string
  children: ReactNode
}) {
  const messageListeners = useRef(new Set<MessageListener>())
  const messageDeletedListeners = useRef(new Set<MessageDeletedListener>())
  const taskListeners = useRef(new Set<TaskListener>())
  const taskDeletedListeners = useRef(new Set<TaskDeletedListener>())

  const { send, connected } = useProjectSocket({
    projectId,
    enabled: true,
    onEvent: (event) => {
      if (event.type === 'message') {
        messageListeners.current.forEach((listener) => listener(event.payload))
      }
      if (event.type === 'message_deleted') {
        messageDeletedListeners.current.forEach((listener) => listener(event.payload.id))
      }
      if (event.type === 'task') {
        taskListeners.current.forEach((listener) => listener(event.payload))
      }
      if (event.type === 'tasks') {
        event.payload.forEach((task) => {
          taskListeners.current.forEach((listener) => listener(task))
        })
      }
      if (event.type === 'task_deleted') {
        taskDeletedListeners.current.forEach((listener) => listener(event.payload.id))
      }
    },
  })

  const subscribeMessages = useCallback((listener: MessageListener) => {
    messageListeners.current.add(listener)
    return () => {
      messageListeners.current.delete(listener)
    }
  }, [])

  const subscribeMessageDeleted = useCallback((listener: MessageDeletedListener) => {
    messageDeletedListeners.current.add(listener)
    return () => {
      messageDeletedListeners.current.delete(listener)
    }
  }, [])

  const subscribeTasks = useCallback((listener: TaskListener) => {
    taskListeners.current.add(listener)
    return () => {
      taskListeners.current.delete(listener)
    }
  }, [])

  const subscribeTaskDeleted = useCallback((listener: TaskDeletedListener) => {
    taskDeletedListeners.current.add(listener)
    return () => {
      taskDeletedListeners.current.delete(listener)
    }
  }, [])

  const value = useMemo(
    () => ({
      send,
      connected,
      subscribeMessages,
      subscribeMessageDeleted,
      subscribeTasks,
      subscribeTaskDeleted,
    }),
    [send, connected, subscribeMessages, subscribeMessageDeleted, subscribeTasks, subscribeTaskDeleted],
  )

  return <ProjectRealtimeContext.Provider value={value}>{children}</ProjectRealtimeContext.Provider>
}

export function useProjectRealtime(): ProjectRealtimeValue {
  const context = useContext(ProjectRealtimeContext)
  if (!context) {
    throw new Error('useProjectRealtime must be used within ProjectRealtimeProvider')
  }
  return context
}

export function useRealtimeMessages(onMessage: MessageListener): boolean {
  const { connected, subscribeMessages } = useProjectRealtime()
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  useEffect(() => {
    return subscribeMessages((message) => onMessageRef.current(message))
  }, [subscribeMessages])

  return connected
}

export function useRealtimeMessageDeleted(onDeleted: MessageDeletedListener): void {
  const { subscribeMessageDeleted } = useProjectRealtime()
  const onDeletedRef = useRef(onDeleted)
  onDeletedRef.current = onDeleted

  useEffect(() => {
    return subscribeMessageDeleted((messageId) => onDeletedRef.current(messageId))
  }, [subscribeMessageDeleted])
}

export function useRealtimeTasks(onTask: TaskListener): boolean {
  const { connected, subscribeTasks } = useProjectRealtime()
  const onTaskRef = useRef(onTask)
  onTaskRef.current = onTask

  useEffect(() => {
    return subscribeTasks((task) => onTaskRef.current(task))
  }, [subscribeTasks])

  return connected
}

export function useRealtimeTaskDeleted(onDeleted: TaskDeletedListener): void {
  const { subscribeTaskDeleted } = useProjectRealtime()
  const onDeletedRef = useRef(onDeleted)
  onDeletedRef.current = onDeleted

  useEffect(() => {
    return subscribeTaskDeleted((taskId) => onDeletedRef.current(taskId))
  }, [subscribeTaskDeleted])
}
