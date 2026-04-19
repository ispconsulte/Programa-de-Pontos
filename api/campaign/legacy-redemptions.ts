import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { authenticateRequest } from '../_lib/auth'
import { methodNotAllowed, sendException, sendJson, sendInternalError } from '../_lib/http'
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
  quantity: z.coerce.number().int().positive().max(100).optional().default(1),
  responsible: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(400).optional().nullable(),
  idempotencyKey: z.string().trim().min(1).max(128).optional(),
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

  if (message === 'Forbidden') {
    return 403
  }

  if (
    message === 'O cliente está inativo para resgates'
    || message === 'O cliente não possui pontos suficientes'
    || message === 'O brinde está inativo'
    || message === 'O brinde está sem estoque'
    || message.includes('desatualizado')
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

function isLegacyCompatibilityError(message: string | undefined): boolean {
  const normalized = String(message ?? '').toLowerCase()
  return normalized.includes('contato_id')
    || normalized.includes('quantity')
    || normalized.includes('deleted_at')
    || normalized.includes('tipo_destinatario')
    || normalized.includes('destinatario_nome')
    || normalized.includes('destinatario_telefone')
    || normalized.includes('register_legacy_redemption')
}

function normalizeLeadPhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(0, 20)
}

function buildCompatibilityLeadCustomerId(phone: string): string {
  return `lead:${normalizeLeadPhone(phone)}`
}

