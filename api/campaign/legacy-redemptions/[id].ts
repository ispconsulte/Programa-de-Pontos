import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { authenticateRequest, assertAdmin } from '../../_lib/auth'
import { methodNotAllowed, sendException, sendJson, sendInternalError } from '../../_lib/http'
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
        const status = mapMutationErrorStatus(message)
        return status === 500 ? sendInternalError(response) : sendJson(response, status, { error: message })
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
        const status = mapMutationErrorStatus(deleteResult.error.message)
        return status === 500 ? sendInternalError(response) : sendJson(response, status, { error: deleteResult.error.message })
      }

      return sendJson(response, 204, undefined)
    }

    return methodNotAllowed(response)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendJson(response, 400, { error: error.issues[0]?.message ?? 'Validation error' })
    }

    return sendException(response, error)
  }
}
