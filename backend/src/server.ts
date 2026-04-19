import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { Redis } from 'ioredis'
import { authRoutes } from './modules/auth/auth.routes.js'
import { receivablesRoutes } from './modules/receivables/receivables.routes.js'
import { contractsRoutes } from './modules/contracts/contracts.routes.js'
import { clientsRoutes } from './modules/clients/clients.routes.js'
import { settingsRoutes } from './modules/settings/settings.routes.js'
import { campaignRoutes } from './modules/campaign/campaign.routes.js'
import { usersRoutes } from './modules/users/users.routes.js'
import { AppError } from './lib/app-error.js'

export async function buildApp(redisClient?: Redis) {
  const useRedisRateLimit = process.env.NODE_ENV === 'production'
  const isProduction = process.env.NODE_ENV === 'production'

  const redis =
    useRedisRateLimit
      ? (redisClient ??
        new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
        }))
      : undefined

  const app = Fastify({
    logger:
      process.env.NODE_ENV === 'test'
        ? false
        : {
            level: process.env.NODE_ENV === 'production' ? 'info' : 'warn',
          },
    trustProxy: true,
    ajv: {
      customOptions: {
        strict: 'log',
        keywords: ['example'],
      },
    },
  })

  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  if (isProduction && allowedOrigins.length === 0) {
    throw new Error('ALLOWED_ORIGINS must be configured in production')
  }

  await app.register(cors, {
    origin(origin, callback) {
      if (!isProduction) {
        callback(null, true)
        return
      }

      if (!origin) {
        callback(null, true)
        return
      }

      callback(null, allowedOrigins.includes(origin))
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-IXC-Connection-Id'],
    credentials: true,
  })

  // Swagger docs — only in non-production
  if (process.env.NODE_ENV !== 'production') {
    await app.register(swagger, {
      openapi: {
        info: {
          title: 'IXC Integration API',
          description: 'Proxy multi-tenant para o ERP IXCSoft — Fase 1',
          version: '1.0.0',
        },
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
      },
    })

    await app.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
        persistAuthorization: true,
      },
    })
  }

  await app.register(helmet, {
    contentSecurityPolicy: isProduction ? undefined : false,
    hsts: { maxAge: 31536000, includeSubDomains: true },
  })

  const rateLimitOptions: Parameters<typeof rateLimit>[1] = {
    keyGenerator(request) {
      const tenantId = (request as unknown as { tenantId?: string }).tenantId
      return tenantId ? `ratelimit:${tenantId}` : `ratelimit:ip:${request.ip}`
    },
    max: 60,
    timeWindow: '1 minute',
    errorResponseBuilder(_req, context) {
      return {
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
        retryAfter: Math.ceil(context.ttl / 1000),
      }
    },
  }
  // Only attach Redis store when not in test mode (avoids failures when Redis is unavailable)
  if (useRedisRateLimit && redis) {
    rateLimitOptions.redis = redis
  }
  await app.register(rateLimit, rateLimitOptions)

  app.decorate('redis', redis ?? null)

  app.addHook('onRequest', (request, reply, done) => {
    const contentType = request.headers['content-type']
    if (typeof contentType === 'string' && contentType.includes('\t')) {
      reply.status(400).send({ error: 'Invalid Content-Type header' })
      return
    }

    done()
  })

  app.setErrorHandler((error, _request, reply) => {
    const asAppErr = error as AppError
    const asDbErr = error as { code?: string; message?: string }
    const dbMessage = (asDbErr.message ?? '').toLowerCase()
    const isDbUnavailable =
      (asDbErr.code === 'XX000' &&
        dbMessage.includes('unable to establish connection to upstream database')) ||
      dbMessage.includes('connection terminated unexpectedly') ||
      dbMessage.includes('circuit breaker open')

    if (isDbUnavailable) {
      return reply.status(503).send({
        error: 'Database temporarily unavailable. Please try again in a few moments.',
      })
    }

    if (
      error instanceof AppError ||
      asAppErr.name === 'AppError' ||
      (typeof asAppErr.statusCode === 'number' && asAppErr.statusCode >= 400 && asAppErr.statusCode < 600)
    ) {
      if (asAppErr.statusCode >= 500) {
        app.log.error(error)
        return reply.status(asAppErr.statusCode).send({ error: 'Internal Server Error' })
      }

      return reply.status(asAppErr.statusCode).send({ error: asAppErr.message })
    }

    if (error.validation) {
      const details = Array.isArray(error.validation)
        ? error.validation.map((issue) => ({
            field:
              typeof issue.instancePath === 'string' && issue.instancePath
                ? issue.instancePath
                : issue.params && typeof issue.params.missingProperty === 'string'
                  ? issue.params.missingProperty
                  : undefined,
            message: typeof issue.message === 'string' ? issue.message : 'Invalid value',
          }))
        : undefined

      return reply.status(400).send({ error: 'Validation error', details })
    }

    app.log.error(error)
    const message =
      process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message
    return reply.status(500).send({ error: message })
  })

  await app.register(authRoutes, { prefix: '/auth' })
  await app.register(receivablesRoutes, { prefix: '/receivables' })
  await app.register(contractsRoutes, { prefix: '/contracts' })
  await app.register(clientsRoutes, { prefix: '/clients' })
  await app.register(settingsRoutes, { prefix: '/settings' })
  await app.register(campaignRoutes, { prefix: '/campaign' })
  await app.register(usersRoutes, { prefix: '/users' })

  return app
}

async function start() {
  const app = await buildApp()
  const port = parseInt(process.env.PORT ?? '3000', 10)
  await app.listen({ port, host: '0.0.0.0' })
}

// Only auto-start when this file is run directly (not imported by tests)
const isMain =
  process.argv[1]?.endsWith('server.ts') ||
  process.argv[1]?.endsWith('server.js') ||
  process.argv[1]?.endsWith('dist/server.js')

if (isMain) {
  start().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
