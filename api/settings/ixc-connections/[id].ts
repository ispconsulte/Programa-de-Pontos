import { z } from 'zod'
import { authenticateRequest, assertFullAdmin } from '../../_lib/auth'
import { sendException, sendJson, methodNotAllowed, sendNoContent } from '../../_lib/http'
import { supabaseAdmin } from '../../_lib/supabase'
import { encrypt, toByteaHex } from '../../_lib/crypto'

const SSRF_BLOCK = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|0\.0\.0\.0)/i

function assertSafeUrl(raw: string): void {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error('URL inválida')
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('URL inválida')
  if (SSRF_BLOCK.test(parsed.hostname)) throw new Error('URL não permitida')
}

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  ixcBaseUrl: z.string().url().optional(),
  ixcUser: z.string().min(1).max(120).optional(),
  ixcToken: z.string().optional(),
  active: z.boolean().optional(),
})

export default async function handler(request: any, response: any) {
  try {
    const auth = await authenticateRequest(request)
    assertFullAdmin(auth.isFullAdmin)

    const tenantId = String(request.query.tenantId ?? auth.tenantId ?? '')
    if (!tenantId) {
      return sendJson(response, 403, { error: 'Forbidden' })
    }

    const id = String(request.query.id ?? '')
    if (!id) return sendJson(response, 400, { error: 'id é obrigatório' })

    // POST → activate connection
    if (request.method === 'POST') {
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
    }

    if (request.method === 'PUT' || request.method === 'PATCH') {
      const body = updateSchema.parse(request.body)

      if (body.ixcBaseUrl) assertSafeUrl(body.ixcBaseUrl)

      if (body.active === true) {
        const { error: clearError } = await supabaseAdmin
          .from('ixc_connections')
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq('tenant_id', tenantId)
          .eq('active', true)
        if (clearError) return sendJson(response, 500, { error: clearError.message })
      }

      const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (body.name !== undefined) update.name = body.name
      if (body.ixcBaseUrl !== undefined) update.ixc_base_url = body.ixcBaseUrl
      if (body.ixcUser !== undefined) update.ixc_user = body.ixcUser
      if (body.active !== undefined) update.active = body.active
      if (body.ixcToken) {
        const { enc, iv } = encrypt(body.ixcToken)
        update.ixc_token_enc = toByteaHex(enc)
        update.ixc_token_iv = toByteaHex(iv)
      }

      const { error: updateError } = await supabaseAdmin
        .from('ixc_connections')
        .update(update)
        .eq('tenant_id', tenantId)
        .eq('id', id)

      if (updateError) return sendJson(response, 500, { error: updateError.message })

      return sendNoContent(response)
    }

    return methodNotAllowed(response)
  } catch (error) {
    return sendException(response, error)
  }
}
