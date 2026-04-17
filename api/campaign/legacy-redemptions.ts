import { z } from 'zod'
import { authenticateRequest } from '../_lib/auth'
import { methodNotAllowed, sendJson } from '../_lib/http'
import { supabaseAdmin } from '../_lib/supabase'

interface LegacyRedemptionRpcRow {
  redemption: {
    id: string
    brinde_nome: string
    pontos_utilizados: number
    status_resgate: string
  }
  remaining_points: number | null
  remaining_stock: number | null
}

const legacyRedemptionSchema = z.object({
  isActiveCustomer: z.boolean().optional().default(true),
  clientId: z.string().uuid().optional(),
  leadName: z.string().trim().min(1).max(160).optional(),
  leadPhone: z.string().trim().min(8).max(40).optional(),
  rewardId: z.string().uuid(),
  responsible: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(400).optional().nullable(),
}).superRefine((value, ctx) => {
  if (value.isActiveCustomer) {
    if (!value.clientId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['clientId'],
        message: 'Cliente é obrigatório',
      })
    }
    return
  }

  if (!value.leadName?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['leadName'],
      message: 'Nome é obrigatório para não cliente',
    })
  }
  if (!value.leadPhone?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['leadPhone'],
      message: 'Telefone é obrigatório para não cliente',
    })
  }
})

function getLegacyRedemptionErrorStatus(message: string): number {
  if (message === 'Cliente não encontrado' || message === 'Brinde não encontrado') {
    return 404
  }

  if (
    message === 'O cliente está inativo para resgates'
    || message === 'O cliente não possui pontos suficientes'
    || message === 'O brinde está inativo'
    || message === 'O brinde está sem estoque'
  ) {
    return 409
  }

  return 500
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
      const rpcResult = await supabaseAdmin
        .rpc('register_legacy_redemption', {
          p_tenant_id: auth.tenantId,
          p_client_id: body.isActiveCustomer ? body.clientId ?? null : null,
          p_reward_id: body.rewardId,
          p_responsible: body.responsible.trim(),
          p_notes: body.notes?.trim() || null,
          p_is_active_customer: body.isActiveCustomer ?? true,
          p_lead_name: body.isActiveCustomer ? null : body.leadName?.trim() || null,
          p_lead_phone: body.isActiveCustomer ? null : body.leadPhone?.trim() || null,
        })
        .single()

      if (rpcResult.error || !rpcResult.data) {
        const message = rpcResult.error?.message ?? 'Não foi possível registrar o resgate'
        return sendJson(response, getLegacyRedemptionErrorStatus(message), { error: message })
      }

      const redemptionResult = rpcResult.data as LegacyRedemptionRpcRow

      return sendJson(response, 201, {
        redemption: redemptionResult.redemption,
        remainingPoints: redemptionResult.remaining_points == null ? null : Number(redemptionResult.remaining_points),
        remainingStock: redemptionResult.remaining_stock == null ? null : Number(redemptionResult.remaining_stock),
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
