import { authenticateRequest, assertFullAdmin } from './_lib/auth'
import { sendException, sendJson, methodNotAllowed, sendInternalError } from './_lib/http'
import { supabaseAdmin } from './_lib/supabase'

export default async function handler(request: any, response: any) {
  try {
    if (request.method !== 'GET') {
      return methodNotAllowed(response)
    }

    const auth = await authenticateRequest(request)
    assertFullAdmin(auth.isFullAdmin)

    // GET ?__tenants=1 → /tenants list endpoint
    if (request.query.__tenants === '1') {
      const tenants = await supabaseAdmin
        .from('tenants')
        .select('id, name')
        .order('name', { ascending: true })

      if (tenants.error) {
        return sendInternalError(response)
      }

      return sendJson(response, 200, { data: tenants.data ?? [] })
    }
    const tenantId = String(request.query.tenantId ?? auth.tenantId ?? '')
    if (!tenantId) {
      return sendJson(response, 403, { error: 'Forbidden' })
    }

    const tenantResult = await supabaseAdmin
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .maybeSingle()

    if (tenantResult.error || !tenantResult.data) {
      return sendJson(response, 404, { error: 'Tenant not found' })
    }

    const activeConnection = await supabaseAdmin
      .from('ixc_connections')
      .select('id, name, ixc_base_url, ixc_user, active')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .limit(1)
      .maybeSingle()

    return sendJson(response, 200, {
      name: tenantResult.data.name,
      ixc_base_url: activeConnection.data?.ixc_base_url ?? null,
      ixc_user: activeConnection.data?.ixc_user ?? null,
      ixc_configured: Boolean(activeConnection.data),
      ixc_connection_id: activeConnection.data?.id ?? null,
      ixc_connection_name: activeConnection.data?.name ?? null,
      ixc_connections_count: activeConnection.data ? 1 : 0,
    })
  } catch (error) {
    return sendException(response, error)
  }
}
