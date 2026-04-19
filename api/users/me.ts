import { authenticateRequest } from '../_lib/auth'
import { methodNotAllowed, sendException, sendJson, sendInternalError } from '../_lib/http'
import { normalizeDisplayName, supabaseAdmin } from '../_lib/supabase'

export default async function handler(request: any, response: any) {
  try {
    if (request.method !== 'GET') {
      return methodNotAllowed(response)
    }

    const auth = await authenticateRequest(request)

    const authUser = await supabaseAdmin.auth.admin.getUserById(auth.userId)
    const dbUser = await supabaseAdmin
      .from('users')
      .select('id, email, role, is_active, created_at, updated_at')
      .eq('tenant_id', auth.tenantId)
      .eq('id', auth.userId)
      .maybeSingle()

    if (authUser.error || !authUser.data.user || dbUser.error || !dbUser.data) {
      return sendInternalError(response)
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
  } catch (error) {
    return sendException(response, error)
  }
}
