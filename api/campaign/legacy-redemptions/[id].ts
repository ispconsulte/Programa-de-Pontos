import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { authenticateRequest, assertAdmin } from '../../_lib/auth'
import { methodNotAllowed, sendException, sendJson, sendInternalError, sendNoContent } from '../../_lib/http'
import { supabaseAdmin } from '../../_lib/supabase'

const paramsSchema = z.object({
  id: z.string().uuid(),
})

const updateSchema = z.object({
  status: z.enum(['pendente', 'entregue', 'cancelado']).optional(),
  responsible: z.string().trim().min(1).max(120).optional(),
  notes: z.string().trim().max(400).nullable().optional(),
  reason: z.string().trim().max(240).optional().nullable(),
  expectedUpdatedAt: z.string().datetime().optional().nullable(),
  idempotencyKey: z.string().trim().min(1).max(128).optional(),
})

const deleteSchema = z.object({
  reason: z.string().trim().max(240).optional().nullable(),
  expectedUpdatedAt: z.string().datetime().optional().nullable(),
  idempotencyKey: z.string().trim().min(1).max(128).optional(),
})

function getBody(request: any): unknown {
  if (typeof request.body === 'string' && request.body.trim()) {
    return JSON.parse(request.body)
  }
  return request.body ?? {}
}

