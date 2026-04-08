import { authenticateRequest, assertAdmin } from './_lib/auth'
import { sendJson, methodNotAllowed } from './_lib/http'
import { supabaseAdmin } from './_lib/supabase'

export default async function handler(request: any, response: any) {
  try {
    if (request.method !== 'GET') {
      return methodNotAllowed(response)
    }

    const auth = await authenticateRequest(request)
    assertAdmin(auth.userRole)

    const tenantResult = await supabaseAdmin
      .from('tenants')
      .select('name')
      .eq('id', auth.tenantId)
      .maybeSingle()

    if (tenantResult.error || !tenantResult.data) {
      return sendJson(response, 404, { error: 'Tenant not found' })
    }

    const activeConnection = await supabaseAdmin
      .from('ixc_connections')
      .select('id, name, ixc_base_url, ixc_user, active')
      .eq('tenant_id', auth.tenantId)
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
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return sendJson(response, status, { error: message })
  }
}
