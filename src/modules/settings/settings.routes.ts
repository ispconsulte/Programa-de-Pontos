import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { AppError } from '../../lib/app-error.js'
import { encrypt } from '../../lib/crypto.js'
import { activateTenantIxcConnection, listTenantIxcConnections, loadTenantIxcConnection } from '../../lib/ixc-connections.js'
import { assertSafeUrl } from '../../lib/ssrf-guard.js'
import { supabaseAdmin, toByteaHex } from '../../lib/supabase-admin.js'
import { authenticate } from '../../middleware/auth.js'

const updateSchema = z.object({
  tenantName: z.string().min(1).optional(),
  ixcConnectionId: z.string().uuid().optional(),
  connectionName: z.string().min(1).optional(),
  ixcBaseUrl: z.string().url(),
  ixcUser: z.string().min(1),
  ixcToken: z.string().optional(),
})

const connectionCreateSchema = z.object({
  name: z.string().min(1),
  ixcBaseUrl: z.string().url(),
  ixcUser: z.string().min(1),
  ixcToken: z.string().min(1),
  active: z.boolean().optional(),
})

const connectionUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  ixcBaseUrl: z.string().url().optional(),
  ixcUser: z.string().min(1).optional(),
  ixcToken: z.string().optional(),
  active: z.boolean().optional(),
})