async function loadRedemption(tenantId: string, id: string) {
  return supabaseAdmin
    .from('pontuacao_resgates')
    .select('id, tenant_id, ixc_cliente_id, contato_id, brinde_id, brinde_nome, pontos_utilizados, quantity, status_resgate, data_entrega, responsavel_entrega, observacoes, confirmacao_cliente, tipo_destinatario, destinatario_nome, destinatario_telefone, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .eq('id', id)
    .maybeSingle()
}

async function loadCompatibilityRedemption(tenantId: string, id: string) {
  return supabaseAdmin
    .from('pontuacao_resgates')
    .select('id, tenant_id, ixc_cliente_id, brinde_id, brinde_nome, pontos_utilizados, status_resgate, data_entrega, responsavel_entrega, observacoes, confirmacao_cliente, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle()
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

function isLegacyMutationCompatibilityError(message: string | undefined): boolean {
  const normalized = String(message ?? '').toLowerCase()
  return normalized.includes('contato_id')
    || normalized.includes('quantity')
    || normalized.includes('deleted_at')
    || normalized.includes('mutate_legacy_redemption')
}

async function revertCompatibilityDeliveredEffects(tenantId: string, redemption: any) {
  if (String(redemption.ixc_cliente_id ?? '').startsWith('lead:')) {
    return
  }

  if (redemption.ixc_cliente_id) {
    const clientResult = await supabaseAdmin
      .from('pontuacao_campanha_clientes')
      .select('id, pontos_resgatados')
      .eq('tenant_id', tenantId)
      .eq('ixc_cliente_id', redemption.ixc_cliente_id)
      .maybeSingle()

    if (clientResult.data) {
      await supabaseAdmin
        .from('pontuacao_campanha_clientes')
        .update({
          pontos_resgatados: Math.max(0, Number(clientResult.data.pontos_resgatados ?? 0) - Number(redemption.pontos_utilizados ?? 0)),
          ultima_sincronizacao_em: new Date().toISOString(),
        })
        .eq('id', clientResult.data.id)
    }
  }

  if (redemption.brinde_id) {
    const rewardResult = await supabaseAdmin
      .from('pontuacao_catalogo_brindes')
      .select('id, estoque')
      .eq('id', redemption.brinde_id)
      .maybeSingle()

    if (rewardResult.data && rewardResult.data.estoque != null) {
      await supabaseAdmin
        .from('pontuacao_catalogo_brindes')
        .update({ estoque: Number(rewardResult.data.estoque) + 1 })
        .eq('id', rewardResult.data.id)
    }
  }
}

function mapMutationErrorStatus(message: string): number {
  if (message === 'Resgate não encontrado' || message === 'Cliente não encontrado' || message === 'Brinde não encontrado') {
    return 404
  }

  if (message === 'Forbidden') {
    return 403
  }

  if (
    message === 'Transição de status inválida'
    || message === 'O cliente não possui pontos suficientes'
    || message === 'O brinde está sem estoque'
    || message.includes('desatualizado')
  ) {
    return 409
  }

  if (message === 'Motivo é obrigatório' || message === 'Ação de resgate inválida') {
    return 400
  }

  return 500
}

export default async function handler(request: any, response: any) {
  try {
    const auth = await authenticateRequest(request)
    assertAdmin(auth.userRole)
    const { id } = paramsSchema.parse(request.query ?? request.params ?? {})

    if (request.method === 'PATCH' || request.method === 'PUT') {
      const body = updateSchema.parse(getBody(request))
      const current = await loadRedemption(auth.tenantId, id)

      if (current.error || !current.data) {
        return sendJson(response, 404, { error: current.error?.message ?? 'Resgate não encontrado' })
      }

      const currentRow = current.data
      const nextStatus = body.status ?? currentRow.status_resgate
      const action = nextStatus === 'cancelado'
        ? 'cancel'
        : nextStatus === 'entregue' && currentRow.status_resgate !== 'entregue'
          ? 'confirm'
          : 'edit'

      const updateResult = await supabaseAdmin
        .rpc('mutate_legacy_redemption', {
          p_tenant_id: auth.tenantId,
          p_redemption_id: id,
          p_actor_user_id: auth.userId,
          p_action: action,
          p_responsible: body.responsible?.trim() ?? null,
          p_notes: body.notes === undefined ? null : body.notes?.trim() || null,
          p_reason: body.reason?.trim() || (action === 'cancel' ? 'Cancelamento solicitado pela interface administrativa' : 'Atualização administrativa do resgate'),
          p_expected_updated_at: body.expectedUpdatedAt ?? null,
          p_idempotency_key: resolveIdempotencyKey(body.idempotencyKey, `rescue-${action}:${id}`),
        })
        .single()

      if (updateResult.error || !updateResult.data) {
        const message = updateResult.error?.message ?? 'Não foi possível atualizar o resgate'
        if (!isLegacyMutationCompatibilityError(message)) {
          const status = mapMutationErrorStatus(message)
          return status === 500 ? sendInternalError(response) : sendJson(response, status, { error: message })
        }

        if (action === 'cancel' && currentRow.status_resgate === 'entregue') {
          await revertCompatibilityDeliveredEffects(auth.tenantId, currentRow)
        }

        const compatibilityPayload: Record<string, unknown> = {
          responsavel_entrega: body.responsible?.trim() ?? currentRow.responsavel_entrega ?? null,
          observacoes: body.notes === undefined ? currentRow.observacoes ?? null : body.notes?.trim() || null,
        }

        if (action === 'cancel') {
          compatibilityPayload.status_resgate = 'cancelado'
          compatibilityPayload.data_entrega = null
        } else if (action === 'confirm') {
          compatibilityPayload.status_resgate = 'entregue'
          compatibilityPayload.data_entrega = new Date().toISOString().slice(0, 10)
          compatibilityPayload.confirmacao_cliente = true
        } else if (body.status) {
          compatibilityPayload.status_resgate = body.status
        }

        const compatibilityUpdate = await supabaseAdmin
          .from('pontuacao_resgates')
          .update(compatibilityPayload)
          .eq('tenant_id', auth.tenantId)
          .eq('id', id)
          .select('id, tenant_id, ixc_cliente_id, brinde_id, brinde_nome, pontos_utilizados, status_resgate, data_entrega, responsavel_entrega, observacoes, confirmacao_cliente, created_at, updated_at')
          .maybeSingle()

        if (compatibilityUpdate.error || !compatibilityUpdate.data) {
          return sendInternalError(response)
        }

        return sendJson(response, 200, {
          ...compatibilityUpdate.data,
          quantity: 1,
          tipo_destinatario: String(compatibilityUpdate.data.ixc_cliente_id ?? '').startsWith('lead:') ? 'contato' : 'cliente',
          destinatario_nome: null,
          destinatario_telefone: null,
        })
      }

      return sendJson(response, 200, updateResult.data)
    }

    if (request.method === 'DELETE') {
      const body = deleteSchema.parse(getBody(request))
      const deleteResult = await supabaseAdmin
        .rpc('mutate_legacy_redemption', {
          p_tenant_id: auth.tenantId,
          p_redemption_id: id,
          p_actor_user_id: auth.userId,
          p_action: 'delete',
          p_responsible: null,
          p_notes: null,
          p_reason: body.reason?.trim() || 'Exclusão solicitada pela interface administrativa',
          p_expected_updated_at: body.expectedUpdatedAt ?? null,
          p_idempotency_key: resolveIdempotencyKey(body.idempotencyKey, `rescue-delete:${id}`),
        })
        .single()

      if (deleteResult.error) {
        if (!isLegacyMutationCompatibilityError(deleteResult.error.message)) {
          const status = mapMutationErrorStatus(deleteResult.error.message)
          return status === 500 ? sendInternalError(response) : sendJson(response, status, { error: deleteResult.error.message })
        }

        const current = await loadCompatibilityRedemption(auth.tenantId, id)
        if (current.error || !current.data) {
          return sendJson(response, 404, { error: current.error?.message ?? 'Resgate não encontrado' })
        }

        if (String(current.data.status_resgate) === 'entregue') {
          await revertCompatibilityDeliveredEffects(auth.tenantId, current.data)
        }

        const compatibilityDelete = await supabaseAdmin
          .from('pontuacao_resgates')
          .delete()
          .eq('tenant_id', auth.tenantId)
          .eq('id', id)
          .select('id')
          .maybeSingle()

        if (compatibilityDelete.error || !compatibilityDelete.data) {
          return sendInternalError(response)
        }

        return sendNoContent(response)
      }

      return sendNoContent(response)
    }

    return methodNotAllowed(response)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendJson(response, 400, { error: error.issues[0]?.message ?? 'Validation error' })
    }

    return sendException(response, error)
  }
}
