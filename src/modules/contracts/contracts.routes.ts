import type { FastifyInstance } from 'fastify'
import { authenticate, loadTenantCredentialsForRequest, requireAdmin } from '../../middleware/auth.js'
import { ixcFindOneByField, type ClienteContratoItem } from '../../lib/ixc-proxy.js'
import { AppError } from '../../lib/app-error.js'

export async function contractsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)
  app.addHook('preHandler', requireAdmin)

  app.get('/:id', {
    schema: {
      tags: ['Contracts'],
      summary: 'Buscar contrato por ID',
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

    const contract = await ixcFindOneByField<ClienteContratoItem>(creds, 'cliente_contrato', {
      qtype: 'cliente_contrato.id',
      query: id,
      oper: '=',
    }, request.ip)

    if (!contract) {
      throw new AppError(404, 'Contract not found')
    }
    return reply.send(contract)
  })
}
