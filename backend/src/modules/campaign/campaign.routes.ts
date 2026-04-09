import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import {
  getCampaignSummaryFromCustomer,
  getCampaignLedgerSummary,
  getCustomerProfileByIdentity,
  listCampaignEvents,
  listCampaignMissions,
  listCampaignRules,
  listCustomerProfiles,
  listRewardRedemptions,
  processPaymentCampaignEvent,
  redeemCampaignReward,
  recordCampaignEvent,
  resolveCampaignRule,
  resolveCustomerProfile,
} from '../../lib/campaign.js'
import { ixcGet, type ClienteContratoItem, type ClienteItem, type FnAreceberItem } from '../../lib/ixc-proxy.js'
import { resolveContractId } from '../../lib/business-rules.js'
import { AppError } from '../../lib/app-error.js'
import { supabaseAdmin } from '../../lib/supabase-admin.js'
import { authenticate, loadTenantCredentialsForRequest, requireAdmin } from '../../middleware/auth.js'
import { resolveRequestedIxcConnectionId } from '../../middleware/auth.js'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ])
)

const eventsQuerySchema = z.object({
  customerId: z.string().optional(),
  customerProfileId: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
})

const ledgerQuerySchema = z.object({
  customerId: z.string().optional(),
  customerProfileId: z.string().uuid().optional(),
}).refine((data) => data.customerId ?? data.customerProfileId, {
  message: 'customerId or customerProfileId is required',
})

const identityResolveSchema = z.object({
  sourceType: z.string().min(1).default('ixc'),
  sourceConnectionId: z.string().uuid().optional(),
  externalCustomerId: z.string().min(1),
  externalContractId: z.string().optional(),
  displayName: z.string().optional(),
  documentNumber: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  metadata: z.record(jsonValueSchema).optional(),
})

const rulesQuerySchema = z.object({
  eventType: z.enum(['payment', 'upgrade', 'sva', 'loyalty_renewal']).optional(),
})

const eventCreateSchema = z.object({
  customerId: z.string().optional(),
  customerProfileId: z.string().uuid().optional(),
  contractId: z.string().optional(),
  eventType: z.enum(['payment', 'upgrade', 'sva', 'loyalty_renewal']),
  eventSource: z.enum(['ixc', 'manual', 'system']).default('manual'),
  sourceReferenceType: z.string().optional(),
  sourceReferenceId: z.string().optional(),
  occurredAt: z.string().optional(),
  idempotencyKey: z.string().min(1).max(128),
  points: z.coerce.number().int().optional(),
  description: z.string().optional(),
  ruleCode: z.string().optional(),
  payload: z.record(jsonValueSchema).optional(),
}).refine((data) => data.customerId ?? data.customerProfileId, {
  message: 'customerId or customerProfileId is required',
}).refine((data) => (!data.sourceReferenceType && !data.sourceReferenceId) || (data.sourceReferenceType && data.sourceReferenceId), {
  message: 'sourceReferenceType and sourceReferenceId must be provided together',
})

const paymentSimulationSchema = z.object({
  paymentDate: z.string().min(1),
  dueDate: z.string().min(1),
})

const redemptionCreateSchema = z.object({
  customerId: z.string().min(1),
  customerProfileId: z.string().uuid().optional(),
  rewardCode: z.string().min(1).max(120),
  idempotencyKey: z.string().min(1).max(128),
  status: z.string().min(1).optional(),
  description: z.string().optional(),
  payload: z.record(jsonValueSchema).optional(),
})

const paymentProcessSchema = z.object({
  receivableId: z.string().min(1),
})

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

const legacyRedemptionsQuerySchema = z.object({
  customerId: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
})

