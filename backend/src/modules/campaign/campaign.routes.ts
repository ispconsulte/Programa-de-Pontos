import type { FastifyInstance } from 'fastify'
import crypto from 'node:crypto'
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

const campaignRuleSettingsSchema = z.object({
  campaignId: z.string().uuid().nullable().optional(),
  campaignName: z.string().trim().min(1).max(120),
  thresholdEarlyDays: z.coerce.number().int().min(0),
  pointsEarly: z.coerce.number().int().min(0),
  pointsOnDue: z.coerce.number().int().min(0),
  pointsLate: z.coerce.number().int().min(0),
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
  reason: z.string().trim().max(240).optional().nullable(),
  expectedUpdatedAt: z.string().datetime().optional().nullable(),
  idempotencyKey: z.string().trim().min(1).max(128).optional(),
})

const manualPointsSchema = z.object({
  clientId: z.string().uuid(),
  points: z.coerce.number().int().positive(),
  reason: z.string().trim().min(1).max(240),
  adjustmentType: z.enum(['credit', 'debit']),
  idempotencyKey: z.string().trim().min(1).max(128).optional(),
})

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

const legacyRedemptionsQuerySchema = z.object({
  customerId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
})

function isLegacyCompatibilityError(message: string | undefined): boolean {
  const normalized = String(message ?? '').toLowerCase()
  return normalized.includes('contato_id')
    || normalized.includes('quantity')
    || normalized.includes('deleted_at')
    || normalized.includes('tipo_destinatario')
    || normalized.includes('destinatario_nome')
    || normalized.includes('destinatario_telefone')
}

function isCatalogCompatibilityError(message: string | undefined): boolean {
  const normalized = String(message ?? '').toLowerCase()
  return normalized.includes('deleted_at')
    || normalized.includes('catalog_item_secure_upsert')
    || normalized.includes('catalog_item_secure_soft_delete')
    || normalized.includes('tenant_id')
}

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

