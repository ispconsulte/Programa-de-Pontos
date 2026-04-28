import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { authenticateRequest, assertAdmin } from '../_lib/auth'
import { methodNotAllowed, sendException, sendJson, sendInternalError } from '../_lib/http'
import { supabaseAdmin } from '../_lib/supabase'

const manualPointsSchema = z.object({
  clientId: z.string().uuid(),
  points: z.coerce.number().int().positive(),
  reason: z.string().trim().min(1).max(240),
  adjustmentType: z.enum(['credit', 'debit']),
  idempotencyKey: z.string().trim().min(1).max(128).optional(),
})

function getBody(request: any): unknown {
  if (typeof request.body === 'string' && request.body.trim()) {
    return JSON.parse(request.body)
  }
  return request.body ?? {}
}

function resolveIdempotencyKey(value: string | undefined, scope: string): string {
  const trimmed = value?.trim()
  if (trimmed) {
    return trimmed
  }

  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${scope}:${crypto.randomUUID()}`
  }

  return `${scope}:${randomBytes(16).toString('hex')}`
}

function isManualPointsCompatibilityError(message: string | undefined): boolean {
  const normalized = String(message ?? '').toLowerCase()
  return normalized.includes('apply_manual_points_adjustment')
    || normalized.includes('pontuacao_ajustes_manuais')
}

export default async function handler(request: any, response: any) {
  try {
    if (request.method !== 'POST') {
      return methodNotAllowed(response)
    }

    const auth = await authenticateRequest(request)
    assertAdmin(auth.userRole, auth.isFullAdmin)
    const body = manualPointsSchema.parse(getBody(request))

    const actorResult = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('id', auth.userId)
      .maybeSingle()

    if (actorResult.error || !actorResult.data) {
      return sendJson(response, 404, { error: actorResult.error?.message ?? 'Usuário autenticado não encontrado' })
    }

    const clientResult = await supabaseAdmin
      .from('pontuacao_campanha_clientes')
      .select('id, tenant_id, ixc_cliente_id, nome_cliente, documento, pontos_acumulados, pontos_resgatados, pontos_disponiveis')
      .eq('tenant_id', auth.tenantId)
      .eq('id', body.clientId)
      .single()

    if (clientResult.error || !clientResult.data) {
      return sendJson(response, 404, { error: clientResult.error?.message ?? 'Cliente não encontrado' })
    }

    const currentAccumulated = Number(clientResult.data.pontos_acumulados ?? 0)
    const nextRedeemed = Number(clientResult.data.pontos_resgatados ?? 0)
    const currentAvailable = Number(clientResult.data.pontos_disponiveis ?? Math.max(0, currentAccumulated - nextRedeemed))
    const delta = body.adjustmentType === 'debit' ? -body.points : body.points
    const nextAccumulated = currentAccumulated + delta

    if (nextAccumulated < nextRedeemed || currentAvailable + delta < 0) {
      return sendJson(response, 409, { error: 'O débito manual excede o saldo disponível do cliente' })
    }

    const rpcResult = await supabaseAdmin.rpc('apply_manual_points_adjustment', {
      p_tenant_id: auth.tenantId,
      p_client_id: body.clientId,
      p_actor_user_id: auth.userId,
      p_actor_name: String(actorResult.data.email ?? 'usuario'),
      p_adjustment_type: body.adjustmentType,
      p_points: body.points,
      p_reason: body.reason,
      p_customer_name_snapshot: String(clientResult.data.nome_cliente ?? 'Cliente'),
      p_customer_document_snapshot: clientResult.data.documento ? String(clientResult.data.documento) : null,
      p_idempotency_key: resolveIdempotencyKey(body.idempotencyKey, `manual-points:${body.clientId}`),
    }).single()

    if (rpcResult.error || !rpcResult.data) {
      const message = rpcResult.error?.message ?? 'Não foi possível registrar o ajuste manual'
      if (!isManualPointsCompatibilityError(message)) {
        const status = message === 'Cliente não encontrado' ? 404 : message === 'Forbidden' ? 403 : message.includes('excede o saldo') ? 409 : 500
        return status === 500 ? sendInternalError(response) : sendJson(response, status, { error: message })
      }

      const updateResult = await supabaseAdmin
        .from('pontuacao_campanha_clientes')
        .update({
          pontos_acumulados: nextAccumulated,
          ultima_sincronizacao_em: new Date().toISOString(),
        })
        .eq('tenant_id', auth.tenantId)
        .eq('id', body.clientId)
        .select('id')
        .maybeSingle()

      if (updateResult.error || !updateResult.data) {
        return sendInternalError(response)
      }

      const actorName = String(actorResult.data.email ?? 'usuario')
      const historyInsert = await supabaseAdmin
        .from('pontuacao_historico')
        .insert({
          tenant_id: auth.tenantId,
          ixc_cliente_id: clientResult.data.ixc_cliente_id,
          tipo_evento: 'ajuste_manual',
          pontos: delta,
          descricao: body.reason,
          criado_por: actorName,
        })

      if (historyInsert.error) {
        return sendInternalError(response)
      }

      return sendJson(response, 201, {
        clientId: body.clientId,
        availablePoints: Math.max(0, nextAccumulated - nextRedeemed),
        accumulatedPoints: nextAccumulated,
      })
    }

    return sendJson(response, 201, {
      clientId: body.clientId,
      availablePoints: Number((rpcResult.data as any).new_balance ?? Math.max(0, nextAccumulated - nextRedeemed)),
      accumulatedPoints: Number((rpcResult.data as any).accumulated_points ?? nextAccumulated),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendJson(response, 400, { error: error.issues[0]?.message ?? 'Validation error' })
    }

    return sendException(response, error)
  }
}
