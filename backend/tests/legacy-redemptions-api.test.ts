import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRpcSingle = vi.fn()

const mockResponse = () => {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
  }

  return {
    ...response,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: unknown) {
      this.body = payload
      return this
    },
  }
}

vi.mock('../../api/_lib/auth', () => ({
  authenticateRequest: vi.fn(async () => ({
    userId: 'user-1',
    tenantId: 'tenant-1',
    userRole: 'admin',
  })),
}))

vi.mock('../../api/_lib/supabase', () => {
  return {
    supabaseAdmin: {
      from: vi.fn(),
      rpc: vi.fn(() => ({
        single: mockRpcSingle,
      })),
    },
  }
})

describe('legacy redemption API handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers the redemption through the atomic RPC flow', async () => {
    const { default: handler } = await import('../../api/campaign/legacy-redemptions.ts')
    const response = mockResponse()

    mockRpcSingle.mockResolvedValueOnce({
      error: null,
      data: {
        redemption: {
          id: 'redemption-1',
          brinde_nome: 'Caneca',
          pontos_utilizados: 30,
          status_resgate: 'entregue',
        },
        remaining_points: 70,
        remaining_stock: 4,
      },
    })

    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: JSON.stringify({
        clientId: '11111111-1111-1111-1111-111111111111',
        rewardId: '22222222-2222-2222-2222-222222222222',
        responsible: 'Operador Teste',
        notes: 'Entrega no balcão',
      }),
    }, response)

    expect(response.statusCode).toBe(201)
    expect(response.body).toEqual({
      redemption: {
        id: 'redemption-1',
        brinde_nome: 'Caneca',
        pontos_utilizados: 30,
        status_resgate: 'entregue',
      },
      remainingPoints: 70,
      remainingStock: 4,
    })
  })

  it('maps business conflicts without returning 500', async () => {
    const { default: handler } = await import('../../api/campaign/legacy-redemptions.ts')
    const response = mockResponse()

    mockRpcSingle.mockResolvedValueOnce({
      error: { message: 'O cliente não possui pontos suficientes' },
      data: null,
    })

    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: {
        clientId: '11111111-1111-1111-1111-111111111111',
        rewardId: '22222222-2222-2222-2222-222222222222',
        responsible: 'Operador Teste',
      },
    }, response)

    expect(response.statusCode).toBe(409)
    expect(response.body).toEqual({ error: 'O cliente não possui pontos suficientes' })
  })
})
