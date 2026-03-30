import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate, loadTenantCredentialsForRequest } from '../../middleware/auth.js'
import { ixcList, ixcFindOneByField, type FnAreceberItem, type ClienteContratoItem, type ClienteItem } from '../../lib/ixc-proxy.js'
import { getPaymentCategory, resolveContractId } from '../../lib/business-rules.js'
import { AppError } from '../../lib/app-error.js'

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  category: z.enum(['received', 'renegotiated', 'open', 'cancelled']).optional(),
})

function hasMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value !== 'string') return true

  const normalized = value.trim()
  if (!normalized) return false
  if (normalized === '-' || normalized === '0') return false
  if (normalized === '0000-00-00' || normalized === '0000-00-00 00:00:00') return false
  if (normalized.toLowerCase() === 'undefined' || normalized.toLowerCase() === 'null') return false

  return true
}

function hasOnlyCodeValue(value?: string | null) {
  if (!hasMeaningfulValue(value)) return false
  const normalized = String(value).trim()
  return normalized.length <= 2 && /^[A-Z]$/i.test(normalized)
}

function resolveCustomerName(client?: ClienteItem | null) {
  if (!client) return null
  if (hasMeaningfulValue(client.razao)) return client.razao
  if (hasMeaningfulValue(client.fantasia)) return client.fantasia
  return null
}

function resolveCustomerPhone(client?: ClienteItem | null) {
  if (!client) return null
  if (hasMeaningfulValue(client.telefone_celular)) return client.telefone_celular
  if (hasMeaningfulValue(client.fone)) return client.fone
  return null
}

function localizeReceivableCategory(category: string) {
  switch (category) {
    case 'received':
      return 'Recebido'
    case 'renegotiated':
      return 'Renegociado'
    case 'open':
      return 'Em aberto'
    case 'cancelled':
      return 'Cancelado'
    default:
      return 'Não encontrado'
  }
}

function localizeReceivableStatus(status: string, category: string) {
  if (status === 'R' && category === 'received') return 'Recebido'
  if (status === 'R' && category === 'renegotiated') return 'Renegociado'
  if (status === 'A') return 'Em aberto'
  if (status === 'C') return 'Cancelado'
  return 'Não encontrado'
}

function normalizeContract(contract?: ClienteContratoItem | null) {
  if (!contract) return null

  return {
    ...contract,
    plano: hasMeaningfulValue(contract.contrato) ? contract.contrato : null,
    pago_ate: hasMeaningfulValue(contract.pago_ate_data) ? contract.pago_ate_data : null,
  }
}

function normalizeClient(client?: ClienteItem | null) {
  if (!client) return null

  return {
    ...client,
    nome: resolveCustomerName(client),
    cpf_cnpj: hasMeaningfulValue(client.cnpj_cpf) ? client.cnpj_cpf : null,
    email: hasMeaningfulValue(client.email) ? client.email : hasMeaningfulValue(client.hotsite_email) ? client.hotsite_email : null,
    telefone: resolveCustomerPhone(client),
    celular: hasMeaningfulValue(client.telefone_celular) ? client.telefone_celular : null,
    bairro: hasMeaningfulValue(client.bairro) ? client.bairro : null,
    endereco: hasMeaningfulValue(client.endereco) ? client.endereco : null,
    numero: hasMeaningfulValue(client.numero) ? client.numero : null,
    complemento: hasMeaningfulValue(client.complemento) ? client.complemento : null,
    cep: hasMeaningfulValue(client.cep) ? client.cep : null,
    ativo: hasMeaningfulValue(client.ativo) ? client.ativo : null,
    cidade: hasMeaningfulValue(client.cidade) && !/^\d+$/.test(client.cidade.trim()) ? client.cidade : null,
    estado: hasMeaningfulValue(client.uf) && !/^\d+$/.test(client.uf.trim()) ? client.uf : null,
    observacao: hasMeaningfulValue((client as ClienteItem & { obs?: string }).obs) ? (client as ClienteItem & { obs?: string }).obs : null,
  }
}