async function ensureCompatibilityLeadCustomer(tenantId: string, leadName: string, leadPhone: string) {
  const syntheticCustomerId = buildCompatibilityLeadCustomerId(leadPhone)
  const existing = await supabaseAdmin
    .from('pontuacao_campanha_clientes')
    .select('id, ixc_cliente_id, nome_cliente, telefone')
    .eq('tenant_id', tenantId)
    .eq('ixc_cliente_id', syntheticCustomerId)
    .maybeSingle()

  if (existing.data) {
    const needsUpdate = existing.data.nome_cliente !== leadName || existing.data.telefone !== leadPhone
    if (needsUpdate) {
      await supabaseAdmin
        .from('pontuacao_campanha_clientes')
        .update({
          nome_cliente: leadName,
          telefone: leadPhone,
          metadata: { compat_non_customer: true, compat_lead_phone: leadPhone },
        })
        .eq('id', existing.data.id)
    }

    return { rowId: existing.data.id, syntheticCustomerId }
  }

  const inserted = await supabaseAdmin
    .from('pontuacao_campanha_clientes')
    .insert({
      tenant_id: tenantId,
      ixc_cliente_id: syntheticCustomerId,
      nome_cliente: leadName,
      telefone: leadPhone,
      status_campanha: 'ativo',
      pontos_acumulados: 0,
      pontos_resgatados: 0,
      metadata: { compat_non_customer: true, compat_lead_phone: leadPhone },
    })
    .select('id')
    .single()

  if (inserted.error || !inserted.data) {
    throw new Error(inserted.error?.message ?? 'Não foi possível preparar o cadastro do contato')
  }

  return { rowId: inserted.data.id, syntheticCustomerId }
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

      let query = supabaseAdmin
        .from('pontuacao_resgates')
        .select('id, tenant_id, ixc_cliente_id, contato_id, brinde_id, brinde_nome, pontos_utilizados, quantity, status_resgate, data_entrega, responsavel_entrega, observacoes, confirmacao_cliente, tipo_destinatario, destinatario_nome, destinatario_telefone, created_at, updated_at', { count: 'exact' })
        .eq('tenant_id', auth.tenantId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (customerId) {
        query = query.eq('ixc_cliente_id', customerId)
      }

      if (dateFrom) {
        query = query.gte('created_at', dateFrom)
      }

      if (dateTo) {
        query = query.lte('created_at', dateTo)
      }

      const resgates = await query
      if (resgates.error) {
        if (!isLegacyCompatibilityError(resgates.error.message)) {
          return sendInternalError(response)
        }

        let compatibilityQuery = supabaseAdmin
          .from('pontuacao_resgates')
          .select('id, tenant_id, ixc_cliente_id, brinde_id, brinde_nome, pontos_utilizados, status_resgate, data_entrega, responsavel_entrega, observacoes, confirmacao_cliente, created_at, updated_at', { count: 'exact' })
          .eq('tenant_id', auth.tenantId)
          .order('created_at', { ascending: false })
          .limit(limit)

        if (customerId) {
          compatibilityQuery = compatibilityQuery.eq('ixc_cliente_id', customerId)
        }

        if (dateFrom) {
          compatibilityQuery = compatibilityQuery.gte('created_at', dateFrom)
        }

        if (dateTo) {
          compatibilityQuery = compatibilityQuery.lte('created_at', dateTo)
        }

        const compatibilityResgates = await compatibilityQuery
        if (compatibilityResgates.error) {
          return sendInternalError(response)
        }

        const compatibilityRows = compatibilityResgates.data ?? []
        const compatibilityCustomerIds = Array.from(new Set(compatibilityRows.map((row) => String(row.ixc_cliente_id ?? '')).filter(Boolean)))
        let compatibilityNameMap = new Map<string, string>()

        if (compatibilityCustomerIds.length > 0) {
          const tenantCustomers = await supabaseAdmin
            .from('pontuacao_campanha_clientes')
            .select('ixc_cliente_id, nome_cliente')
            .eq('tenant_id', auth.tenantId)
            .in('ixc_cliente_id', compatibilityCustomerIds)

          if (tenantCustomers.error) {
            return sendInternalError(response)
          }

          compatibilityNameMap = new Map(
            (tenantCustomers.data ?? []).map((row) => [String(row.ixc_cliente_id), String(row.nome_cliente ?? '').trim()]),
          )
        }

        return sendJson(response, 200, {
          data: compatibilityRows.map((row) => {
            const customerKey = String(row.ixc_cliente_id ?? '')
            const customerName = compatibilityNameMap.get(customerKey) || null
            return {
              ...row,
              quantity: 1,
              tipo_destinatario: customerKey.startsWith('lead:') ? 'contato' : 'cliente',
              destinatario_nome: customerName,
              destinatario_telefone: null,
              cliente_nome: customerName,
            }
          }),
          meta: {
            total: Number(compatibilityResgates.count ?? compatibilityRows.length),
          },
        })
      }

      const rows = resgates.data ?? []
      const customerIds = Array.from(new Set(rows.map((row) => String(row.ixc_cliente_id ?? '')).filter(Boolean)))
      let customerNameMap = new Map<string, string>()

      if (customerIds.length > 0) {
        const tenantCustomers = await supabaseAdmin
          .from('pontuacao_campanha_clientes')
          .select('ixc_cliente_id, nome_cliente')
          .eq('tenant_id', auth.tenantId)
          .in('ixc_cliente_id', customerIds)

        if (tenantCustomers.error) {
          return sendInternalError(response)
        }

        customerNameMap = new Map(
          (tenantCustomers.data ?? []).map((row) => [String(row.ixc_cliente_id), String(row.nome_cliente ?? '').trim()]),
        )
      }

      return sendJson(response, 200, {
        data: rows.map((row) => ({
          ...row,
          cliente_nome:
            String((row as Record<string, unknown>).destinatario_nome ?? '').trim()
            || customerNameMap.get(String(row.ixc_cliente_id))
            || null,
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
          p_actor_user_id: auth.userId,
          p_quantity: body.quantity,
          p_idempotency_key: resolveIdempotencyKey(body.idempotencyKey, `rescue-create:${body.rewardId}`),
        })
        .single()

      if (rpcResult.error || !rpcResult.data) {
        const message = rpcResult.error?.message ?? 'Não foi possível registrar o resgate'
        if (!isLegacyCompatibilityError(message)) {
          const status = getLegacyRedemptionErrorStatus(message)
          return status === 500 ? sendInternalError(response) : sendJson(response, status, { error: message })
        }

        const actorResult = await supabaseAdmin
          .from('users')
          .select('id, email')
          .eq('id', auth.userId)
          .maybeSingle()

        if (actorResult.error || !actorResult.data) {
          return sendInternalError(response)
        }

        const rewardResult = await supabaseAdmin
          .from('pontuacao_catalogo_brindes')
          .select('id, nome, pontos_necessarios, ativo, estoque')
          .eq('id', body.rewardId)
          .maybeSingle()

        if (rewardResult.error || !rewardResult.data) {
          return sendJson(response, 404, { error: 'Brinde não encontrado' })
        }

        if (!rewardResult.data.ativo) {
          return sendJson(response, 409, { error: 'O brinde está inativo' })
        }

        if (body.quantity !== 1) {
          return sendJson(response, 409, { error: 'O schema atual aceita apenas quantidade 1 para resgates' })
        }

        if (rewardResult.data.estoque != null && Number(rewardResult.data.estoque) < body.quantity) {
          return sendJson(response, 409, { error: 'O brinde está sem estoque' })
        }

        let redemptionCustomerIxcId: string
        let remainingPoints: number | null = null

        if (body.isActiveCustomer) {
          const clientResult = await supabaseAdmin
            .from('pontuacao_campanha_clientes')
            .select('id, tenant_id, ixc_cliente_id, nome_cliente, pontos_acumulados, pontos_resgatados, pontos_disponiveis, status_campanha')
            .eq('tenant_id', auth.tenantId)
            .eq('id', body.clientId ?? '')
            .maybeSingle()

          if (clientResult.error || !clientResult.data) {
            return sendJson(response, 404, { error: 'Cliente não encontrado' })
          }

          if (String(clientResult.data.status_campanha ?? 'ativo').toLowerCase() !== 'ativo') {
            return sendJson(response, 409, { error: 'O cliente está inativo para resgates' })
          }

          const currentAvailable = Number(clientResult.data.pontos_disponiveis ?? (Number(clientResult.data.pontos_acumulados ?? 0) - Number(clientResult.data.pontos_resgatados ?? 0)))
          if (currentAvailable < Number(rewardResult.data.pontos_necessarios ?? 0)) {
            return sendJson(response, 409, { error: 'O cliente não possui pontos suficientes' })
          }

          const updatedClient = await supabaseAdmin
            .from('pontuacao_campanha_clientes')
            .update({
              pontos_resgatados: Number(clientResult.data.pontos_resgatados ?? 0) + Number(rewardResult.data.pontos_necessarios ?? 0),
              ultima_sincronizacao_em: new Date().toISOString(),
              ultimo_resgate: new Date().toISOString(),
            })
            .eq('id', clientResult.data.id)
            .select('ixc_cliente_id, pontos_disponiveis, pontos_acumulados, pontos_resgatados')
            .single()

          if (updatedClient.error || !updatedClient.data) {
            return sendInternalError(response)
          }

          redemptionCustomerIxcId = String(updatedClient.data.ixc_cliente_id)
          remainingPoints = Number(updatedClient.data.pontos_disponiveis ?? (Number(updatedClient.data.pontos_acumulados ?? 0) - Number(updatedClient.data.pontos_resgatados ?? 0)))

          await supabaseAdmin
            .from('pontuacao_historico')
            .insert({
              tenant_id: auth.tenantId,
              ixc_cliente_id: redemptionCustomerIxcId,
              tipo_evento: 'resgate',
              pontos: -Number(rewardResult.data.pontos_necessarios ?? 0),
              descricao: `Resgate do brinde ${rewardResult.data.nome}`,
              criado_por: String(actorResult.data.email ?? 'usuario'),
            })
        } else {
          const compatibilityLead = await ensureCompatibilityLeadCustomer(
            auth.tenantId,
            body.leadName?.trim() || 'Contato',
            body.leadPhone?.trim() || '',
          )
          redemptionCustomerIxcId = compatibilityLead.syntheticCustomerId
        }

        let remainingStock = rewardResult.data.estoque == null ? null : Math.max(0, Number(rewardResult.data.estoque) - body.quantity)
        if (rewardResult.data.estoque != null) {
          const stockUpdate = await supabaseAdmin
            .from('pontuacao_catalogo_brindes')
            .update({ estoque: remainingStock })
            .eq('id', rewardResult.data.id)

          if (stockUpdate.error) {
            return sendInternalError(response)
          }
        }

        const deliveredDate = new Date().toISOString().slice(0, 10)
        const insertedRedemption = await supabaseAdmin
          .from('pontuacao_resgates')
          .insert({
            tenant_id: auth.tenantId,
            ixc_cliente_id: redemptionCustomerIxcId,
            brinde_id: rewardResult.data.id,
            brinde_nome: rewardResult.data.nome,
            pontos_utilizados: Number(rewardResult.data.pontos_necessarios ?? 0),
            status_resgate: 'entregue',
            data_entrega: deliveredDate,
            responsavel_entrega: body.responsible.trim(),
            observacoes: body.notes?.trim() || null,
            confirmacao_cliente: true,
          })
          .select('id, brinde_nome, pontos_utilizados, status_resgate')
          .single()

        if (insertedRedemption.error || !insertedRedemption.data) {
          return sendInternalError(response)
        }

        return sendJson(response, 201, {
          redemption: insertedRedemption.data,
          remainingPoints,
          remainingStock,
        })
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
      return sendJson(response, 400, { error: error.issues[0]?.message ?? 'Validation error' })
    }

    return sendException(response, error)
  }
}
