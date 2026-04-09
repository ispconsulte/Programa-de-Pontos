import { backendRequest } from '@/lib/backend-client'
import { supabase } from '@/lib/supabase-client'

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

function resolveSessionRole(user: any): string {
  const appRole = String(user?.app_metadata?.role ?? '').trim()
  if (appRole) return appRole

  const metadataRole = String(user?.user_metadata?.role ?? '').trim()
  if (metadataRole) return metadataRole

  return ''
}

function resolveSessionName(user: any): string {
  return String(
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.display_name ||
    user?.email?.split('@')[0] ||
    'Usuário',
  )
}

async function fetchCurrentUserProfileFromSupabase(): Promise<CurrentUserProfile> {
  const { data: sessionData } = await supabase.auth.getSession()
  const sessionUser = sessionData.session?.user

  if (!sessionUser) {
    throw new Error('Sessão não encontrada.')
  }

  // Try direct DB query first
  const directProfileQuery = await supabase
    .from('users')
    .select('id, tenant_id, email, role, created_at')
    .eq('id', sessionUser.id)
    .maybeSingle()

  if (directProfileQuery.data) {
    return {
      id: String(directProfileQuery.data.id),
      tenant_id: String(directProfileQuery.data.tenant_id),
      email: String(directProfileQuery.data.email),
      role: String(directProfileQuery.data.role ?? resolveSessionRole(sessionUser)),
      is_active: true,
      name: resolveSessionName(sessionUser),
      last_sign_in_at: sessionUser.last_sign_in_at ?? null,
      created_at: String(directProfileQuery.data.created_at),
      updated_at: sessionUser.updated_at ?? directProfileQuery.data.created_at,
    }
  }

  // Fallback: resolve role from JWT claims
  const jwtRole = resolveSessionRole(sessionUser)
  const rawRole = String(
    sessionUser.app_metadata?.user_role ??
    sessionUser.app_metadata?.role ??
    jwtRole
  ).trim()
  const finalRole = rawRole || 'admin'

  return {
    id: sessionUser.id,
    tenant_id: String(sessionUser.app_metadata?.tenant_id ?? ''),
    email: sessionUser.email ?? 'Sem e-mail',
    role: finalRole,
    is_active: true,
    name: resolveSessionName(sessionUser),
    last_sign_in_at: sessionUser.last_sign_in_at ?? null,
    created_at: sessionUser.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

let currentUserProfileCache: CurrentUserProfile | null = null
let currentUserProfilePromise: Promise<CurrentUserProfile> | null = null

export function getCachedCurrentUserProfile(): CurrentUserProfile | null {
  return currentUserProfileCache
}

export function clearCurrentUserProfileCache(): void {
  currentUserProfileCache = null
  currentUserProfilePromise = null
}

export async function fetchCurrentUserProfile(options?: { force?: boolean }): Promise<CurrentUserProfile> {
  if (options?.force) {
    clearCurrentUserProfileCache()
  }

  if (currentUserProfileCache) {
    return currentUserProfileCache
  }

  if (!currentUserProfilePromise) {
    currentUserProfilePromise = backendRequest<CurrentUserProfile>('/users/me')
      .then((profile) => {
        currentUserProfileCache = profile
        return profile
      })
      .catch(async () => {
        const profile = await fetchCurrentUserProfileFromSupabase()
        currentUserProfileCache = profile
        return profile
      })
  }

  try {
    return await currentUserProfilePromise
  } finally {
    currentUserProfilePromise = null
  }
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
