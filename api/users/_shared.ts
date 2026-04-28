import { z } from 'zod'
import { isAdminRole, supabaseAdmin } from '../_lib/supabase'

export const managedRoleSchema = z.enum(['admin', 'operator', 'full_admin'])

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().trim().min(1).max(120).optional(),
  role: managedRoleSchema.default('operator'),
  tenantId: z.string().uuid().optional(),
  tenant_id: z.string().uuid().optional(),
})

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: managedRoleSchema.optional(),
  password: z.string().min(8).optional(),
  isActive: z.boolean().optional(),
  tenantId: z.string().uuid().optional(),
  tenant_id: z.string().uuid().optional(),
})

export interface TenantUserRow {
  id: string
  tenant_id: string | null
  email: string
  role: string
  created_at: string
  is_active: boolean
  is_full_admin: boolean
  session_revoked_at: string | null
  updated_at: string
  tenant_name?: string | null
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export function toStoredRole(role: z.infer<typeof managedRoleSchema>): 'admin' | 'operator' {
  return role === 'full_admin' ? 'admin' : role
}

export function toFullAdminFlag(role: z.infer<typeof managedRoleSchema>): boolean {
  return role === 'full_admin'
}

export function isDuplicateUserError(error: { code?: string; message?: string } | null | undefined): boolean {
  const message = String(error?.message ?? '').toLowerCase()
  return error?.code === '23505'
    || message.includes('duplicate')
    || message.includes('already registered')
    || message.includes('already exists')
    || message.includes('já existe')
}

export function requireTargetTenantId(targetUser: TenantUserRow): string {
  if (!targetUser.tenant_id) {
    throw new HttpError(400, 'Usuário alvo sem tenant associado')
  }

  return targetUser.tenant_id
}

export async function loadUserById(userId: string): Promise<TenantUserRow> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email, role, created_at, is_active, is_full_admin, session_revoked_at, updated_at, tenant_id')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw new HttpError(500, error.message)
  }
  if (!data) {
    throw new HttpError(404, 'Usuário não encontrado')
  }

  return data as TenantUserRow
}

export async function loadTenantUserById(tenantId: string, userId: string): Promise<TenantUserRow> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email, role, created_at, is_active, is_full_admin, session_revoked_at, updated_at, tenant_id')
    .eq('tenant_id', tenantId)
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw new HttpError(500, error.message)
  }
  if (!data) {
    throw new HttpError(404, 'Usuário não encontrado')
  }

  return data as TenantUserRow
}

export async function loadTargetUser(auth: { isFullAdmin: boolean; tenantId: string }, userId: string): Promise<TenantUserRow> {
  return auth.isFullAdmin
    ? loadUserById(userId)
    : loadTenantUserById(auth.tenantId, userId)
}

export async function ensureAnotherAdminRemains(tenantId: string, excludedUserId: string): Promise<void> {
  const { count, error } = await supabaseAdmin
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .in('role', ['admin', 'owner', 'manager'])
    .neq('id', excludedUserId)

  if (error) {
    throw new HttpError(500, error.message)
  }
  if (!count || count < 1) {
    throw new HttpError(400, 'O tenant precisa manter ao menos um usuário administrador ativo')
  }
}

export function shouldKeepAnotherAdmin(targetUser: TenantUserRow, nextRole: string, nextIsActive: boolean): boolean {
  const targetIsAdmin = isAdminRole(targetUser.role)
  const nextIsAdmin = isAdminRole(nextRole)
  return targetIsAdmin && (!nextIsAdmin || !nextIsActive)
}
