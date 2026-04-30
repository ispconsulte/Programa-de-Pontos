import { backendRequest } from '@/lib/backend-client'
import { setErrorViewerIsFullAdmin } from '@/lib/friendly-errors'

export interface CurrentUserProfile {
  id: string
  tenant_id: string | null
  email: string
  role: string
  is_active: boolean
  is_full_admin: boolean
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
  is_full_admin: boolean
  tenant_id: string | null
  tenant_name?: string | null
  regiao_id?: string | null
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
  role: 'admin' | 'operator' | 'full_admin'
  tenantId?: string
  regiaoId?: string
}

export interface UpdateManagedUserInput {
  name?: string
  password?: string
  role?: 'admin' | 'operator' | 'full_admin'
  isActive?: boolean
  tenantId?: string
  regiaoId?: string | null
}

export function isAdminUiRole(role: string | null | undefined): boolean {
  return ['admin', 'owner', 'manager'].includes(String(role ?? '').toLowerCase())
}

function isCurrentUserProfile(value: unknown): value is CurrentUserProfile {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<CurrentUserProfile>
  return typeof candidate.id === 'string'
    && (typeof candidate.tenant_id === 'string' || candidate.tenant_id === null)
    && typeof candidate.email === 'string'
    && typeof candidate.role === 'string'
}

export function isFullAdminProfile(profile: CurrentUserProfile | null | undefined): boolean {
  return profile?.is_full_admin === true
}

let currentUserProfileCache: CurrentUserProfile | null = null
let currentUserProfilePromise: Promise<CurrentUserProfile> | null = null

export function getCachedCurrentUserProfile(): CurrentUserProfile | null {
  return currentUserProfileCache
}

export function clearCurrentUserProfileCache(): void {
  currentUserProfileCache = null
  currentUserProfilePromise = null
  setErrorViewerIsFullAdmin(false)
}

export async function fetchCurrentUserProfile(options?: { force?: boolean; preserveCache?: boolean }): Promise<CurrentUserProfile> {
  if (options?.force && !options.preserveCache) {
    clearCurrentUserProfileCache()
  }

  if (currentUserProfileCache && !options?.force) {
    return currentUserProfileCache
  }

  if (!currentUserProfilePromise) {
    currentUserProfilePromise = backendRequest<CurrentUserProfile>('/users/me')
      .then((profile) => {
        if (!isCurrentUserProfile(profile)) {
          throw new Error('Resposta inválida ao carregar perfil do usuário.')
        }

        currentUserProfileCache = profile
        setErrorViewerIsFullAdmin(profile.is_full_admin === true)
        return profile
      })
      .catch((backendErr) => {
        currentUserProfilePromise = null
        throw backendErr
      })
      .finally(() => {
        currentUserProfilePromise = null
      })
  }

  return currentUserProfilePromise
}

export async function fetchManagedUsers(): Promise<ManagedUser[]> {
  const response = await backendRequest<{ data: ManagedUser[] } | null>('/users')
  return response?.data ?? []
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
