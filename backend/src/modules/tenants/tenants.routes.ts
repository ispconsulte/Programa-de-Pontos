import type { FastifyInstance } from 'fastify'
import { AppError } from '../../lib/app-error.js'
import { supabaseAdmin } from '../../lib/supabase-admin.js'
import { authenticate, requireAdmin } from '../../middleware/auth.js'

export async function tenantsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)
  app.addHook('preHandler', requireAdmin)

  app.get('/', {
    schema: {
      tags: ['Tenants'],
      summary: 'Listar empresas para full_admin',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    if (!request.isFullAdmin) {
      throw new AppError(403, 'Forbidden')
    }

    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('id, name')
      .order('name', { ascending: true })
      .limit(500)

    if (error) {
      throw new AppError(500, error.message)
    }

    return reply.send({ data: data ?? [] })
  })
}