function normalizeReceivable(
  item: FnAreceberItem & {
    category: string
    contract?: ClienteContratoItem | null
    client?: ClienteItem | null
  }
) {
  const { category, contract: _contract, client, ...receivable } = item
  const paymentCategory = item.category
  const paymentStatus = localizeReceivableStatus(item.status, paymentCategory)
  const normalizedClient = normalizeClient(client)
  const clientName = normalizedClient?.nome ?? resolveCustomerName(client)

  return {
    ...receivable,
    categoria: localizeReceivableCategory(paymentCategory),
    categoria_codigo: paymentCategory,
    status: paymentStatus,
    status_codigo: item.status,
    tipo: hasMeaningfulValue(item.tipo_recebimento) ? item.tipo_recebimento : null,
    forma_pagamento:
      hasMeaningfulValue(item.forma_recebimento) && !hasOnlyCodeValue(item.forma_recebimento)
        ? item.forma_recebimento
        : hasMeaningfulValue(item.tipo_recebimento)
          ? item.tipo_recebimento
          : hasMeaningfulValue(item.forma_recebimento)
            ? item.forma_recebimento
            : null,
    observacao: hasMeaningfulValue(item.obs) ? item.obs : null,
    data_pagamento: hasMeaningfulValue(item.pagamento_data) ? item.pagamento_data : hasMeaningfulValue(item.baixa_data) ? item.baixa_data : null,
    nosso_numero: hasMeaningfulValue(item.nn_boleto) ? item.nn_boleto : null,
    linha_digitavel: hasMeaningfulValue((item as FnAreceberItem & { linha_digitavel?: string }).linha_digitavel)
      ? (item as FnAreceberItem & { linha_digitavel?: string }).linha_digitavel
      : hasMeaningfulValue(item.nn_boleto)
        ? item.nn_boleto
        : null,
    descricao: hasMeaningfulValue(item.obs) ? item.obs : null,
    url_boleto: hasMeaningfulValue((item as FnAreceberItem & { gateway_link?: string }).gateway_link)
      ? (item as FnAreceberItem & { gateway_link?: string }).gateway_link
      : null,
    cliente: normalizedClient,
    client: normalizedClient,
    cliente_nome: clientName,
    cliente_documento: normalizedClient?.cpf_cnpj ?? null,
    cliente_cpf_cnpj: normalizedClient?.cpf_cnpj ?? null,
    cliente_email: normalizedClient?.email ?? null,
    cliente_telefone: normalizedClient?.telefone ?? null,
    cliente_celular: normalizedClient?.celular ?? null,
    cliente_bairro: normalizedClient?.bairro ?? null,
    cliente_endereco: normalizedClient?.endereco ?? null,
    cliente_numero: normalizedClient?.numero ?? null,
    cliente_complemento: normalizedClient?.complemento ?? null,
    cliente_cep: normalizedClient?.cep ?? null,
    cliente_cidade: normalizedClient?.cidade ?? null,
    cliente_estado: normalizedClient?.estado ?? null,
    cliente_ativo: normalizedClient?.ativo ?? null,
  }
}

async function loadReceivableById(
  creds: {
    ixcBaseUrl: string
    ixcUser: string
    ixcTokenEnc: Buffer
    ixcTokenIv: Buffer
    tenantId: string
    userId: string
    ixcConnectionId: string
  },
  id: string,
  ipAddr: string
) {
  const result = await ixcList<FnAreceberItem>(creds, 'fn_areceber', {
    qtype: 'fn_areceber.id',
    query: id,
    oper: '=',
    page: '1',
    rp: '1',
    sortname: 'id',
    sortorder: 'asc',
  }, ipAddr)

  const item = (result.msg ?? [])[0]
  if (!item) {
    throw new AppError(404, 'Receivable not found')
  }

  return item
}

