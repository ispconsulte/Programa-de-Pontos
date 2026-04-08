import { backendRequest } from '@/lib/backend-client'

export interface CurrentUserProfile {
  id: string
  tenant_id: string
  email: string
  role: string
  is_active: boolean
  name: string
  last_sign_in_at: string | null
  created_at: string
  updated_at: string
}

export interface ManagedUser {
  id: string
  email: string
  role: string
  is_active: boolean
  name: string
  created_at: string
  updated_at: string
  last_sign_in_at: string | null
  session_revoked_at: string | null
  is_current_user: boolean
}

export interface CreateManagedUserInput {
  email: string
  password: string
  name?: string
  role: 'admin' | 'operator'
}

export interface UpdateManagedUserInput {
  name?: string
  password?: string
  role?: 'admin' | 'operator'
  isActive?: boolean
}

export function isAdminUiRole(role: string | null | undefined): boolean {
  return ['admin', 'owner', 'manager'].includes(String(role ?? '').toLowerCase())
}

export async function fetchCurrentUserProfile(): Promise<CurrentUserProfile> {
  return backendRequest<CurrentUserProfile>('/users/me')
}

export async function fetchManagedUsers(): Promise<ManagedUser[]> {
  const response = await backendRequest<{ data: ManagedUser[] }>('/users')
  return response.data
}

export async function createManagedUser(input: CreateManagedUserInput): Promise<void> {
  await backendRequest('/users', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateManagedUser(userId: string, input: UpdateManagedUserInput): Promise<void> {
  await backendRequest(`/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function disconnectManagedUser(userId: string): Promise<void> {
  await backendRequest(`/users/${userId}/disconnect`, {
    method: 'POST',
  })
}

export async function deleteManagedUser(userId: string): Promise<void> {
  await backendRequest(`/users/${userId}`, {
    method: 'DELETE',
  })
}