function getMutationErrorStatus(message: string): number {
  if (isLegacyCompatibilityError(message)) {
    return 409
  }

  if (message === 'Resgate não encontrado' || message === 'Brinde não encontrado' || message === 'Cliente não encontrado') {
    return 404
  }

  if (message === 'Forbidden') {
    return 403
  }

  if (
    message === 'Motivo é obrigatório'
    || message === 'Ação de resgate inválida'
    || message === 'Idempotency key é obrigatória'
  ) {
    return 400
  }

  if (
    message === 'Transição de status inválida'
    || message === 'O cliente não possui pontos suficientes'
    || message === 'O brinde está sem estoque'
    || message.includes('desatualizado')
  ) {
    return 409
  }

  return 500
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

function resolveIdempotencyKey(value: string | undefined, scope: string): string {
  const trimmed = value?.trim()
  if (trimmed) {
    return trimmed
  }

  return `${scope}:${crypto.randomUUID()}`
}

function mapCampaignRuleSettings(
  campaign: { id: string; nome: string | null; ativa: boolean | null },
  rules: Array<{ regra_codigo: string | null; dias_antecedencia_min: number | null; pontos: number | null }>
) {
  const byCode = new Map<string, { points: number; days: number | null }>()
  for (const row of rules) {
    const code = String(row.regra_codigo ?? '')
    if (!code) continue
    byCode.set(code, {
      points: Number(row.pontos ?? 0),
      days: row.dias_antecedencia_min == null ? null : Number(row.dias_antecedencia_min),
    })
  }

  return {
    campaignId: String(campaign.id),
    campaignName: String(campaign.nome ?? 'Campanha padrão'),
    active: Boolean(campaign.ativa),
    thresholdEarlyDays: byCode.get('antecipado')?.days ?? 3,
    pointsEarly: byCode.get('antecipado')?.points ?? 5,
    pointsOnDue: byCode.get('no_vencimento')?.points ?? 4,
    pointsLate: byCode.get('apos_vencimento')?.points ?? 2,
  }
}

export async function campaignRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)
  app.addHook('preHandler', async (request, reply) => {
    const requestPath = String(request.url ?? '').split('?')[0]
    const method = request.method.toUpperCase()
    const allowsOperatorAccess =
      (
        requestPath.endsWith('/legacy-redemptions') &&
        (method === 'GET' || method === 'POST')
      )
      || (
        requestPath.endsWith('/catalog') &&
        method === 'GET'
      )

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

  app.get('/rule-settings', {
    schema: {
      tags: ['Campaign'],
      summary: 'Listar configurações de campanhas de pontos',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const campaignsResult = await supabaseAdmin
      .from('pontuacao_campanhas')
      .select('id, nome, ativa, updated_at, created_at')
      .eq('tenant_id', request.tenantId)
      .order('ativa', { ascending: false })
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false, nullsFirst: false })

    if (campaignsResult.error) {
      throw new AppError(500, campaignsResult.error.message)
    }

    const campaigns = campaignsResult.data ?? []
    if (!campaigns.length) {
      return reply.send({ data: [] })
    }

    const rulesResult = await supabaseAdmin
      .from('pontuacao_campanha_regras')
      .select('campanha_id, regra_codigo, dias_antecedencia_min, pontos, ativo')
      .eq('tenant_id', request.tenantId)
      .in('campanha_id', campaigns.map((campaign) => String(campaign.id)))
      .eq('ativo', true)

    if (rulesResult.error) {
      throw new AppError(500, rulesResult.error.message)
    }

    const rulesByCampaign = new Map<string, Array<{ regra_codigo: string | null; dias_antecedencia_min: number | null; pontos: number | null }>>()
    for (const row of rulesResult.data ?? []) {
      const campaignId = String(row.campanha_id ?? '')
      if (!campaignId) continue
      const rows = rulesByCampaign.get(campaignId) ?? []
      rows.push(row)
      rulesByCampaign.set(campaignId, rows)
    }

    return reply.send({
      data: campaigns.map((campaign) => mapCampaignRuleSettings(campaign, rulesByCampaign.get(String(campaign.id)) ?? [])),
    })
  })

  app.post('/rule-settings', {
    schema: {
      tags: ['Campaign'],
      summary: 'Salvar configuração de campanha de pontos',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const body = campaignRuleSettingsSchema.parse(request.body)
    let campaignId = body.campaignId ?? null
    const campaignName = body.campaignName.trim() || 'Campanha padrão'

    if (campaignId) {
      const updateResult = await supabaseAdmin
        .from('pontuacao_campanhas')
        .update({ nome: campaignName })
        .eq('tenant_id', request.tenantId)
        .eq('id', campaignId)
      if (updateResult.error) throw new AppError(500, updateResult.error.message)
    } else {
      const insertResult = await supabaseAdmin
        .from('pontuacao_campanhas')
        .insert({ tenant_id: request.tenantId, nome: campaignName, ativa: false })
        .select('id')
        .single()
      if (insertResult.error || !insertResult.data) throw new AppError(500, insertResult.error?.message ?? 'Não foi possível criar campanha')
      campaignId = String(insertResult.data.id)
    }

    const deactivateResult = await supabaseAdmin
      .from('pontuacao_campanhas')
      .update({ ativa: false })
      .eq('tenant_id', request.tenantId)
      .neq('id', campaignId)
    if (deactivateResult.error) throw new AppError(500, deactivateResult.error.message)

    const activateResult = await supabaseAdmin
      .from('pontuacao_campanhas')
      .update({ ativa: true })
      .eq('tenant_id', request.tenantId)
      .eq('id', campaignId)
    if (activateResult.error) throw new AppError(500, activateResult.error.message)

    const rules = [
      { tenant_id: request.tenantId, campanha_id: campaignId, regra_codigo: 'antecipado', dias_antecedencia_min: body.thresholdEarlyDays, pontos: body.pointsEarly, ativo: true },
      { tenant_id: request.tenantId, campanha_id: campaignId, regra_codigo: 'no_vencimento', dias_antecedencia_min: null, pontos: body.pointsOnDue, ativo: true },
      { tenant_id: request.tenantId, campanha_id: campaignId, regra_codigo: 'apos_vencimento', dias_antecedencia_min: null, pontos: body.pointsLate, ativo: true },
    ]
    const rulesResult = await supabaseAdmin
      .from('pontuacao_campanha_regras')
      .upsert(rules, { onConflict: 'campanha_id,regra_codigo' })
    if (rulesResult.error) throw new AppError(500, rulesResult.error.message)

    return reply.status(204).send()
  })

  app.delete('/rule-settings/:id', {
    schema: {
      tags: ['Campaign'],
      summary: 'Excluir configuração de campanha de pontos',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const currentResult = await supabaseAdmin
      .from('pontuacao_campanhas')
      .select('id, ativa')
      .eq('tenant_id', request.tenantId)
      .eq('id', id)
      .maybeSingle()
    if (currentResult.error) throw new AppError(500, currentResult.error.message)
    if (!currentResult.data) return reply.status(204).send()

    const rulesResult = await supabaseAdmin
      .from('pontuacao_campanha_regras')
      .delete()
      .eq('tenant_id', request.tenantId)
      .eq('campanha_id', id)
    if (rulesResult.error) throw new AppError(500, rulesResult.error.message)

    const campaignResult = await supabaseAdmin
      .from('pontuacao_campanhas')
      .delete()
      .eq('tenant_id', request.tenantId)
      .eq('id', id)
    if (campaignResult.error) throw new AppError(500, campaignResult.error.message)

    if (currentResult.data.ativa) {
      const replacementResult = await supabaseAdmin
        .from('pontuacao_campanhas')
        .select('id')
        .eq('tenant_id', request.tenantId)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()
      if (replacementResult.error) throw new AppError(500, replacementResult.error.message)
      if (replacementResult.data) {
        const activateReplacementResult = await supabaseAdmin
          .from('pontuacao_campanhas')
          .update({ ativa: true })
          .eq('tenant_id', request.tenantId)
          .eq('id', replacementResult.data.id)
        if (activateReplacementResult.error) throw new AppError(500, activateReplacementResult.error.message)
      }
    }

    return reply.status(204).send()
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
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    const body = catalogRewardSchema.parse(request.body)

    const insertResult = await supabaseAdmin
      .rpc('catalog_item_secure_upsert', {
        p_tenant_id: request.tenantId,
        p_actor_user_id: request.userId,
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

    if (insertResult.error || !insertResult.data) {
      const message = insertResult.error?.message ?? 'Não foi possível criar o brinde'
      if (!isCatalogCompatibilityError(message)) {
        throw new AppError(getMutationErrorStatus(message), message)
      }

      const compatibilityResult = await supabaseAdmin
        .from('pontuacao_catalogo_brindes')
        .insert({
          tenant_id: request.tenantId,
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
        throw new AppError(
          getCatalogMutationErrorStatus(compatibilityResult.error),
          compatibilityResult.error?.message ?? 'Não foi possível criar o brinde'
        )
      }

      return reply.status(201).send(compatibilityResult.data)
    }

    return reply.status(201).send(insertResult.data)
  })

  app.get('/catalog', {
    schema: {
      tags: ['Campaign'],
      summary: 'Listar itens do catálogo legado de brindes',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const query = supabaseAdmin
      .from('pontuacao_catalogo_brindes')
      .select('id, nome, descricao, pontos_necessarios, estoque, imagem_url, ativo, created_at, updated_at')
      .eq('tenant_id', request.tenantId)
      .is('deleted_at', null)
      .order('ativo', { ascending: false })
      .order('pontos_necessarios', { ascending: true })
      .order('nome', { ascending: true })
      .limit(100)

    const listResult = await (['admin', 'owner', 'manager'].includes(String(request.userRole ?? '').toLowerCase())
      ? query
      : query.eq('ativo', true))

    if (listResult.error) {
      if (!isCatalogCompatibilityError(listResult.error.message)) {
        throw new AppError(500, listResult.error.message)
      }

      const compatibilityQuery = supabaseAdmin
        .from('pontuacao_catalogo_brindes')
        .select('id, nome, descricao, pontos_necessarios, estoque, imagem_url, ativo, created_at, updated_at')
        .eq('tenant_id', request.tenantId)
        .order('ativo', { ascending: false })
        .order('pontos_necessarios', { ascending: true })
        .order('nome', { ascending: true })
        .limit(100)

      const compatibilityResult = await (['admin', 'owner', 'manager'].includes(String(request.userRole ?? '').toLowerCase())
        ? compatibilityQuery
        : compatibilityQuery.eq('ativo', true))

      if (compatibilityResult.error) {
        throw new AppError(500, compatibilityResult.error.message)
      }

      return reply.send(compatibilityResult.data ?? [])
    }

    return reply.send(listResult.data ?? [])
  })

  const updateCatalogHandler = async (request: any, reply: any) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = catalogRewardSchema.parse(request.body)

    const updateResult = await supabaseAdmin
      .rpc('catalog_item_secure_upsert', {
        p_tenant_id: request.tenantId,
        p_actor_user_id: request.userId,
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
      if (!isCatalogCompatibilityError(message)) {
        throw new AppError(getMutationErrorStatus(message), message)
      }

      const compatibilityResult = await supabaseAdmin
        .from('pontuacao_catalogo_brindes')
        .update({
          nome: body.name.trim(),
          descricao: body.description?.trim() || null,
          pontos_necessarios: body.requiredPoints,
          estoque: body.stock ?? null,
          imagem_url: body.imageUrl?.trim() || null,
          ativo: body.active ?? true,
        })
        .eq('tenant_id', request.tenantId)
        .eq('id', id)
        .select('id, nome, descricao, pontos_necessarios, estoque, imagem_url, ativo, created_at, updated_at')
        .maybeSingle()

      if (compatibilityResult.error || !compatibilityResult.data) {
        throw new AppError(404, 'Brinde não encontrado')
      }

      return reply.send(compatibilityResult.data)
    }

    return reply.send(updateResult.data)
  }

  app.patch('/catalog/:id', {
    schema: {
      tags: ['Campaign'],
      summary: 'Atualizar item no catálogo legado de brindes',
      security: [{ bearerAuth: [] }],
    },
    config: {
      rateLimit: {
        max: 12,
        timeWindow: '1 minute',
      },
    },
  }, updateCatalogHandler)

  app.put('/catalog/:id', {
    schema: {
      tags: ['Campaign'],
      summary: 'Substituir/atualizar item no catálogo legado de brindes',
      security: [{ bearerAuth: [] }],
    },
    config: {
      rateLimit: {
        max: 12,
        timeWindow: '1 minute',
      },
    },
  }, updateCatalogHandler)

  app.delete('/catalog/:id', {
    schema: {
      tags: ['Campaign'],
      summary: 'Excluir item no catálogo legado de brindes',
      security: [{ bearerAuth: [] }],
    },
    config: {
      rateLimit: {
        max: 8,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = z.object({
      reason: z.string().trim().max(240).optional().nullable(),
      expectedUpdatedAt: z.string().datetime().optional().nullable(),
      idempotencyKey: z.string().trim().min(1).max(128).optional(),
    }).parse(request.body ?? {})
    const deleteResult = await supabaseAdmin
      .rpc('catalog_item_secure_soft_delete', {
        p_tenant_id: request.tenantId,
        p_actor_user_id: request.userId,
        p_id: id,
        p_expected_updated_at: body.expectedUpdatedAt ?? null,
        p_reason: body.reason?.trim() || 'Exclusão solicitada pela interface administrativa',
        p_idempotency_key: resolveIdempotencyKey(body.idempotencyKey, `catalog-delete:${id}`),
      })
      .single()

    if (deleteResult.error) {
      if (!isCatalogCompatibilityError(deleteResult.error.message)) {
        throw new AppError(getMutationErrorStatus(deleteResult.error.message), deleteResult.error.message)
      }

      const compatibilityDelete = await supabaseAdmin
        .from('pontuacao_catalogo_brindes')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: request.userId,
          deleted_reason: body.reason?.trim() || 'Exclusão solicitada pela interface administrativa',
        })
        .eq('tenant_id', request.tenantId)
        .eq('id', id)
        .select('id')
        .maybeSingle()

      if (compatibilityDelete.error || !compatibilityDelete.data) {
        throw new AppError(404, 'Brinde não encontrado')
      }
    }

    return reply.status(204).send()
  })

  app.post('/manual-points', {
    schema: {
      tags: ['Campaign'],
      summary: 'Adicionar pontos manualmente a um cliente da campanha',
      security: [{ bearerAuth: [] }],
    },
    config: {
      rateLimit: {
        max: 8,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    const body = manualPointsSchema.parse(request.body)

    const actorResult = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('id', request.userId)
      .maybeSingle()

    if (actorResult.error || !actorResult.data) {
      throw new AppError(404, actorResult.error?.message ?? 'Usuário autenticado não encontrado')
    }

    const clientResult = await supabaseAdmin
      .from('pontuacao_campanha_clientes')
      .select('id, tenant_id, ixc_cliente_id, nome_cliente, documento, pontos_acumulados, pontos_resgatados, pontos_disponiveis')
      .eq('tenant_id', request.tenantId)
      .eq('id', body.clientId)
      .single()

    if (clientResult.error || !clientResult.data) {
      throw new AppError(404, clientResult.error?.message ?? 'Cliente não encontrado')
    }

    const currentAccumulated = Number(clientResult.data.pontos_acumulados ?? 0)
    const nextRedeemed = Number(clientResult.data.pontos_resgatados ?? 0)
    const currentAvailable = Number(clientResult.data.pontos_disponiveis ?? Math.max(0, currentAccumulated - nextRedeemed))
    const delta = body.adjustmentType === 'debit' ? -body.points : body.points
    const nextAccumulated = currentAccumulated + delta

    if (nextAccumulated < nextRedeemed || currentAvailable + delta < 0) {
      throw new AppError(409, 'O débito manual excede o saldo disponível do cliente')
    }

    const rpcResult = await supabaseAdmin
      .rpc('apply_manual_points_adjustment', {
        p_tenant_id: request.tenantId,
        p_client_id: body.clientId,
        p_actor_user_id: request.userId,
        p_actor_name: String(actorResult.data.email ?? 'usuario'),
      p_adjustment_type: body.adjustmentType,
      p_points: body.points,
      p_reason: body.reason,
      p_customer_name_snapshot: String(clientResult.data.nome_cliente ?? 'Cliente'),
      p_customer_document_snapshot: clientResult.data.documento ? String(clientResult.data.documento) : null,
      p_idempotency_key: resolveIdempotencyKey(body.idempotencyKey, `manual-points:${body.clientId}`),
      })
      .single()

    if (rpcResult.error || !rpcResult.data) {
      throw new AppError(getMutationErrorStatus(rpcResult.error?.message ?? ''), rpcResult.error?.message ?? 'Não foi possível registrar o ajuste manual')
    }

    return reply.status(201).send({
      clientId: body.clientId,
      availablePoints: Number((rpcResult.data as any).new_balance ?? Math.max(0, nextAccumulated - nextRedeemed)),
      accumulatedPoints: Number((rpcResult.data as any).accumulated_points ?? nextAccumulated),
    })
  })

  app.post('/legacy-redemptions', {
    schema: {
      tags: ['Campaign'],
      summary: 'Registrar resgate no fluxo legado de pontos',
      security: [{ bearerAuth: [] }],
    },
    config: {
      rateLimit: {
        max: 12,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    const body = legacyRedemptionSchema.parse(request.body)
    const rpcResult = await supabaseAdmin
      .rpc('register_legacy_redemption', {
        p_tenant_id: request.tenantId,
        p_client_id: body.isActiveCustomer ? body.clientId ?? null : null,
        p_reward_id: body.rewardId,
        p_responsible: body.responsible.trim(),
        p_notes: body.notes?.trim() || null,
        p_is_active_customer: body.isActiveCustomer ?? true,
        p_lead_name: body.isActiveCustomer ? null : body.leadName?.trim() || null,
        p_lead_phone: body.isActiveCustomer ? null : body.leadPhone?.trim() || null,
        p_actor_user_id: request.userId,
        p_quantity: body.quantity,
        p_idempotency_key: resolveIdempotencyKey(body.idempotencyKey, `rescue-create:${body.rewardId}`),
      })
      .single()

    if (rpcResult.error || !rpcResult.data) {
      const message = rpcResult.error?.message ?? 'Não foi possível registrar o resgate'
      throw new AppError(getLegacyRedemptionErrorStatus(message), message)
    }

    const redemptionResult = rpcResult.data as LegacyRedemptionRpcRow

    return reply.status(201).send({
      redemption: redemptionResult.redemption,
      remainingPoints: redemptionResult.remaining_points == null ? null : Number(redemptionResult.remaining_points),
      remainingStock: redemptionResult.remaining_stock == null ? null : Number(redemptionResult.remaining_stock),
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
      .select('id, tenant_id, ixc_cliente_id, contato_id, brinde_id, brinde_nome, pontos_utilizados, quantity, status_resgate, data_entrega, responsavel_entrega, observacoes, confirmacao_cliente, tipo_destinatario, destinatario_nome, destinatario_telefone, created_at, updated_at')
      .eq('tenant_id', request.tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(query.limit)

    if (query.customerId) {
      selectQuery = selectQuery.eq('ixc_cliente_id', query.customerId)
    }

    if (query.dateFrom?.trim()) {
      selectQuery = selectQuery.gte('created_at', `${query.dateFrom.trim()}T00:00:00.000Z`)
    }

    if (query.dateTo?.trim()) {
      selectQuery = selectQuery.lte('created_at', `${query.dateTo.trim()}T23:59:59.999Z`)
    }

    const result = await selectQuery

    if (result.error) {
      if (!isLegacyCompatibilityError(result.error.message)) {
        throw new AppError(500, result.error.message)
      }

      let compatibilityQuery = supabaseAdmin
        .from('pontuacao_resgates')
        .select('id, tenant_id, ixc_cliente_id, brinde_id, brinde_nome, pontos_utilizados, status_resgate, data_entrega, responsavel_entrega, observacoes, confirmacao_cliente, created_at, updated_at', { count: 'exact' })
        .eq('tenant_id', request.tenantId)
        .order('created_at', { ascending: false })
        .limit(query.limit)

      if (query.customerId) {
        compatibilityQuery = compatibilityQuery.eq('ixc_cliente_id', query.customerId)
      }

      if (query.dateFrom?.trim()) {
        compatibilityQuery = compatibilityQuery.gte('created_at', `${query.dateFrom.trim()}T00:00:00.000Z`)
      }

      if (query.dateTo?.trim()) {
        compatibilityQuery = compatibilityQuery.lte('created_at', `${query.dateTo.trim()}T23:59:59.999Z`)
      }

      const compatibilityResult = await compatibilityQuery
      if (compatibilityResult.error) {
        throw new AppError(500, compatibilityResult.error.message)
      }

      return reply.send({
        data: (compatibilityResult.data ?? []).map((row) => ({
          ...row,
          quantity: 1,
          tipo_destinatario: String(row.ixc_cliente_id ?? '').startsWith('lead:') ? 'contato' : 'cliente',
          destinatario_nome: null,
          destinatario_telefone: null,
          cliente_nome: null,
        })),
        meta: {
          total: Number(compatibilityResult.count ?? compatibilityResult.data?.length ?? 0),
        },
      })
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
        .limit(customerIds.length)

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
        cliente_nome:
          String((row as Record<string, unknown>).destinatario_nome ?? '').trim()
          || customerNameMap.get(String(row.ixc_cliente_id))
          || null,
      })),
      meta: {
        total: rows.length,
      },
    })
  })

  app.patch('/legacy-redemptions/:id', {
    schema: {
      tags: ['Campaign'],
      summary: 'Atualizar status/observações de um resgate legado',
      security: [{ bearerAuth: [] }],
    },
    config: {
      rateLimit: {
        max: 12,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    await requireAdmin(request, reply)

    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = z.object({
      status: z.enum(['pendente', 'entregue', 'cancelado']).optional(),
      responsible: z.string().trim().min(1).max(120).optional(),
      notes: z.string().trim().max(400).nullable().optional(),
      reason: z.string().trim().max(240).optional().nullable(),
      expectedUpdatedAt: z.string().datetime().optional().nullable(),
      idempotencyKey: z.string().trim().min(1).max(128).optional(),
    }).parse(request.body)

    const current = await supabaseAdmin
      .from('pontuacao_resgates')
      .select('id, tenant_id, ixc_cliente_id, brinde_id, brinde_nome, pontos_utilizados, status_resgate, data_entrega, responsavel_entrega, observacoes, confirmacao_cliente, created_at, updated_at')
      .eq('tenant_id', request.tenantId)
      .eq('id', id)
      .maybeSingle()

    if (current.error || !current.data) {
      throw new AppError(404, current.error?.message ?? 'Resgate não encontrado')
    }

    const currentRow = current.data as any
    const nextStatus = body.status ?? currentRow.status_resgate
    const action = nextStatus === 'cancelado'
      ? 'cancel'
      : nextStatus === 'entregue' && currentRow.status_resgate !== 'entregue'
        ? 'confirm'
        : 'edit'

    const updateResult = await supabaseAdmin
      .rpc('mutate_legacy_redemption', {
        p_tenant_id: request.tenantId,
        p_redemption_id: id,
        p_actor_user_id: request.userId,
        p_action: action,
        p_responsible: body.responsible?.trim() ?? null,
        p_notes: body.notes === undefined ? null : body.notes?.trim() || null,
        p_reason: body.reason?.trim() || (action === 'cancel' ? 'Cancelamento solicitado pela interface administrativa' : 'Atualização administrativa do resgate'),
        p_expected_updated_at: body.expectedUpdatedAt ?? null,
        p_idempotency_key: resolveIdempotencyKey(body.idempotencyKey, `rescue-${action}:${id}`),
      })
      .single()

    if (updateResult.error || !updateResult.data) {
      if (isLegacyCompatibilityError(updateResult.error?.message)) {
        const updatePayload: Record<string, unknown> = {}
        if (body.status) updatePayload.status_resgate = body.status
        if (body.responsible) updatePayload.responsavel_entrega = body.responsible.trim()
        if (body.notes !== undefined) updatePayload.observacoes = body.notes?.trim() || null
        if (body.status === 'entregue') {
          updatePayload.data_entrega = new Date().toISOString()
          updatePayload.confirmacao_cliente = true
        }

        const compatibilityResult = await supabaseAdmin
          .from('pontuacao_resgates')
          .update(updatePayload)
          .eq('tenant_id', request.tenantId)
          .eq('id', id)
          .select('id, tenant_id, ixc_cliente_id, brinde_id, brinde_nome, pontos_utilizados, status_resgate, data_entrega, responsavel_entrega, observacoes, confirmacao_cliente, created_at, updated_at')
          .single()

        if (compatibilityResult.error || !compatibilityResult.data) {
          throw new AppError(500, compatibilityResult.error?.message ?? 'Não foi possível atualizar o resgate')
        }

        return reply.send({
          ...compatibilityResult.data,
          quantity: 1,
          tipo_destinatario: String(compatibilityResult.data.ixc_cliente_id ?? '').startsWith('lead:') ? 'contato' : 'cliente',
          destinatario_nome: null,
          destinatario_telefone: null,
        })
      }

      throw new AppError(getMutationErrorStatus(updateResult.error?.message ?? ''), updateResult.error?.message ?? 'Não foi possível atualizar o resgate')
    }

    return reply.send(updateResult.data)
  })

  app.delete('/legacy-redemptions/:id', {
    schema: {
      tags: ['Campaign'],
      summary: 'Excluir um resgate legado',
      security: [{ bearerAuth: [] }],
    },
    config: {
      rateLimit: {
        max: 8,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    await requireAdmin(request, reply)

    const { id } = z.object({ id: z.string().uuid() }).parse(request.params)
    const body = z.object({
      reason: z.string().trim().max(240).optional().nullable(),
      expectedUpdatedAt: z.string().datetime().optional().nullable(),
      idempotencyKey: z.string().trim().min(1).max(128).optional(),
    }).parse(request.body ?? {})
    const deleteResult = await supabaseAdmin
      .rpc('mutate_legacy_redemption', {
        p_tenant_id: request.tenantId,
        p_redemption_id: id,
        p_actor_user_id: request.userId,
        p_action: 'delete',
        p_responsible: null,
        p_notes: null,
        p_reason: body.reason?.trim() || 'Exclusão solicitada pela interface administrativa',
        p_expected_updated_at: body.expectedUpdatedAt ?? null,
        p_idempotency_key: resolveIdempotencyKey(body.idempotencyKey, `rescue-delete:${id}`),
      })
      .single()

    if (deleteResult.error) {
      if (isLegacyCompatibilityError(deleteResult.error.message)) {
        throw new AppError(409, 'Exclusão de resgate indisponível: o banco atual não possui soft delete para resgates')
      }

      throw new AppError(getMutationErrorStatus(deleteResult.error.message), deleteResult.error.message)
    }

    return reply.status(204).send()
  })
}