export async function settingsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate)

  app.get('/', {
    schema: {
      tags: ['Settings'],
      summary: 'Obter configurações ativas do tenant',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('name')
      .eq('id', request.tenantId)
      .maybeSingle()

    if (error) {
      throw new AppError(500, 'Failed to load tenant settings')
    }
    if (!data) {
      return reply.status(404).send({ error: 'Tenant not found' })
    }

    const connections = await listTenantIxcConnections(request.tenantId)
    const activeConnection = connections.find((connection) => connection.active) ?? connections[0] ?? null

    return reply.send({
      name: data.name,
      ixc_base_url: activeConnection?.ixc_base_url ?? null,
      ixc_user: activeConnection?.ixc_user ?? null,
      ixc_configured: Boolean(activeConnection),
      ixc_connection_id: activeConnection?.id ?? null,
      ixc_connection_name: activeConnection?.name ?? null,
      ixc_connections_count: connections.length,
    })
  })

  app.put('/', {
    schema: {
      tags: ['Settings'],
      summary: 'Salvar configuracao IXC ativa do tenant',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['ixcBaseUrl', 'ixcUser'],
        properties: {
          tenantName: { type: 'string', example: 'Minha Telecom' },
          ixcConnectionId: { type: 'string' },
          connectionName: { type: 'string', example: 'default' },
          ixcBaseUrl: { type: 'string', example: 'https://ixc.minhatelecom.com.br' },
          ixcUser: { type: 'string', example: 'api_user' },
          ixcToken: { type: 'string', example: 'meu-token-ixc' },
        },
      },
    },
  }, async (request, reply) => {
    const body = updateSchema.parse(request.body)

    await assertSafeUrl(body.ixcBaseUrl)

    const existingConnections = await listTenantIxcConnections(request.tenantId)
    const targetConnection =
      body.ixcConnectionId
        ? existingConnections.find((connection) => connection.id === body.ixcConnectionId)
        : existingConnections.find((connection) => connection.active) ?? existingConnections[0]

    const connectionName = body.connectionName ?? targetConnection?.name ?? 'default'
    if (body.tenantName) {
      const { error: tenantError } = await supabaseAdmin
        .from('tenants')
        .update({ name: body.tenantName })
        .eq('id', request.tenantId)

      if (tenantError) {
        throw new AppError(500, tenantError.message)
      }
    }

    if (targetConnection) {
      if (body.ixcToken) {
        const { enc, iv } = encrypt(body.ixcToken)
        const { error: connectionError } = await supabaseAdmin
          .from('ixc_connections')
          .update({
            name: connectionName,
            ixc_base_url: body.ixcBaseUrl,
            ixc_user: body.ixcUser,
            ixc_token_enc: toByteaHex(enc),
            ixc_token_iv: toByteaHex(iv),
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', request.tenantId)
          .eq('id', targetConnection.id)

        if (connectionError) {
          throw new AppError(500, connectionError.message)
        }
      } else {
        const { error: connectionError } = await supabaseAdmin
          .from('ixc_connections')
          .update({
            name: connectionName,
            ixc_base_url: body.ixcBaseUrl,
            ixc_user: body.ixcUser,
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', request.tenantId)
          .eq('id', targetConnection.id)

        if (connectionError) {
          throw new AppError(500, connectionError.message)
        }
      }
    } else {
      if (!body.ixcToken) {
        throw new AppError(400, 'ixcToken is required when creating the first IXC connection')
      }

      const { enc, iv } = encrypt(body.ixcToken)
      const { error: insertError } = await supabaseAdmin
        .from('ixc_connections')
        .insert({
          tenant_id: request.tenantId,
          name: connectionName,
          ixc_base_url: body.ixcBaseUrl,
          ixc_user: body.ixcUser,
          ixc_token_enc: toByteaHex(enc),
          ixc_token_iv: toByteaHex(iv),
          active: true,
        })

      if (insertError) {
        throw new AppError(500, insertError.message)
      }
    }

    return reply.status(204).send()
  })

  app.get('/ixc/connections', {
    schema: {
      tags: ['Settings'],
      summary: 'Listar conexoes IXC do tenant',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const connections = await listTenantIxcConnections(request.tenantId)
    return reply.send({
      data: connections.map((connection) => ({
        id: connection.id,
        name: connection.name,
        ixc_base_url: connection.ixc_base_url,
        ixc_user: connection.ixc_user,
        active: connection.active,
        created_at: connection.created_at ?? null,
        updated_at: connection.updated_at ?? null,
      })),
    })
  })

  app.post('/ixc/connections', {
    schema: {
      tags: ['Settings'],
      summary: 'Criar conexao IXC',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const body = connectionCreateSchema.parse(request.body)
    await assertSafeUrl(body.ixcBaseUrl)

    const { enc, iv } = encrypt(body.ixcToken)
    if (body.active) {
      const { error: clearError } = await supabaseAdmin
        .from('ixc_connections')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('tenant_id', request.tenantId)
        .eq('active', true)

      if (clearError) {
        throw new AppError(500, clearError.message)
      }
    }

    const { data, error: insertError } = await supabaseAdmin
      .from('ixc_connections')
      .insert({
        tenant_id: request.tenantId,
        name: body.name,
        ixc_base_url: body.ixcBaseUrl,
        ixc_user: body.ixcUser,
        ixc_token_enc: toByteaHex(enc),
        ixc_token_iv: toByteaHex(iv),
        active: body.active ?? false,
      })
      .select('id')
      .single()

    if (insertError || !data) {
      throw new AppError(500, insertError?.message ?? 'Failed to create IXC connection')
    }

    return reply.status(201).send({ id: data.id })
  })

  app.put('/ixc/connections/:id', {
    schema: {
      tags: ['Settings'],
      summary: 'Atualizar conexao IXC',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = connectionUpdateSchema.parse(request.body)

    const current = await loadTenantIxcConnection(request.tenantId, id)

    const nextName = body.name ?? current.name
    const nextBaseUrl = body.ixcBaseUrl ?? current.ixc_base_url
    const nextUser = body.ixcUser ?? current.ixc_user

    await assertSafeUrl(nextBaseUrl)
    if (body.active === true) {
      const { error: clearError } = await supabaseAdmin
        .from('ixc_connections')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('tenant_id', request.tenantId)
        .eq('active', true)

      if (clearError) {
        throw new AppError(500, clearError.message)
      }
    }

    if (body.ixcToken) {
      const { enc, iv } = encrypt(body.ixcToken)
      const { error: updateError } = await supabaseAdmin
        .from('ixc_connections')
        .update({
          name: nextName,
          ixc_base_url: nextBaseUrl,
          ixc_user: nextUser,
          ixc_token_enc: toByteaHex(enc),
          ixc_token_iv: toByteaHex(iv),
          ...(body.active !== undefined ? { active: body.active } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', request.tenantId)
        .eq('id', id)

      if (updateError) {
        throw new AppError(500, updateError.message)
      }
    } else {
      const { error: updateError } = await supabaseAdmin
        .from('ixc_connections')
        .update({
          name: nextName,
          ixc_base_url: nextBaseUrl,
          ixc_user: nextUser,
          ...(body.active !== undefined ? { active: body.active } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', request.tenantId)
        .eq('id', id)

      if (updateError) {
        throw new AppError(500, updateError.message)
      }
    }

    return reply.status(204).send()
  })

  app.post('/ixc/connections/:id/activate', {
    schema: {
      tags: ['Settings'],
      summary: 'Ativar conexao IXC',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await activateTenantIxcConnection(request.tenantId, id)
    return reply.status(204).send()
  })
}
