import { authenticateRequest } from '../_lib/auth'
import { methodNotAllowed, sendException, sendJson } from '../_lib/http'
import { normalizeDisplayName, supabaseAdmin } from '../_lib/supabase'

export default async function handler(request: any, response: any) {
  try {
    if (request.method !== 'GET') {
      return methodNotAllowed(response)
    }

    const auth = await authenticateRequest(request)

    const authUser = await supabaseAdmin.auth.admin.getUserById(auth.userId)

    const dbUserQuery = auth.isFullAdmin
      ? supabaseAdmin
          .from('users')
          .select('id, tenant_id, email, role, is_active, is_full_admin, created_at, updated_at')
          .eq('id', auth.userId)
          .maybeSingle()
      : supabaseAdmin
          .from('users')
          .select('id, tenant_id, email, role, is_active, is_full_admin, created_at, updated_at')
          .eq('tenant_id', auth.tenantId)
          .eq('id', auth.userId)
          .maybeSingle()

    const dbUser = await dbUserQuery

    if (authUser.error || !authUser.data.user) {
      response.status(401).json({ error: 'Unauthorized' })
      return
    }

    if (dbUser.error) {
      return sendJson(response, 503, { error: 'Perfil indisponível no momento' })
    }

    if (!dbUser.data) {
      response.status(401).json({ error: 'Unauthorized' })
      return
    }

    return sendJson(response, 200, {
      id: dbUser.data.id,
      tenant_id: dbUser.data.tenant_id ?? auth.tenantId,
      email: dbUser.data.email,
      role: dbUser.data.role,
      is_active: dbUser.data.is_active,
      is_full_admin: dbUser.data.is_full_admin === true,
      name: normalizeDisplayName(authUser.data.user),
      last_sign_in_at: authUser.data.user.last_sign_in_at ?? null,
      created_at: dbUser.data.created_at,
      updated_at: dbUser.data.updated_at,
    })
  } catch (error) {
    return sendException(response, error)
  }
}
