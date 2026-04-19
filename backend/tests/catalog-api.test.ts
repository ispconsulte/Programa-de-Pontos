import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRpcSingle = vi.fn()
const mockResponse = () => {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: unknown) {
      this.body = payload
      return this
    },
    end() {
      this.body = undefined
      return this
    },
  }

  return response
}

vi.mock('../../api/_lib/auth', () => ({
  authenticateRequest: vi.fn(async () => ({
    userId: 'user-1',
    tenantId: 'tenant-1',
    userRole: 'admin',
  })),
  assertAdmin: vi.fn(),
}))

vi.mock('../../api/_lib/supabase', () => {
  return {
    supabaseAdmin: {
      rpc: vi.fn(() => ({
        single: mockRpcSingle,
      })),
    },
    isAdminRole: (role: string | null | undefined) => ['admin', 'owner', 'manager'].includes(String(role ?? '').toLowerCase()),
  }
})

describe('catalog item API handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpcSingle.mockResolvedValue({
      error: null,
      data: {
        id: 'gift-1',
        nome: 'Mousepad Premium',
        imagem_url: 'data:image/png;base64,abc123',
      },
    })
  })

  it('accepts PUT updates and preserves image payloads', async () => {
    const { default: handler } = await import('../../api/campaign/catalog/[id].ts')
    const response = mockResponse()
    const imageUrl = 'data:image/png;base64,abc123'

    const request = {
      method: 'PUT',
      query: { id: 'gift-1' },
      headers: { authorization: 'Bearer token' },
      body: JSON.stringify({
        name: 'Mousepad Premium',
        description: 'Nova arte',
        requiredPoints: 80,
        stock: 12,
        imageUrl,
        active: true,
      }),
    }

    await handler(request, response)

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({
      id: 'gift-1',
      nome: 'Mousepad Premium',
      imagem_url: imageUrl,
    })
  })

  it('keeps PATCH compatibility for updates', async () => {
    const { default: handler } = await import('../../api/campaign/catalog/[id].ts')
    const response = mockResponse()

    const request = {
      method: 'PATCH',
      query: { id: 'gift-2' },
      headers: { authorization: 'Bearer token' },
      body: {
        name: 'Caneca',
        description: null,
        requiredPoints: 30,
        stock: null,
        imageUrl: null,
        active: false,
      },
    }

    mockRpcSingle.mockResolvedValueOnce({
      error: null,
      data: {
        id: 'gift-2',
        nome: 'Caneca',
        imagem_url: null,
      },
    })

    await handler(request, response)

    expect(response.statusCode).toBe(200)
  })

  it('deletes catalog items successfully', async () => {
    const { default: handler } = await import('../../api/campaign/catalog/[id].ts')
    const response = mockResponse()
    mockRpcSingle.mockResolvedValueOnce({ error: null, data: null })

    const request = {
      method: 'DELETE',
      query: { id: 'gift-3' },
      headers: { authorization: 'Bearer token' },
    }

    await handler(request, response)

    expect(response.statusCode).toBe(204)
    expect(response.body).toBeUndefined()
  })
})
