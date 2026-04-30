import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { authenticateRequest, assertAdmin } from '../../_lib/auth'
import { methodNotAllowed, sendException, sendJson, sendInternalError } from '../../_lib/http'
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

function isCatalogCompatibilityError(message: string | undefined): boolean {
  const normalized = String(message ?? '').toLowerCase()
  return normalized.includes('tenant_id')
    || normalized.includes('deleted_at')
    || normalized.includes('catalog_item_secure_upsert')
}

function getCatalogMutationErrorStatus(error: { code?: string; message?: string } | null | undefined): number {
  const message = String(error?.message ?? '')
  if (message === 'Forbidden') return 403
  if (message === 'Idempotency key é obrigatória') return 400
  if (message.includes('inválid')) return 400
  if (error?.code === '23505' || message.toLowerCase().includes('duplicate')) return 409
  if (error?.code === '23514' || message.toLowerCase().includes('check constraint')) return 400
  return 500
}

export default async function handler(request: any, response: any) {
  try {
    const auth = await authenticateRequest(request)

    if (request.method === 'GET') {
      const isAdmin = Boolean(auth.userRole && ['admin', 'owner', 'manager'].includes(auth.userRole.toLowerCase()))

      let userRegiaoId: string | null = null
      if (!isAdmin && !auth.isFullAdmin) {
        const userRow = await supabaseAdmin
          .from('users')
          .select('regiao_id')
          .eq('id', auth.userId)
          .maybeSingle()
        userRegiaoId = (userRow.data as any)?.regiao_id ?? null
      }

      const requestedRegiaoId = (isAdmin || auth.isFullAdmin)
        ? (typeof request.query.regiaoId === 'string' && request.query.regiaoId ? request.query.regiaoId : null)
        : userRegiaoId

      let baseQuery = supabaseAdmin
        .from('pontuacao_catalogo_brindes')
        .select('id, nome, descricao, pontos_necessarios, estoque, imagem_url, ativo, created_at, updated_at')
        .eq('tenant_id', auth.tenantId)
        .is('deleted_at', null)
        .order('ativo', { ascending: false })
        .order('pontos_necessarios', { ascending: true })
        .order('nome', { ascending: true })

      if (requestedRegiaoId) {
        baseQuery = (baseQuery as any).or(`regiao_id.eq.${requestedRegiaoId},regiao_id.is.null`)
      }

      const query = baseQuery

      const listResult = await (isAdmin || auth.isFullAdmin
        ? query
        : query.eq('ativo', true))

      if (listResult.error) {
        if (!isCatalogCompatibilityError(listResult.error.message)) {
          return sendInternalError(response)
        }

        const compatibilityQuery = supabaseAdmin
          .from('pontuacao_catalogo_brindes')
          .select('id, nome, descricao, pontos_necessarios, estoque, imagem_url, ativo, created_at, updated_at')
          .eq('tenant_id', auth.tenantId)
          .order('ativo', { ascending: false })
          .order('pontos_necessarios', { ascending: true })
          .order('nome', { ascending: true })

        const compatibilityResult = await (auth.userRole && ['admin', 'owner', 'manager'].includes(auth.userRole.toLowerCase())
          ? compatibilityQuery
          : compatibilityQuery.eq('ativo', true))

        if (compatibilityResult.error) {
          return sendInternalError(response)
        }

        return sendJson(response, 200, compatibilityResult.data ?? [])
      }

      return sendJson(response, 200, listResult.data ?? [])
    }

    if (request.method !== 'POST') {
      return methodNotAllowed(response)
    }

    assertAdmin(auth.userRole, auth.isFullAdmin)

    const body = catalogRewardSchema.parse(getBody(request))
    const rpcResult = await supabaseAdmin
      .rpc('catalog_item_secure_upsert', {
        p_tenant_id: auth.tenantId,
        p_actor_user_id: auth.userId,
        p_id: null,
        p_name: body.name.trim(),
        p_description: body.description?.trim() || null,
        p_required_points: body.requiredPoints,
        p_stock: body.stock ?? null,
        p_image_url: body.imageUrl?.trim() || null,
        p_active: body.active ?? true,
        p_expected_updated_at: body.expectedUpdatedAt ?? null,
        p_reason: body.reason?.trim() || 'Criação do catálogo administrativo',
        p_idempotency_key: resolveIdempotencyKey(body.idempotencyKey, 'catalog-create'),
      })
      .single()

    if (rpcResult.error || !rpcResult.data) {
      const message = rpcResult.error?.message ?? 'Não foi possível criar o brinde'
      if (!isCatalogCompatibilityError(message)) {
        const status = message === 'Forbidden' ? 403 : message === 'Idempotency key é obrigatória' ? 400 : 500
        return status === 500 ? sendInternalError(response) : sendJson(response, status, { error: message })
      }

      const compatibilityResult = await supabaseAdmin
        .from('pontuacao_catalogo_brindes')
        .insert({
          tenant_id: auth.tenantId,
          nome: body.name.trim(),
          descricao: body.description?.trim() || null,
          pontos_necessarios: body.requiredPoints,
          estoque: body.stock ?? null,
          imagem_url: body.imageUrl?.trim() || null,
          ativo: body.active ?? true,
        })
        .select('id, nome, descricao, pontos_necessarios, estoque, imagem_url, ativo, created_at, updated_at')
        .single()

      if (compatibilityResult.error || !compatibilityResult.data) {
        const status = getCatalogMutationErrorStatus(compatibilityResult.error)
        return status === 500
          ? sendInternalError(response)
          : sendJson(response, status, { error: compatibilityResult.error?.message ?? 'Não foi possível criar o brinde' })
      }

      return sendJson(response, 201, compatibilityResult.data)
    }

    return sendJson(response, 201, rpcResult.data)
  } catch (error) {
    if (error instanceof SyntaxError) {
      return sendJson(response, 400, { error: 'Invalid JSON payload' })
    }

    if (error instanceof z.ZodError) {
      return sendJson(response, 400, { error: 'Validation error' })
    }

    return sendException(response, error)
  }
}