export async function receivablesRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  app.get('/', {
    schema: {
      tags: ['Receivables'],
      summary: 'Listar recebimentos do IXC',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20, maximum: 50 },
          dateFrom: { type: 'string', example: '2026-01-01' },
          dateTo: { type: 'string', example: '2026-03-31' },
          category: { type: 'string', enum: ['received', 'renegotiated', 'open', 'cancelled'] },
        },
      },
    },
  }, async (request, reply) => {
    const query = querySchema.parse(request.query)
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

    const result = await ixcList<FnAreceberItem>(creds, 'fn_areceber', {
      qtype: 'fn_areceber.status',
      query: 'R',
      oper: '=',
      page: String(query.page),
      rp: String(query.limit),
      sortname: 'data_vencimento',
      sortorder: 'desc',
    }, request.ip)

    const items = result.msg ?? []
    const filteredByCategory = items.map((item) => {
      const category = getPaymentCategory(item)
      if (query.category && category !== query.category) return null
      return { ...item, category }
    })

    const filtered = filteredByCategory.filter((item): item is NonNullable<typeof item> => Boolean(item))
    const uniqueClientIds = [...new Set(filtered.map((item) => item.id_cliente).filter(Boolean))]
    const clientsById = new Map<string, ClienteItem | null>()

    await Promise.all(uniqueClientIds.map(async (clientId) => {
      try {
        const client = await ixcFindOneByField<ClienteItem>(creds, 'cliente', {
          qtype: 'cliente.id',
          query: clientId,
          oper: '=',
        }, request.ip)
        clientsById.set(clientId, client)
      } catch {
        clientsById.set(clientId, null)
      }
    }))

    const normalized = filtered.map((item) => normalizeReceivable({
      ...item,
      client: clientsById.get(item.id_cliente) ?? null,
    }))
    const upstreamTotal = parseInt(result.total ?? '0', 10)
    const totalPages = Math.max(1, Math.ceil(upstreamTotal / query.limit))

    const totalReceived = filtered.filter((i) => i.category === 'received').length
    const totalRenegotiated = filtered.filter((i) => i.category === 'renegotiated').length
    const totalAmount = filtered
      .filter((i) => i.category === 'received')
      .reduce((sum, i) => sum + parseFloat(i.valor_recebido ?? '0'), 0)

    return reply.send({
      data: normalized,
      total: upstreamTotal,
      page: query.page,
      limit: query.limit,
      totalPages,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: upstreamTotal,
        totalPages,
      },
      summary: {
        totalReceived,
        totalRenegotiated,
        totalAmount: totalAmount.toFixed(2),
      },
    })
  })

  app.get('/:id', {
    schema: {
      tags: ['Receivables'],
      summary: 'Buscar recebimento por ID',
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string' } } },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
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

    const item = await loadReceivableById(creds, id, request.ip)
    const category = getPaymentCategory(item)
    const contractId = resolveContractId(item)

    let contract: ClienteContratoItem | null = null
    if (contractId) {
      try {
        contract = await ixcFindOneByField<ClienteContratoItem>(creds, 'cliente_contrato', {
          qtype: 'cliente_contrato.id',
          query: contractId,
          oper: '=',
        }, request.ip)
      } catch {
        contract = null
      }
    }

    let cliente: ClienteItem | null = null
    try {
      cliente = await ixcFindOneByField<ClienteItem>(creds, 'cliente', {
        qtype: 'cliente.id',
        query: item.id_cliente,
        oper: '=',
      }, request.ip)
    } catch {
      cliente = null
    }

    const normalizedContract = normalizeContract(contract)
    const normalizedClient = normalizeClient(cliente)
    const normalizedReceivable = normalizeReceivable({
      ...item,
      category,
      contract,
      client: cliente,
    })

    return reply.send({
      data: normalizedReceivable,
      receivable: normalizedReceivable,
      contract: normalizedContract,
      contrato: normalizedContract,
      client: normalizedClient,
      cliente: normalizedClient,
    })
  })
}