export async function campaignRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)
  app.addHook('preHandler', async (request, reply) => {
    const requestPath = String(request.url ?? '').split('?')[0]
    const method = request.method.toUpperCase()
    const allowsOperatorAccess =
      requestPath.endsWith('/legacy-redemptions') &&
      (method === 'GET' || method === 'POST')

    if (allowsOperatorAccess) {
      return
    }

    await requireAdmin(request, reply)
  })

  app.get('/customers', {
    schema: {
      tags: ['Campaign'],
      summary: 'Listar clientes internos da campanha',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const query = z.object({
      limit: z.coerce.number().int().positive().max(100).default(50),
    }).parse(request.query)

    const items = await listCustomerProfiles(request.tenantId, query.limit)
    return reply.send({ data: items })
  })

  app.post('/customers/resolve', {
    schema: {
      tags: ['Campaign'],
      summary: 'Resolver ou criar identidade interna de cliente',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const body = identityResolveSchema.parse(request.body)
    const resolved = await resolveCustomerProfile({
      tenantId: request.tenantId,
      sourceType: body.sourceType,
      sourceConnectionId: body.sourceConnectionId ?? resolveRequestedIxcConnectionId(request) ?? request.ixcConnectionId ?? null,
      externalCustomerId: body.externalCustomerId,
      externalContractId: body.externalContractId,
      displayName: body.displayName,
      documentNumber: body.documentNumber,
      email: body.email,
      phone: body.phone,
      metadata: body.metadata,
    })

    const profile = await getCustomerProfileByIdentity(
      request.tenantId,
      body.sourceType,
      body.sourceConnectionId ?? resolveRequestedIxcConnectionId(request) ?? request.ixcConnectionId ?? null,
      body.externalCustomerId
    )

    return reply.send({
      customerProfileId: resolved.profileId,
      identityId: resolved.identityId,
      profile,
    })
  })

  app.get('/ledger', {
    schema: {
      tags: ['Campaign'],
      summary: 'Consultar saldo derivado da campanha',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const query = ledgerQuerySchema.parse(request.query)
    const summary = await getCampaignLedgerSummary(request.tenantId, query)
    return reply.send(summary)
  })

  app.get('/customers/:customerId/summary', {
    schema: {
      tags: ['Campaign'],
      summary: 'Consultar resumo da campanha por cliente IXC',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { customerId: { type: 'string' } }, required: ['customerId'] },
    },
  }, async (request, reply) => {
    const { customerId } = request.params as { customerId: string }
    const tenant = await loadTenantCredentialsForRequest(request)
    const creds = {
      ixcBaseUrl: tenant.ixc_base_url,
      ixcUser: tenant.ixc_user,
      ixcTokenEnc: tenant.ixc_token_enc,
      ixcTokenIv: tenant.ixc_token_iv,
      tenantId: request.tenantId,
      userId: request.userId,
      ixcConnectionId: tenant.connection_id,
    }

    const customer = await ixcGet<ClienteItem>(creds, 'cliente', customerId, request.ip)
    const existingProfile = await getCustomerProfileByIdentity(
      request.tenantId,
      'ixc',
      tenant.connection_id,
      customerId
    )

    const summary = await getCampaignSummaryFromCustomer(request.tenantId, customer, {
      sourceConnectionId: tenant.connection_id,
      customerProfileId: existingProfile?.id ?? null,
    })

    return reply.send({
      customer,
      summary,
    })
  })

  app.get('/rules', {
    schema: {
      tags: ['Campaign'],
      summary: 'Listar regras ativas da campanha',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const query = rulesQuerySchema.parse(request.query)
    const items = await listCampaignRules(request.tenantId, query.eventType)
    return reply.send({ data: items })
  })

  app.post('/rules/payment/resolve', {
    schema: {
      tags: ['Campaign'],
      summary: 'Simular regra de pagamento aplicavel',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const body = paymentSimulationSchema.parse(request.body)
    const rule = await resolveCampaignRule(request.tenantId, 'payment', {
      paymentDate: body.paymentDate,
      dueDate: body.dueDate,
      occurredAt: body.paymentDate,
    })

    return reply.send(rule)
  })

  app.get('/missions', {
    schema: {
      tags: ['Campaign'],
      summary: 'Listar missoes da campanha',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const query = z.object({
      customerProfileId: z.string().uuid().optional(),
    }).parse(request.query)

    const items = await listCampaignMissions(request.tenantId, query.customerProfileId)
    return reply.send({ data: items })
  })

  app.get('/events', {
    schema: {
      tags: ['Campaign'],
      summary: 'Listar eventos da campanha',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const query = eventsQuerySchema.parse(request.query)
    const items = await listCampaignEvents(request.tenantId, query)
    return reply.send({ data: items })
  })

  app.post('/events', {
    schema: {
      tags: ['Campaign'],
      summary: 'Registrar evento da campanha',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const body = eventCreateSchema.parse(request.body)

    if (body.eventSource !== 'manual') {
      throw new AppError(400, 'Only manual campaign events can be created from this endpoint')
    }
    if (body.points !== undefined || body.ruleCode || body.description) {
      throw new AppError(400, 'Sensitive event fields are calculated server-side')
    }

    const item = await recordCampaignEvent({
      tenantId: request.tenantId,
      ixcConnectionId: resolveRequestedIxcConnectionId(request) ?? request.ixcConnectionId ?? null,
      customerId: body.customerId,
      customerProfileId: body.customerProfileId,
      contractId: body.contractId,
      eventType: body.eventType,
      eventSource: 'manual',
      sourceReferenceType: body.sourceReferenceType,
      sourceReferenceId: body.sourceReferenceId,
      occurredAt: body.occurredAt,
      idempotencyKey: body.idempotencyKey,
      payload: body.payload,
      createdBy: request.userId,
    })

    return reply.status(201).send(item)
  })

  app.post('/payments/process', {
    schema: {
      tags: ['Campaign'],
      summary: 'Processar pontuacao de pagamento a partir de um recebivel IXC',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const body = paymentProcessSchema.parse(request.body)
    const tenant = await loadTenantCredentialsForRequest(request)
    const creds = {
      ixcBaseUrl: tenant.ixc_base_url,
      ixcUser: tenant.ixc_user,
      ixcTokenEnc: tenant.ixc_token_enc,
      ixcTokenIv: tenant.ixc_token_iv,
      tenantId: request.tenantId,
      userId: request.userId,
      ixcConnectionId: tenant.connection_id,
    }

    const receivable = await ixcGet<FnAreceberItem>(creds, 'fn_areceber', body.receivableId, request.ip)
    const customer = await ixcGet<ClienteItem>(creds, 'cliente', receivable.id_cliente, request.ip)

    const contractId = resolveContractId(receivable)
    let contract: ClienteContratoItem | null = null
    if (contractId) {
      try {
        contract = await ixcGet<ClienteContratoItem>(creds, 'cliente_contrato', contractId, request.ip)
      } catch {
        contract = null
      }
    }

    const processed = await processPaymentCampaignEvent({
      tenantId: request.tenantId,
      ixcConnectionId: tenant.connection_id,
      receivable,
      customer,
      contract,
      createdBy: request.userId,
    })

    return reply.status(201).send({
      receivable,
      customer,
      contract,
      ...processed,
    })
  })

  app.get('/redemptions', {
    schema: {
      tags: ['Campaign'],
      summary: 'Listar resgates da campanha',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const query = eventsQuerySchema.parse(request.query)
    const items = await listRewardRedemptions(request.tenantId, query)
    return reply.send({ data: items })
  })

  app.post('/redemptions', {
    schema: {
      tags: ['Campaign'],
      summary: 'Registrar resgate da campanha',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const body = redemptionCreateSchema.parse(request.body)

    if (body.status && body.status !== 'requested') {
      throw new AppError(400, 'Redemption status is controlled server-side')
    }
    if (body.description) {
      throw new AppError(400, 'Redemption description is controlled server-side')
    }

    const redemption = await redeemCampaignReward({
      tenantId: request.tenantId,
      ixcConnectionId: resolveRequestedIxcConnectionId(request) ?? request.ixcConnectionId ?? null,
      customerId: body.customerId,
      customerProfileId: body.customerProfileId,
      rewardCode: body.rewardCode,
      pointsSpent: 0,
      idempotencyKey: body.idempotencyKey,
      status: 'requested',
      payload: body.payload,
      createdBy: request.userId,
    })

    return reply.status(201).send(redemption)
  })

  app.post('/catalog', {
    schema: {
      tags: ['Campaign'],
      summary: 'Criar item no catálogo legado de brindes',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const body = catalogRewardSchema.parse(request.body)

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
      throw new AppError(500, insertResult.error?.message ?? 'Não foi possível criar o brinde')
    }

    return reply.status(201).send(insertResult.data)
  })

  app.patch('/catalog/:id', {
    schema: {
      tags: ['Campaign'],
      summary: 'Atualizar item no catálogo legado de brindes',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = catalogRewardSchema.parse(request.body)

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
      throw new AppError(500, updateResult.error?.message ?? 'Não foi possível atualizar o brinde')
    }

    return reply.send(updateResult.data)
  })

  app.delete('/catalog/:id', {
    schema: {
      tags: ['Campaign'],
      summary: 'Excluir item no catálogo legado de brindes',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)

    const deleteResult = await supabaseAdmin
      .from('pontuacao_catalogo_brindes')
      .delete()
      .eq('id', id)

    if (deleteResult.error) {
      throw new AppError(500, deleteResult.error.message)
    }

    return reply.status(204).send()
  })

  app.post('/manual-points', {
    schema: {
      tags: ['Campaign'],
      summary: 'Adicionar pontos manualmente a um cliente da campanha',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const body = manualPointsSchema.parse(request.body)

    const clientResult = await supabaseAdmin
      .from('pontuacao_campanha_clientes')
      .select('id, tenant_id, ixc_cliente_id, pontos_acumulados, pontos_resgatados')
      .eq('tenant_id', request.tenantId)
      .eq('id', body.clientId)
      .single()

    if (clientResult.error || !clientResult.data) {
      throw new AppError(404, clientResult.error?.message ?? 'Cliente não encontrado')
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
      .eq('tenant_id', request.tenantId)
      .eq('id', body.clientId)

    if (updateResult.error) {
      throw new AppError(500, updateResult.error.message)
    }

    const historyResult = await supabaseAdmin
      .from('pontuacao_historico')
      .insert({
        ixc_cliente_id: clientResult.data.ixc_cliente_id,
        tipo_evento: 'ajuste_manual',
        pontos: body.points,
        descricao: body.description,
        criado_por: request.userId,
      })

    if (historyResult.error) {
      throw new AppError(500, historyResult.error.message)
    }

    return reply.status(201).send({
      clientId: body.clientId,
      availablePoints: Math.max(0, nextAccumulated - nextRedeemed),
      accumulatedPoints: nextAccumulated,
    })
  })

  app.post('/legacy-redemptions', {
    schema: {
      tags: ['Campaign'],
      summary: 'Registrar resgate no fluxo legado de pontos',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const body = legacyRedemptionSchema.parse(request.body)

    const [clientResult, rewardResult] = await Promise.all([
      supabaseAdmin
        .from('pontuacao_campanha_clientes')
        .select('id, tenant_id, ixc_cliente_id, nome_cliente, pontos_acumulados, pontos_disponiveis, pontos_resgatados')
        .eq('tenant_id', request.tenantId)
        .eq('id', body.clientId)
        .single(),
      supabaseAdmin
        .from('pontuacao_catalogo_brindes')
        .select('id, nome, pontos_necessarios, estoque, ativo')
        .eq('id', body.rewardId)
        .single(),
    ])

    if (clientResult.error || !clientResult.data) {
      throw new AppError(404, clientResult.error?.message ?? 'Cliente não encontrado')
    }
    if (rewardResult.error || !rewardResult.data) {
      throw new AppError(404, rewardResult.error?.message ?? 'Brinde não encontrado')
    }

    const reward = rewardResult.data
    const client = clientResult.data
    const availablePoints = Number(client.pontos_disponiveis ?? 0)
    const spentPoints = Number(reward.pontos_necessarios ?? 0)
    const currentStock = reward.estoque == null ? null : Number(reward.estoque)

    if (!reward.ativo) {
      throw new AppError(409, 'O brinde está inativo')
    }
    if (availablePoints < spentPoints) {
      throw new AppError(409, 'O cliente não possui pontos suficientes')
    }
    if (currentStock != null && currentStock <= 0) {
      throw new AppError(409, 'O brinde está sem estoque')
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
      throw new AppError(500, redemptionInsert.error?.message ?? 'Não foi possível registrar o resgate')
    }

    const clientUpdate = await supabaseAdmin
      .from('pontuacao_campanha_clientes')
      .update({
        pontos_resgatados: Number(client.pontos_resgatados ?? 0) + spentPoints,
        ultimo_resgate: deliveredAt,
        ultima_sincronizacao_em: deliveredAt,
      })
      .eq('tenant_id', request.tenantId)
      .eq('id', body.clientId)

    if (clientUpdate.error) {
      throw new AppError(500, clientUpdate.error.message)
    }

    if (currentStock != null) {
      const rewardUpdate = await supabaseAdmin
        .from('pontuacao_catalogo_brindes')
        .update({
          estoque: Math.max(0, currentStock - 1),
        })
        .eq('id', reward.id)

      if (rewardUpdate.error) {
        throw new AppError(500, rewardUpdate.error.message)
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

    return reply.status(201).send({
      redemption: redemptionInsert.data,
      remainingPoints: Math.max(0, Number(client.pontos_acumulados ?? 0) - (Number(client.pontos_resgatados ?? 0) + spentPoints)),
      remainingStock: currentStock == null ? null : Math.max(0, currentStock - 1),
    })
  })

  app.get('/legacy-redemptions', {
    schema: {
      tags: ['Campaign'],
      summary: 'Listar resgates do fluxo legado',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const query = legacyRedemptionsQuerySchema.parse(request.query)

    let selectQuery = supabaseAdmin
      .from('pontuacao_resgates')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(query.limit)

    if (query.customerId) {
      selectQuery = selectQuery.eq('ixc_cliente_id', query.customerId)
    }

    const result = await selectQuery

    if (result.error) {
      throw new AppError(500, result.error.message)
    }

    const rows = result.data ?? []
    const customerIds = Array.from(
      new Set(
        rows
          .map((row) => String(row.ixc_cliente_id ?? '').trim())
          .filter(Boolean),
      ),
    )

    let customerNameMap = new Map<string, string>()
    if (customerIds.length > 0) {
      const customersResult = await supabaseAdmin
        .from('pontuacao_campanha_clientes')
        .select('ixc_cliente_id, nome_cliente')
        .eq('tenant_id', request.tenantId)
        .in('ixc_cliente_id', customerIds)

      if (customersResult.error) {
        throw new AppError(500, customersResult.error.message)
      }

      customerNameMap = new Map(
        (customersResult.data ?? []).map((row) => [
          String(row.ixc_cliente_id),
          String(row.nome_cliente ?? '').trim(),
        ]),
      )
    }

    return reply.send({
      data: rows.map((row) => ({
        ...row,
        cliente_nome: customerNameMap.get(String(row.ixc_cliente_id)) || null,
      })),
    })
  })
}
