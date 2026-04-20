import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { pool } from '../db/pool.js'

type EndpointLimit = {
  category: 'search' | 'sync' | 'write' | 'report'
  limit: number
  windowSeconds: number
}

type LimitState = {
  count: number
  resetAt: number
}

type CachedResponse = {
  statusCode: number
  payload: string
  contentType?: string
}

const endpointLimits = new Map<string, LimitState>()
const idempotencyContext = new WeakMap<FastifyRequest, { key: string }>()
const idempotencyCache = new Map<string, { expiresAt: number; response: CachedResponse }>()

function parseUserIdFromBearer(request: FastifyRequest) {
  const authorization = request.headers.authorization
  if (!authorization?.startsWith('Bearer ')) return null

  const [, payload] = authorization.slice(7).split('.')
  if (!payload) return null

  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = JSON.parse(Buffer.from(normalized, 'base64').toString('utf8')) as { sub?: string }
    return typeof decoded.sub === 'string' && decoded.sub ? decoded.sub : null
  } catch {
    return null
  }
}

function getActorKey(request: FastifyRequest) {
  return parseUserIdFromBearer(request) ?? request.ip
}

async function logFloodBlock(
  request: FastifyRequest,
  attempts: number,
  actionTaken: string
) {
  await pool.query(
    `
      INSERT INTO flood_audit_log (
        user_id,
        ip_address,
        endpoint,
        attempts,
        first_attempt_at,
        last_attempt_at,
        action_taken
      )
      VALUES ($1, $2, $3, $4, now(), now(), $5)
    `,
    [
      parseUserIdFromBearer(request),
      request.ip,
      String(request.url ?? '').slice(0, 500),
      attempts,
      actionTaken,
    ]
  ).catch(() => {})
}

function getRoutePath(request: FastifyRequest) {
  return request.routeOptions.url ?? request.url.split('?')[0] ?? '/'
}

function classifyEndpoint(request: FastifyRequest): EndpointLimit | null {
  const method = request.method.toUpperCase()
  const path = getRoutePath(request).toLowerCase()

  if (path.includes('export') || path.includes('report') || path.includes('relatorio')) {
    return { category: 'report', limit: 5, windowSeconds: 60 }
  }

  if (
    path.includes('refresh') ||
    path.includes('reload') ||
    path.includes('sync') ||
    path.includes('sincronizar')
  ) {
    return { category: 'sync', limit: 10, windowSeconds: 60 }
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return { category: 'write', limit: 20, windowSeconds: 60 }
  }

  if (
    method === 'GET' ||
    path.includes('search') ||
    path.includes('load') ||
    path.includes('buscar') ||
    path.includes('carregar')
  ) {
    return { category: 'search', limit: 30, windowSeconds: 60 }
  }

  return null
}

function setRateLimitHeaders(
  reply: FastifyReply,
  limit: number,
  remaining: number,
  resetAt: number,
  retryAfter?: number
) {
  reply.header('X-RateLimit-Limit', limit)
  reply.header('X-RateLimit-Remaining', Math.max(0, remaining))
  reply.header('X-RateLimit-Reset', resetAt)
  if (retryAfter !== undefined) reply.header('Retry-After', retryAfter)
}

async function consumeEndpointLimit(
  app: FastifyInstance,
  key: string,
  limit: number,
  windowSeconds: number
) {
  const now = Date.now()

  if (app.redis) {
    const count = await app.redis.incr(key)
    if (count === 1) await app.redis.expire(key, windowSeconds)
    const ttl = await app.redis.ttl(key)
    const retryAfter = ttl > 0 ? ttl : windowSeconds
    return {
      count,
      remaining: limit - count,
      resetAt: Math.ceil((now + retryAfter * 1000) / 1000),
      retryAfter,
    }
  }

  const current = endpointLimits.get(key)
  if (!current || current.resetAt <= now) {
    const resetAt = now + windowSeconds * 1000
    endpointLimits.set(key, { count: 1, resetAt })
    return {
      count: 1,
      remaining: limit - 1,
      resetAt: Math.ceil(resetAt / 1000),
      retryAfter: windowSeconds,
    }
  }

  current.count += 1
  return {
    count: current.count,
    remaining: limit - current.count,
    resetAt: Math.ceil(current.resetAt / 1000),
    retryAfter: Math.ceil((current.resetAt - now) / 1000),
  }
}

