import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate, loadTenantCredentialsForRequest } from '../../middleware/auth.js'
import { ixcList, ixcFindOneByField, type ClienteItem, type ClienteContratoItem } from '../../lib/ixc-proxy.js'
import { AppError } from '../../lib/app-error.js'

const clientsQuerySchema = z.object({
  id: z.string().optional(),
  cpfCnpj: z.string().optional(),
  name: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
}).refine((data) => data.id ?? data.cpfCnpj ?? data.name, {
  message: 'At least one of id, cpfCnpj, or name is required',
})

function normalizeClient(client: ClienteItem) {
  return {
    ...client,
    nome: client.razao,
    cpf_cnpj: client.cnpj_cpf,
    telefone: client.fone,
    celular: client.telefone_celular,
    estado: client.uf,
  }
}

function matchesClientName(client: ClienteItem, query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true

  return [client.razao, client.fantasia]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(needle))
}

async function searchClientsByName(
  creds: {
    ixcBaseUrl: string
    ixcUser: string
    ixcTokenEnc: Buffer
    ixcTokenIv: Buffer
    tenantId: string
    userId: string
    ixcConnectionId: string
  },
  name: string,
  page: number,
  limit: number,
  ip: string
) {
  try {
    const direct = await ixcList<ClienteItem>(creds, 'cliente', {
      qtype: 'cliente.razao',
      query: name,
      oper: 'like',
      page: String(page),
      rp: String(limit),
      sortname: 'id',
      sortorder: 'asc',
    }, ip)

    return {
      items: direct.msg ?? [],
      total: parseInt(direct.total ?? '0', 10),
    }
  } catch (error) {
    if (!(error instanceof AppError) || error.statusCode !== 502) {
      throw error
    }

    const maxScanPages = 5
    const scanPageSize = 50
    const collected: ClienteItem[] = []

    for (let currentPage = 1; currentPage <= maxScanPages; currentPage += 1) {
      const chunk = await ixcList<ClienteItem>(creds, 'cliente', {
        qtype: 'cliente.cnpj_cpf',
        query: '',
        oper: '=',
        page: String(currentPage),
        rp: String(scanPageSize),
        sortname: 'id',
        sortorder: 'asc',
      }, ip)

      const currentItems = chunk.msg ?? []
      collected.push(...currentItems.filter((item) => matchesClientName(item, name)))

      if (currentItems.length < scanPageSize) {
        break
      }
    }

    const start = (page - 1) * limit
    const items = collected.slice(start, start + limit)

    return {
      items,
      total: collected.length,
    }
  }
}

export async function clientsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  app.get('/', {
    schema: {
      tags: ['Clients'],
      summary: 'Buscar clientes (ao menos um filtro obrigatório)',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'ID do cliente no IXC' },
          cpfCnpj: { type: 'string', example: '139.301.667-71' },
          name: { type: 'string', example: 'Raphael' },
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20, maximum: 50 },
        },
      },
    },
  }, async (request, reply) => {
    const query = clientsQuerySchema.parse(request.query)
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

    let items: ClienteItem[] = []
    let total = 0

    if (query.id) {
      const result = await ixcList<ClienteItem>(creds, 'cliente', {
        qtype: 'cliente.id',
        query: query.id,
        oper: '=',
        page: String(query.page),
        rp: String(query.limit),
        sortname: 'id',
        sortorder: 'asc',
      }, request.ip)

      items = result.msg ?? []
      total = parseInt(result.total ?? '0', 10)
    } else if (query.cpfCnpj) {
      const result = await ixcList<ClienteItem>(creds, 'cliente', {
        qtype: 'cliente.cnpj_cpf',
        query: query.cpfCnpj,
        oper: '=',
        page: String(query.page),
        rp: String(query.limit),
        sortname: 'id',
        sortorder: 'asc',
      }, request.ip)

      items = result.msg ?? []
      total = parseInt(result.total ?? '0', 10)
    } else if (query.name) {
      const result = await searchClientsByName(
        creds,
        query.name,
        query.page,
        query.limit,
        request.ip
      )

      items = result.items
      total = result.total
    } else {
      throw new AppError(400, 'At least one search parameter is required')
    }

    const normalizedItems = items.map(normalizeClient)
    const totalPages = Math.max(1, Math.ceil(total / query.limit))

    return reply.send({
      data: normalizedItems,
      total,
      page: query.page,
      limit: query.limit,
      totalPages,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
    })
  })

  app.get('/:id', {
    schema: {
      tags: ['Clients'],
      summary: 'Buscar cliente por ID + seus contratos',
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

    const cliente = await ixcFindOneByField<ClienteItem>(creds, 'cliente', {
      qtype: 'cliente.id',
      query: id,
      oper: '=',
    }, request.ip)

    if (!cliente) {
      throw new AppError(404, 'Client not found')
    }

    const contratos = await ixcList<ClienteContratoItem>(creds, 'cliente_contrato', {
      qtype: 'cliente_contrato.id_cliente',
      query: id,
      oper: '=',
      page: '1',
      rp: '50',
      sortname: 'id',
      sortorder: 'asc',
    }, request.ip)

    return reply.send({
      ...normalizeClient(cliente),
      contratos: contratos.msg ?? [],
    })
  })
}
