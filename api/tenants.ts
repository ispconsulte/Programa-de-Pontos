import { authenticateRequest } from './_lib/auth'
import { methodNotAllowed, sendException, sendJson, sendInternalError } from './_lib/http'
import { supabaseAdmin } from './_lib/supabase'

export default async function handler(request: any, response: any) {
  try {
    if (request.method !== 'GET') {
      return methodNotAllowed(response)
    }

    const auth = await authenticateRequest(request)
    if (!auth.isFullAdmin) {
      return sendJson(response, 403, { error: 'Forbidden' })
    }

    const tenants = await supabaseAdmin
      .from('tenants')
      .select('id, name')
      .order('name', { ascending: true })

    if (tenants.error) {
      return sendInternalError(response)
    }

    return sendJson(response, 200, { data: tenants.data ?? [] })
  } catch (error) {
    return sendException(response, error)
  }
}
