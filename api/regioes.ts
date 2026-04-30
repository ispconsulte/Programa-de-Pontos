import { z } from 'zod'
import { authenticateRequest, assertAdmin } from './_lib/auth'
import { methodNotAllowed, sendException, sendJson, sendInternalError } from './_lib/http'
import { supabaseAdmin } from './_lib/supabase'

const createRegiaoSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  tenantId: z.string().uuid().optional(),
})

export default async function handler(request: any, response: any) {
  try {
    const auth = await authenticateRequest(request)

    if (request.method === 'GET') {
      const tenantId = auth.isFullAdmin && typeof request.query.tenantId === 'string'
        ? request.query.tenantId
        : auth.tenantId

      const result = await supabaseAdmin
        .from('regioes')
        .select('id, nome, created_at')
        .eq('tenant_id', tenantId)
        .order('nome', { ascending: true })

      if (result.error) {
        return sendInternalError(response)
      }

      return sendJson(response, 200, { data: result.data ?? [] })
    }

    if (request.method === 'POST') {
      assertAdmin(auth.userRole, auth.isFullAdmin)

      const body = createRegiaoSchema.parse(
        typeof request.body === 'string' && request.body.trim()
          ? JSON.parse(request.body)
          : request.body ?? {},
      )

      const effectiveTenantId = auth.isFullAdmin && body.tenantId ? body.tenantId : auth.tenantId
      if (!effectiveTenantId) {
        return sendJson(response, 400, { error: 'Tenant não identificado.' })
      }

      const result = await supabaseAdmin
        .from('regioes')
        .insert({ tenant_id: effectiveTenantId, nome: body.nome })
        .select('id, nome, created_at')
        .single()

      if (result.error) {
        if (result.error.code === '23505') {
          return sendJson(response, 409, { error: 'Já existe uma região com esse nome nesta empresa.' })
        }
        return sendInternalError(response)
      }

      return sendJson(response, 201, result.data)
    }

    return methodNotAllowed(response)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendJson(response, 400, { error: error.issues[0]?.message ?? 'Validation error' })
    }
    return sendException(response, error)
  }
}
