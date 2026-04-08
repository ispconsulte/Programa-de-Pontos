import { z } from 'zod'
import { authenticateRequest, assertAdmin } from '../_lib/auth'
import { methodNotAllowed, sendJson } from '../_lib/http'
import { supabaseAdmin } from '../_lib/supabase'

const manualPointsSchema = z.object({
  clientId: z.string().uuid(),
  points: z.coerce.number().int().positive(),
  description: z.string().trim().min(1).max(240),
})

function getBody(request: any): unknown {
  if (typeof request.body === 'string' && request.body.trim()) {
    return JSON.parse(request.body)
  }
  return request.body ?? {}
}

export default async function handler(request: any, response: any) {
  try {
    if (request.method !== 'POST') {
      return methodNotAllowed(response)
    }

    const auth = await authenticateRequest(request)
    assertAdmin(auth.userRole)
    const body = manualPointsSchema.parse(getBody(request))

    const clientResult = await supabaseAdmin
      .from('pontuacao_campanha_clientes')
      .select('id, tenant_id, ixc_cliente_id, pontos_acumulados, pontos_resgatados')
      .eq('tenant_id', auth.tenantId)
      .eq('id', body.clientId)
      .single()

    if (clientResult.error || !clientResult.data) {
      return sendJson(response, 404, { error: clientResult.error?.message ?? 'Cliente não encontrado' })
    }

    const nextAccumulated = Number(clientResult.data.pontos_acumulados ?? 0) + body.points
    const nextRedeemed = Number(clientResult.data.pontos_resgatados ?? 0)
    const timestamp = new Date().toISOString()

    const updateResult = await supabaseAdmin
      .from('pontuacao_campanha_clientes')
      .update({
        pontos_acumulados: nextAccumulated,
        ultima_sincronizacao_em: timestamp,
      })
      .eq('tenant_id', auth.tenantId)
      .eq('id', body.clientId)

    if (updateResult.error) {
      return sendJson(response, 500, { error: updateResult.error.message })
    }

    const historyResult = await supabaseAdmin
      .from('pontuacao_historico')
      .insert({
        ixc_cliente_id: clientResult.data.ixc_cliente_id,
        tipo_evento: 'ajuste_manual',
        pontos: body.points,
        descricao: body.description,
        criado_por: auth.userId,
      })

    if (historyResult.error) {
      return sendJson(response, 500, { error: historyResult.error.message })
    }

    return sendJson(response, 201, {
      clientId: body.clientId,
      availablePoints: Math.max(0, nextAccumulated - nextRedeemed),
      accumulatedPoints: nextAccumulated,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendJson(response, 400, { error: 'Validation error' })
    }

    const message = error instanceof Error ? error.message : 'Internal Server Error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return sendJson(response, status, { error: message })
  }
}