export function registerEndpointRateLimit(app: FastifyInstance) {
  app.addHook('preHandler', async (request, reply) => {
    const endpointLimit = classifyEndpoint(request)
    if (!endpointLimit) return

    const routeKey = `${getActorKey(request)}_${request.method}_${getRoutePath(request)}_${endpointLimit.category}`
    const key = `endpoint-rate-limit:${routeKey}`
    const result = await consumeEndpointLimit(
      app,
      key,
      endpointLimit.limit,
      endpointLimit.windowSeconds
    )

    setRateLimitHeaders(
      reply,
      endpointLimit.limit,
      result.remaining,
      result.resetAt,
      result.count > endpointLimit.limit ? result.retryAfter : undefined
    )

    if (result.count > endpointLimit.limit) {
      await logFloodBlock(request, result.count, 'rate_limit')
      return reply.status(429).send({
        error: 'too_many_requests',
        message: 'Muitas requisições em pouco tempo. Aguarde alguns segundos.',
        retryAfter: result.retryAfter,
        limit: endpointLimit.limit,
        window: `${endpointLimit.windowSeconds}s`,
      })
    }
  })
}

function isIdempotentCreateCandidate(request: FastifyRequest) {
  const path = getRoutePath(request).toLowerCase()
  return request.method.toUpperCase() === 'POST' && !path.startsWith('/auth/')
}

async function getCachedIdempotencyResponse(app: FastifyInstance, key: string) {
  if (app.redis) {
    const cached = await app.redis.get(key)
    return cached ? (JSON.parse(cached) as CachedResponse) : null
  }

  const cached = idempotencyCache.get(key)
  if (!cached || cached.expiresAt <= Date.now()) {
    idempotencyCache.delete(key)
    return null
  }
  return cached.response
}

async function setCachedIdempotencyResponse(
  app: FastifyInstance,
  key: string,
  response: CachedResponse
) {
  if (app.redis) {
    await app.redis.setex(key, 86_400, JSON.stringify(response))
    return
  }

  idempotencyCache.set(key, {
    expiresAt: Date.now() + 86_400_000,
    response,
  })
}

export function registerIdempotencyCache(app: FastifyInstance) {
  app.addHook('preHandler', async (request, reply) => {
    if (!isIdempotentCreateCandidate(request)) return

    const rawKey = request.headers['idempotency-key']
    const idempotencyKey = Array.isArray(rawKey) ? rawKey[0] : rawKey
    if (!idempotencyKey) return

    const cacheKey = `idempotency:${getActorKey(request)}:${request.method}:${getRoutePath(request)}:${idempotencyKey}`
    const cached = await getCachedIdempotencyResponse(app, cacheKey)
    if (cached) {
      reply.header('X-Idempotency-Cache', 'HIT')
      if (cached.contentType) reply.header('Content-Type', cached.contentType)
      return reply.status(cached.statusCode).send(cached.payload)
    }

    idempotencyContext.set(request, { key: cacheKey })
  })

  app.addHook('onSend', async (request, reply, payload) => {
    const context = idempotencyContext.get(request)
    if (!context || reply.statusCode < 200 || reply.statusCode >= 300) return payload

    const contentType = reply.getHeader('content-type')
    await setCachedIdempotencyResponse(app, context.key, {
      statusCode: reply.statusCode,
      payload: Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload),
      contentType: typeof contentType === 'string' ? contentType : undefined,
    })

    return payload
  })
}
