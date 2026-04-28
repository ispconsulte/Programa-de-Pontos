import { isAdminRole, supabaseAdmin } from './supabase'

export interface AuthContext {
  userId: string
  tenantId: string
  userRole: string
  isFullAdmin: boolean
}

export async function authenticateRequest(request: any): Promise<AuthContext> {
  const auth = String(request.headers.authorization ?? '')
  if (!auth.startsWith('Bearer ')) {
    throw new Error('Unauthorized')
  }

  const token = auth.slice('Bearer '.length).trim()
  if (!token) {
    throw new Error('Unauthorized')
  }

  const authUser = await supabaseAdmin.auth.getUser(token)
  if (authUser.error || !authUser.data.user?.id) {
    throw new Error('Unauthorized')
  }

  const dbUser = await supabaseAdmin
    .from('users')
    .select('id, tenant_id, role, is_active, session_revoked_at, is_full_admin')
    .eq('id', authUser.data.user.id)
    .maybeSingle()

  if (dbUser.error || !dbUser.data) {
    throw new Error('Unauthorized')
  }

  if (dbUser.data.is_active === false) {
    throw new Error('Forbidden')
  }

  const tokenIssuedAt = decodeJwtIssuedAt(token)
  if (dbUser.data.session_revoked_at && tokenIssuedAt) {
    const revokedAtMs = Date.parse(dbUser.data.session_revoked_at)
    if (!Number.isNaN(revokedAtMs) && revokedAtMs >= tokenIssuedAt * 1000) {
      throw new Error('Unauthorized')
    }
  }

  return {
    userId: dbUser.data.id,
    tenantId: dbUser.data.tenant_id,
    userRole: dbUser.data.role,
    isFullAdmin: dbUser.data.is_full_admin === true,
  }
}

function decodeJwtIssuedAt(token: string): number | null {
  try {
    const [, payload] = token.split('.')
    if (!payload) return null

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const parsed = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as { iat?: number }
    return typeof parsed.iat === 'number' ? parsed.iat : null
  } catch {
    return null
  }
}

export function assertAdmin(userRole: string, isFullAdmin = false): void {
  if (!isFullAdmin && !isAdminRole(userRole)) {
    throw new Error('Forbidden')
  }
}

export function assertFullAdmin(isFullAdmin = false): void {
  if (!isFullAdmin) {
    throw new Error('Forbidden')
  }
}
