export type UserRole = 'ADMIN' | 'COLLABORATOR'
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'

export interface User {
  id: number
  organization_id: number
  username: string
  name: string
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}

export interface Project {
  id: number
  name: string
  description: string | null
  created_by: number
  member_count: number
  last_message_at: string | null
  created_at: string
  updated_at: string
}

export interface ProjectMember {
  user_id: number
  username: string
  name: string
  joined_at: string
}

export interface Attachment {
  id: number
  original_name: string
  mime_type: string
  size: number
  created_at: string
}

export interface Message {
  id: number
  project_id: number
  user_id: number
  author_name: string
  content: string | null
  attachments: Attachment[]
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface MessageList {
  items: Message[]
  limit: number
  offset: number
  total: number
}

export interface Task {
  id: number
  project_id: number
  title: string
  description: string | null
  due_date: string | null
  assigned_user_id: number
  assigned_user_name: string
  status: TaskStatus
  position: number
  created_by: number
  created_at: string
  updated_at: string
  attachments: Attachment[]
}

export interface ApiError {
  message: string
}

export interface OverviewProject {
  id: number
  name: string
  member_count: number
  todo: number
  in_progress: number
  done: number
  active: number
  total: number
}

export interface OverviewContributor {
  user_id: number
  name: string
  username: string
  todo: number
  in_progress: number
  done: number
  active: number
  total: number
}

export interface StorageUsage {
  storage_used_bytes: number
  storage_quota_bytes: number
  storage_file_count: number
}

export interface Overview {
  project_count: number
  people_count: number
  todo: number
  in_progress: number
  done: number
  active: number
  total: number
  storage_used_bytes: number
  storage_quota_bytes: number
  storage_file_count: number
  projects: OverviewProject[]
  contributors: OverviewContributor[]
}
