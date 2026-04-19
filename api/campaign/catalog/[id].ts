import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { authenticateRequest, assertAdmin } from '../../_lib/auth'
import { methodNotAllowed, sendException, sendJson, sendNoContent, sendInternalError } from '../../_lib/http'
import { supabaseAdmin } from '../../_lib/supabase'

const catalogRewardSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(400).optional().nullable(),
  requiredPoints: z.coerce.number().int().positive(),
  stock: z.coerce.number().int().min(0).optional().nullable(),
  imageUrl: z.string().trim().optional().nullable(),
  active: z.boolean().optional(),
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

export default async function handler(request: any, response: any) {
  try {
    const auth = await authenticateRequest(request)
    assertAdmin(auth.userRole)
    const id = String(request.query.id ?? '')

    if (!id) {
      return sendJson(response, 400, { error: 'Brinde inválido' })
    }

    if (request.method === 'PATCH' || request.method === 'PUT') {
      const body = catalogRewardSchema.parse(getBody(request))

      const updateResult = await supabaseAdmin
        .rpc('catalog_item_secure_upsert', {
          p_tenant_id: auth.tenantId,
          p_actor_user_id: auth.userId,
          p_id: id,
          p_name: body.name.trim(),
          p_description: body.description?.trim() || null,
          p_required_points: body.requiredPoints,
          p_stock: body.stock ?? null,
          p_image_url: body.imageUrl?.trim() || null,
          p_active: body.active ?? true,
          p_expected_updated_at: body.expectedUpdatedAt ?? null,
          p_reason: body.reason?.trim() || 'Atualização do catálogo administrativo',
          p_idempotency_key: resolveIdempotencyKey(body.idempotencyKey, `catalog-update:${id}`),
        })
        .single()

      if (updateResult.error || !updateResult.data) {
        const message = updateResult.error?.message ?? 'Não foi possível atualizar o brinde'
        const status = message === 'Brinde não encontrado' ? 404 : message === 'Forbidden' ? 403 : message.includes('desatualizado') ? 409 : 500
        return status === 500 ? sendInternalError(response) : sendJson(response, status, { error: message })
      }

      return sendJson(response, 200, updateResult.data)
    }

    if (request.method === 'DELETE') {
      const body = deleteSchema.parse(getBody(request))
      const deleteResult = await supabaseAdmin
        .rpc('catalog_item_secure_soft_delete', {
          p_tenant_id: auth.tenantId,
          p_actor_user_id: auth.userId,
          p_id: id,
          p_expected_updated_at: body.expectedUpdatedAt ?? null,
          p_reason: body.reason?.trim() || 'Exclusão solicitada pela interface administrativa',
          p_idempotency_key: resolveIdempotencyKey(body.idempotencyKey, `catalog-delete:${id}`),
        })
        .single()

      if (deleteResult.error) {
        const message = deleteResult.error.message
        const status = message === 'Brinde não encontrado' ? 404 : message === 'Forbidden' ? 403 : message.includes('desatualizado') ? 409 : 500
        return status === 500 ? sendInternalError(response) : sendJson(response, status, { error: message })
      }

      return sendNoContent(response)
    }

    return methodNotAllowed(response)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendJson(response, 400, { error: 'Validation error' })
    }

    return sendException(response, error)
  }
}
