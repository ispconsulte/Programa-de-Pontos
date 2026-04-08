import { z } from 'zod'
import { authenticateRequest, assertAdmin } from '../_lib/auth'
import { methodNotAllowed, sendJson, sendNoContent } from '../_lib/http'
import { supabaseAdmin } from '../_lib/supabase'

const catalogRewardSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(400).optional().nullable(),
  requiredPoints: z.coerce.number().int().positive(),
  stock: z.coerce.number().int().min(0).optional().nullable(),
  imageUrl: z.string().trim().optional().nullable(),
  active: z.boolean().optional(),
})

const manualPointsSchema = z.object({
  clientId: z.string().uuid(),
  points: z.coerce.number().int().positive(),
  description: z.string().trim().min(1).max(240),
})

const legacyRedemptionSchema = z.object({
  clientId: z.string().uuid(),
  rewardId: z.string().uuid(),
  responsible: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(400).optional().nullable(),
})

function getPathParts(request: any): string[] {
  return Array.isArray(request.query.path) ? request.query.path : []
}

function getBody(request: any): unknown {
  if (typeof request.body === 'string' && request.body.trim()) {
    return JSON.parse(request.body)
  }
  return request.body ?? {}
}

export default async function handler(request: any, response: any) {
  try {
    const auth = await authenticateRequest(request)
    const path = getPathParts(request)

    if (request.method === 'GET' && path.length === 1 && path[0] === 'legacy-redemptions') {
      const limit = Math.max(1, Math.min(200, Number(request.query.limit ?? 100)))
      const customerId = typeof request.query.customerId === 'string' ? request.query.customerId : undefined

      let query = supabaseAdmin
        .from('pontuacao_resgates')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (customerId) {
        query = query.eq('ixc_cliente_id', customerId)
      }

      const resgates = await query
      if (resgates.error) {
        return sendJson(response, 500, { error: resgates.error.message })
      }

      const rows = resgates.data ?? []
      const customerIds = Array.from(new Set(rows.map((row) => String(row.ixc_cliente_id ?? '')).filter(Boolean)))

      let customerNameMap = new Map<string, string>()
      if (customerIds.length > 0) {
        const customers = await supabaseAdmin
          .from('pontuacao_campanha_clientes')
          .select('ixc_cliente_id, nome_cliente')
          .eq('tenant_id', auth.tenantId)
          .in('ixc_cliente_id', customerIds)

        if (customers.error) {
          return sendJson(response, 500, { error: customers.error.message })
        }

        customerNameMap = new Map(
          (customers.data ?? []).map((row) => [String(row.ixc_cliente_id), String(row.nome_cliente ?? '').trim()]),
        )
      }

      return sendJson(response, 200, {
        data: rows.map((row) => ({
          ...row,
          cliente_nome: customerNameMap.get(String(row.ixc_cliente_id)) || null,
        })),
      })
    }

    if (request.method === 'POST' && path.length === 1 && path[0] === 'legacy-redemptions') {
      const body = legacyRedemptionSchema.parse(getBody(request))

      const [clientResult, rewardResult] = await Promise.all([
        supabaseAdmin
          .from('pontuacao_campanha_clientes')
          .select('id, tenant_id, ixc_cliente_id, nome_cliente, pontos_acumulados, pontos_disponiveis, pontos_resgatados')
          .eq('tenant_id', auth.tenantId)
          .eq('id', body.clientId)
          .single(),
        supabaseAdmin
          .from('pontuacao_catalogo_brindes')
          .select('id, nome, pontos_necessarios, estoque, ativo')
          .eq('id', body.rewardId)
          .single(),
      ])

      if (clientResult.error || !clientResult.data) {
        return sendJson(response, 404, { error: clientResult.error?.message ?? 'Cliente não encontrado' })
      }
      if (rewardResult.error || !rewardResult.data) {
        return sendJson(response, 404, { error: rewardResult.error?.message ?? 'Brinde não encontrado' })
      }

      const reward = rewardResult.data
      const client = clientResult.data
      const availablePoints = Number(client.pontos_disponiveis ?? 0)
      const spentPoints = Number(reward.pontos_necessarios ?? 0)
      const currentStock = reward.estoque == null ? null : Number(reward.estoque)

      if (!reward.ativo) {
        return sendJson(response, 409, { error: 'O brinde está inativo' })
      }
      if (availablePoints < spentPoints) {
        return sendJson(response, 409, { error: 'O cliente não possui pontos suficientes' })
      }
      if (currentStock != null && currentStock <= 0) {
        return sendJson(response, 409, { error: 'O brinde está sem estoque' })
      }

      const deliveredAt = new Date().toISOString()
      const redemptionInsert = await supabaseAdmin
        .from('pontuacao_resgates')
        .insert({
          ixc_cliente_id: client.ixc_cliente_id,
          brinde_id: reward.id,
          brinde_nome: reward.nome,
          pontos_utilizados: spentPoints,
          status_resgate: 'entregue',
          data_entrega: deliveredAt,
          responsavel_entrega: body.responsible,
          observacoes: body.notes?.trim() || null,
          confirmacao_cliente: true,
        })
        .select('*')
        .single()

      if (redemptionInsert.error || !redemptionInsert.data) {
        return sendJson(response, 500, { error: redemptionInsert.error?.message ?? 'Não foi possível registrar o resgate' })
      }

      const clientUpdate = await supabaseAdmin
        .from('pontuacao_campanha_clientes')
        .update({
          pontos_resgatados: Number(client.pontos_resgatados ?? 0) + spentPoints,
          ultimo_resgate: deliveredAt,
          ultima_sincronizacao_em: deliveredAt,
        })
        .eq('tenant_id', auth.tenantId)
        .eq('id', body.clientId)

      if (clientUpdate.error) {
        return sendJson(response, 500, { error: clientUpdate.error.message })
      }

      if (currentStock != null) {
        const rewardUpdate = await supabaseAdmin
          .from('pontuacao_catalogo_brindes')
          .update({
            estoque: Math.max(0, currentStock - 1),
          })
          .eq('id', reward.id)

        if (rewardUpdate.error) {
          return sendJson(response, 500, { error: rewardUpdate.error.message })
        }
      }

      await supabaseAdmin
        .from('pontuacao_historico')
        .insert({
          ixc_cliente_id: client.ixc_cliente_id,
          tipo_evento: 'resgate',
          pontos: -spentPoints,
          descricao: `Resgate do brinde ${reward.nome}`,
          criado_por: body.responsible,
        })

      return sendJson(response, 201, {
        redemption: redemptionInsert.data,
        remainingPoints: Math.max(0, Number(client.pontos_acumulados ?? 0) - (Number(client.pontos_resgatados ?? 0) + spentPoints)),
        remainingStock: currentStock == null ? null : Math.max(0, currentStock - 1),
      })
    }

    if (request.method === 'POST' && path.length === 1 && path[0] === 'manual-points') {
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
    }

    if (request.method === 'POST' && path.length === 1 && path[0] === 'catalog') {
      assertAdmin(auth.userRole)
      const body = catalogRewardSchema.parse(getBody(request))

      const insertResult = await supabaseAdmin
        .from('pontuacao_catalogo_brindes')
        .insert({
          nome: body.name,
          descricao: body.description?.trim() || null,
          pontos_necessarios: body.requiredPoints,
          estoque: body.stock ?? null,
          imagem_url: body.imageUrl?.trim() || null,
          ativo: body.active ?? true,
        })
        .select('*')
        .single()

      if (insertResult.error || !insertResult.data) {
        return sendJson(response, 500, { error: insertResult.error?.message ?? 'Não foi possível criar o brinde' })
      }

      return sendJson(response, 201, insertResult.data)
    }

    if (request.method === 'PATCH' && path.length === 2 && path[0] === 'catalog') {
      assertAdmin(auth.userRole)
      const body = catalogRewardSchema.parse(getBody(request))
      const id = path[1]

      const updateResult = await supabaseAdmin
        .from('pontuacao_catalogo_brindes')
        .update({
          nome: body.name,
          descricao: body.description?.trim() || null,
          pontos_necessarios: body.requiredPoints,
          estoque: body.stock ?? null,
          imagem_url: body.imageUrl?.trim() || null,
          ativo: body.active ?? true,
        })
        .eq('id', id)
        .select('*')
        .single()

      if (updateResult.error || !updateResult.data) {
        return sendJson(response, 500, { error: updateResult.error?.message ?? 'Não foi possível atualizar o brinde' })
      }

      return sendJson(response, 200, updateResult.data)
    }

    if (request.method === 'DELETE' && path.length === 2 && path[0] === 'catalog') {
      assertAdmin(auth.userRole)
      const id = path[1]

      const deleteResult = await supabaseAdmin
        .from('pontuacao_catalogo_brindes')
        .delete()
        .eq('id', id)

      if (deleteResult.error) {
        return sendJson(response, 500, { error: deleteResult.error.message })
      }

      return sendNoContent(response)
    }

    return methodNotAllowed(response)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendJson(response, 400, { error: 'Validation error' })
    }

    const message = error instanceof Error ? error.message : 'Internal Server Error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return sendJson(response, status, { error: message })
  }
}
