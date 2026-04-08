import { authenticateRequest, assertAdmin } from '../_lib/auth'
import { methodNotAllowed, sendJson } from '../_lib/http'
import { normalizeDisplayName, supabaseAdmin } from '../_lib/supabase'

export default async function handler(request: any, response: any) {
  try {
    const auth = await authenticateRequest(request)
    const path = Array.isArray(request.query.path) ? request.query.path : []

    if (request.method === 'GET' && path.length === 1 && path[0] === 'me') {
      const authUser = await supabaseAdmin.auth.admin.getUserById(auth.userId)
      const dbUser = await supabaseAdmin
        .from('users')
        .select('id, email, role, is_active, created_at, updated_at')
        .eq('tenant_id', auth.tenantId)
        .eq('id', auth.userId)
        .maybeSingle()

      if (authUser.error || !authUser.data.user || dbUser.error || !dbUser.data) {
        return sendJson(response, 500, { error: 'Falha ao carregar perfil' })
      }

      return sendJson(response, 200, {
        id: dbUser.data.id,
        tenant_id: auth.tenantId,
        email: dbUser.data.email,
        role: dbUser.data.role,
        is_active: dbUser.data.is_active,
        name: normalizeDisplayName(authUser.data.user),
        last_sign_in_at: authUser.data.user.last_sign_in_at ?? null,
        created_at: dbUser.data.created_at,
        updated_at: dbUser.data.updated_at,
      })
    }

    if (request.method === 'GET' && path.length === 0) {
      assertAdmin(auth.userRole)

      const tenantUsers = await supabaseAdmin
        .from('users')
        .select('id, email, role, created_at, is_active, session_revoked_at, updated_at')
        .eq('tenant_id', auth.tenantId)
        .order('created_at', { ascending: true })

      const authUsers = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })

      if (tenantUsers.error || authUsers.error) {
        return sendJson(response, 500, { error: tenantUsers.error?.message ?? authUsers.error?.message ?? 'Falha ao listar usuários' })
      }

      const authUsersById = new Map((authUsers.data.users ?? []).map((user) => [user.id, user]))

      return sendJson(response, 200, {
        data: (tenantUsers.data ?? []).map((user) => {
          const authUser = authUsersById.get(user.id)
          return {
            id: user.id,
            email: user.email,
            role: user.role,
            is_active: user.is_active,
            name: normalizeDisplayName(authUser ?? user),
            created_at: user.created_at,
            updated_at: user.updated_at,
            last_sign_in_at: authUser?.last_sign_in_at ?? null,
            session_revoked_at: user.session_revoked_at,
            is_current_user: user.id === auth.userId,
          }
        }),
      })
    }

    return methodNotAllowed(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return sendJson(response, status, { error: message })
  }
}
