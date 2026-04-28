import { z } from 'zod'
import { authenticateRequest, assertFullAdmin } from '../_lib/auth'
import { sendException, sendJson, methodNotAllowed } from '../_lib/http'
import { supabaseAdmin } from '../_lib/supabase'
import { encrypt, toByteaHex } from '../_lib/crypto'

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

const createSchema = z.object({
  tenantId: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  ixcBaseUrl: z.string().url(),
  ixcUser: z.string().min(1).max(120),
  ixcToken: z.string().min(1),
  active: z.boolean().optional(),
})

export default async function handler(request: any, response: any) {
  try {
    const auth = await authenticateRequest(request)
    assertFullAdmin(auth.isFullAdmin)

    const tenantId = String(request.query.tenantId ?? request.body?.tenantId ?? auth.tenantId ?? '')
    if (!tenantId) {
      return sendJson(response, 403, { error: 'Forbidden' })
    }

    if (request.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('ixc_connections')
        .select('id, name, ixc_base_url, ixc_user, active, created_at, updated_at')
        .eq('tenant_id', tenantId)
        .order('active', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(100)

      if (error) return sendJson(response, 500, { error: error.message })

      return sendJson(response, 200, { data: data ?? [] })
    }

    if (request.method === 'POST') {
      const body = createSchema.parse(request.body)
      assertSafeUrl(body.ixcBaseUrl)

      if (body.active) {
        const { error: clearError } = await supabaseAdmin
          .from('ixc_connections')
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq('tenant_id', tenantId)
          .eq('active', true)
        if (clearError) return sendJson(response, 500, { error: clearError.message })
      }

      const { enc, iv } = encrypt(body.ixcToken)
      const { data, error: insertError } = await supabaseAdmin
        .from('ixc_connections')
        .insert({
          tenant_id: tenantId,
          name: body.name,
          ixc_base_url: body.ixcBaseUrl,
          ixc_user: body.ixcUser,
          ixc_token_enc: toByteaHex(enc),
          ixc_token_iv: toByteaHex(iv),
          active: body.active ?? false,
        })
        .select('id')
        .single()

      if (insertError || !data) return sendJson(response, 500, { error: insertError?.message ?? 'Falha ao criar conexão' })

      return sendJson(response, 201, { id: data.id })
    }

    return methodNotAllowed(response)
  } catch (error) {
    return sendException(response, error)
  }
}
