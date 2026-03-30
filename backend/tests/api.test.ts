import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { Redis } from 'ioredis'

let app: FastifyInstance

beforeAll(async () => {
  process.env.DATABASE_URL = 'postgresql://ixcapi:ixcapi@localhost:5432/ixcapi_test'
  process.env.REDIS_URL = 'redis://localhost:6379'
  process.env.ENCRYPTION_KEY = '0'.repeat(64)
  process.env.NODE_ENV = 'test'
  process.env.SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_ANON_KEY = 'test-anon-key'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  process.env.JWT_PRIVATE_KEY_PATH = './backend/tests/fixtures/private.pem'
  process.env.JWT_PUBLIC_KEY_PATH = './backend/tests/fixtures/public.pem'

  const { buildApp } = await import('../src/server.js')

  // Provide a disconnected Redis stub so the app builds without a live Redis server
  const redisStub = new Redis({ lazyConnect: true, enableOfflineQueue: false }) as Redis
  app = await buildApp(redisStub)
})

afterAll(async () => {
  if (app) {
    await app.close()
  }
})

describe('GET /receivables without auth', () => {
  it('returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/receivables',
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /auth/register without bearer token', () => {
  it('returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: 'invalid-email',
        password: '123',
      },
    })
    expect(res.statusCode).toBe(401)
  })
})
