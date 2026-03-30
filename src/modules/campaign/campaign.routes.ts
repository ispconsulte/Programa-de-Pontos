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
import { authenticate, loadTenantCredentialsForRequest } from '../../middleware/auth.js'
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
  pointsSpent: z.coerce.number().int().positive(),
  idempotencyKey: z.string().min(1).max(128),
  status: z.string().min(1).optional(),
  description: z.string().optional(),
  payload: z.record(jsonValueSchema).optional(),
})

const paymentProcessSchema = z.object({
  receivableId: z.string().min(1),
})

export async function campaignRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

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
      pointsSpent: body.pointsSpent,
      idempotencyKey: body.idempotencyKey,
      status: 'requested',
      payload: body.payload,
      createdBy: request.userId,
    })

    return reply.status(201).send(redemption)
  })
}
