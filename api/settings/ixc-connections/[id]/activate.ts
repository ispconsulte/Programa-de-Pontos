import { authenticateRequest, assertFullAdmin } from '../../../_lib/auth'
import { sendException, sendJson, methodNotAllowed, sendNoContent } from '../../../_lib/http'
import { supabaseAdmin } from '../../../_lib/supabase'

export default async function handler(request: any, response: any) {
  try {
    if (request.method !== 'POST') return methodNotAllowed(response)

    const auth = await authenticateRequest(request)
    assertFullAdmin(auth.isFullAdmin)

    const tenantId = String(request.query.tenantId ?? auth.tenantId ?? '')
    if (!tenantId) return sendJson(response, 403, { error: 'Forbidden' })

    const id = String(request.query.id ?? '')
    if (!id) return sendJson(response, 400, { error: 'id é obrigatório' })

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('ixc_connections')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle()

    if (existingError) return sendJson(response, 500, { error: existingError.message })
    if (!existing) return sendJson(response, 404, { error: 'Conexão não encontrada' })

    const { error: clearError } = await supabaseAdmin
      .from('ixc_connections')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('active', true)

    if (clearError) return sendJson(response, 500, { error: clearError.message })

    const { error: activateError } = await supabaseAdmin
      .from('ixc_connections')
      .update({ active: true, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', id)

    if (activateError) return sendJson(response, 500, { error: activateError.message })

    return sendNoContent(response)
  } catch (error) {
    return sendException(response, error)
  }
}
