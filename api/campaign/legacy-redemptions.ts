import { z } from 'zod'
import { authenticateRequest } from '../_lib/auth'
import { methodNotAllowed, sendJson } from '../_lib/http'
import { supabaseAdmin } from '../_lib/supabase'

const legacyRedemptionSchema = z.object({
  clientId: z.string().uuid(),
  rewardId: z.string().uuid(),
  responsible: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(400).optional().nullable(),
})

function getBody(request: any): unknown {
  if (typeof request.body === 'string' && request.body.trim()) {
    return JSON.parse(request.body)
  }
  return request.body ?? {}
}

export default async function handler(request: any, response: any) {
  try {
    const auth = await authenticateRequest(request)

    if (request.method === 'GET') {
      const limit = Math.max(1, Math.min(200, Number(request.query.limit ?? 100)))
      const customerId = typeof request.query.customerId === 'string' ? request.query.customerId : undefined
      const dateFrom = typeof request.query.dateFrom === 'string' && request.query.dateFrom.trim()
        ? `${request.query.dateFrom.trim()}T00:00:00.000Z`
        : undefined
      const dateTo = typeof request.query.dateTo === 'string' && request.query.dateTo.trim()
        ? `${request.query.dateTo.trim()}T23:59:59.999Z`
        : undefined

      let tenantCustomersQuery = supabaseAdmin
        .from('pontuacao_campanha_clientes')
        .select('ixc_cliente_id, nome_cliente')
        .eq('tenant_id', auth.tenantId)
        .limit(10000)

      if (customerId) {
        tenantCustomersQuery = tenantCustomersQuery.eq('ixc_cliente_id', customerId)
      }

      const tenantCustomers = await tenantCustomersQuery

      if (tenantCustomers.error) {
        return sendJson(response, 500, { error: tenantCustomers.error.message })
      }

      const customerRows = tenantCustomers.data ?? []
      const customerIds = Array.from(new Set(customerRows.map((row) => String(row.ixc_cliente_id ?? '')).filter(Boolean)))

      if (customerIds.length === 0) {
        return sendJson(response, 200, { data: [], meta: { total: 0 } })
      }

      let query = supabaseAdmin
        .from('pontuacao_resgates')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .in('ixc_cliente_id', customerIds)
        .limit(limit)

      if (dateFrom) {
        query = query.gte('created_at', dateFrom)
      }

      if (dateTo) {
        query = query.lte('created_at', dateTo)
      }

      const resgates = await query
      if (resgates.error) {
        return sendJson(response, 500, { error: resgates.error.message })
      }

      const rows = resgates.data ?? []
      const customerNameMap = new Map(
        customerRows.map((row) => [String(row.ixc_cliente_id), String(row.nome_cliente ?? '').trim()]),
      )

      return sendJson(response, 200, {
        data: rows.map((row) => ({
          ...row,
          cliente_nome: customerNameMap.get(String(row.ixc_cliente_id)) || null,
        })),
        meta: {
          total: Number(resgates.count ?? rows.length),
        },
      })
    }

    if (request.method === 'POST') {
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
      const remainingAvailablePoints = Math.max(0, availablePoints - spentPoints)
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
          pontos_disponiveis: remainingAvailablePoints,
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
        remainingPoints: remainingAvailablePoints,
        remainingStock: currentStock == null ? null : Math.max(0, currentStock - 1),
      })
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
