import { isAdminRole, supabaseAdmin } from './supabase'

export interface AuthContext {
  userId: string
  tenantId: string
  userRole: string
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
    .select('id, tenant_id, role, is_active')
    .eq('id', authUser.data.user.id)
    .maybeSingle()

  if (dbUser.error || !dbUser.data) {
    throw new Error('Unauthorized')
  }

  if (dbUser.data.is_active === false) {
    throw new Error('Forbidden')
  }

  return {
    userId: dbUser.data.id,
    tenantId: dbUser.data.tenant_id,
    userRole: dbUser.data.role,
  }
}

export function assertAdmin(userRole: string): void {
  if (!isAdminRole(userRole)) {
    throw new Error('Forbidden')
  }
}
