import { authenticateRequest, assertAdmin } from '../../_lib/auth'
import { methodNotAllowed, sendException, sendNoContent, sendInternalError } from '../../_lib/http'
import { supabaseAdmin } from '../../_lib/supabase'
import { HttpError, loadTargetUser, requireTargetTenantId } from '../_shared'

export default async function handler(request: any, response: any) {
  try {
    if (request.method !== 'POST') {
      return methodNotAllowed(response)
    }

    const auth = await authenticateRequest(request)
    assertAdmin(auth.userRole, auth.isFullAdmin)

    const id = String(request.query.id ?? '')
    if (!id) {
      throw new HttpError(400, 'Usuário não informado')
    }

    const targetUser = await loadTargetUser(auth, id)
    const targetTenantId = requireTargetTenantId(targetUser)
    if (!auth.isFullAdmin && targetUser.is_full_admin) {
      throw new HttpError(403, 'Forbidden')
    }

    const { error } = await supabaseAdmin
      .from('users')
      .update({
        session_revoked_at: new Date().toISOString(),
      })
      .eq('tenant_id', targetTenantId)
      .eq('id', id)

    if (error) {
      return sendInternalError(response)
    }

    return sendNoContent(response)
  } catch (error) {
    return sendException(response, error)
  }
}
