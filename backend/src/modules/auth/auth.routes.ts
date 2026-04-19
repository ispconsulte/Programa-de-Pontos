import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { AppError } from '../../lib/app-error.js'
import { supabaseAdmin } from '../../lib/supabase-admin.js'
import {
  getSupabaseUserFromAccessToken,
  supabasePasswordSignIn,
  supabaseRefreshSession,
} from '../../lib/supabase.js'

const registerSchema = z.object({
  tenantName: z.string().min(1).optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

const refreshSchema = z.object({
  refreshToken: z.string(),
})

async function ensureTenantForSupabaseUser(userId: string, email: string, tenantNameOverride?: string) {
  if (!userId || !email) {
    throw new AppError(401, 'Unauthorized')
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('users')
    .select('id, tenant_id')
    .eq('id', userId)
    .maybeSingle()

  if (existingError) {
    throw new AppError(500, existingError.message)
  }

  if (existing) {
    return {
      tenantId: existing.tenant_id,
      userId: existing.id,
      created: false,
    }
  }

  const { data: legacy, error: legacyError } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .limit(1)

  if (legacyError) {
    throw new AppError(500, legacyError.message)
  }

  if ((legacy?.length ?? 0) > 0) {
    throw new AppError(409, 'User already exists')
  }

  const tenantName = tenantNameOverride?.trim() || (email.split('@')[1] ?? email)
  let tenantId: string | null = null
  try {
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert({ name: tenantName })
      .select('id')
      .single()

    if (tenantError || !tenant) {
      throw new AppError(500, tenantError?.message || 'Failed to create tenant')
    }
    tenantId = tenant.id

    const { error: userInsertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        tenant_id: tenantId,
        email,
        role: 'admin',
      })

    if (userInsertError) {
      throw new AppError(500, userInsertError.message)
    }

    return {
      tenantId,
      userId,
      created: true,
    }
  } catch (err) {
    const maybeAppError = err as AppError
    if (tenantId) {
      await supabaseAdmin.from('tenants').delete().eq('id', tenantId)
    }
    if (maybeAppError.statusCode === 500 && maybeAppError.message.toLowerCase().includes('duplicate')) {
      throw new AppError(409, 'User already exists')
    }
    throw err
  }
}

async function getSupabaseUserFromAuthorizationHeader(authorizationHeader?: string) {
  const token = authorizationHeader?.startsWith('Bearer ')
    ? authorizationHeader.slice('Bearer '.length).trim()
    : ''
  if (!token) {
    throw new AppError(401, 'Missing Supabase bearer token')
  }

  const user = await getSupabaseUserFromAccessToken(token)
  if (!user?.id || !user.email) {
    throw new AppError(401, 'Unauthorized')
  }

  return {
    id: user.id,
    email: user.email,
  }
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute',
      },
    },
    schema: {
      tags: ['Auth'],
      summary: 'Bootstrap do usuário Supabase no banco da aplicação',
      body: {
        type: 'object',
        properties: {
          tenantName: { type: 'string', example: 'Minha Telecom' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            tenantId: { type: 'string' },
            userId: { type: 'string' },
            email: { type: 'string' },
            created: { type: 'boolean' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const body = registerSchema.parse((request.body ?? {}) as unknown)
    const user = await getSupabaseUserFromAuthorizationHeader(request.headers.authorization)
    const ensured = await ensureTenantForSupabaseUser(user.id, user.email, body.tenantName)

    return reply.send({
      tenantId: ensured.tenantId,
      userId: ensured.userId,
      email: user.email,
      created: ensured.created,
    })
  })

  app.post('/login', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute',
        keyGenerator(request) {
          const body = (request.body ?? {}) as { email?: string }
          const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
          return email ? `ratelimit:auth:login:${request.ip}:${email}` : `ratelimit:auth:login:${request.ip}`
        },
      },
    },
    schema: {
      tags: ['Auth'],
      summary: 'Autenticar e obter tokens JWT',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', example: 'admin@minhatelecom.com.br' },
          password: { type: 'string', example: 'senha123!' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const body = loginSchema.parse(request.body)
    const session = await supabasePasswordSignIn(body.email, body.password)
    const userId = session.user?.id
    const userEmail = session.user?.email ?? body.email
    await ensureTenantForSupabaseUser(userId ?? '', userEmail)

    return reply.send({
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
    })
  })

  app.post('/refresh', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
    schema: {
      tags: ['Auth'],
      summary: 'Rotacionar refresh token',
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: { refreshToken: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const body = refreshSchema.parse(request.body)
    const session = await supabaseRefreshSession(body.refreshToken)
    const refreshedUser =
      session.user?.id && session.user?.email
        ? session.user
        : await getSupabaseUserFromAccessToken(session.access_token)

    await ensureTenantForSupabaseUser(refreshedUser?.id ?? '', refreshedUser?.email ?? '')

    return reply.send({
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
    })
  })

  app.delete('/logout', {
    schema: {
      tags: ['Auth'],
      summary: 'Invalidar refresh token (logout)',
      security: [{ bearerAuth: [] }],
      response: { 204: { type: 'null' } },
    },
  }, async (_request, reply) => {
    return reply.status(204).send()
  })
}
