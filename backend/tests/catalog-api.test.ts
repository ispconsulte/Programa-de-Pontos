import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRpcSingle = vi.fn()
const mockFrom = vi.fn()
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
      from: mockFrom,
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
    mockFrom.mockReset()
  })

  it('creates catalog items through the compatibility insert when the RPC is absent', async () => {
    const { default: handler } = await import('../../api/campaign/catalog/index.ts')
    const response = mockResponse()
    const mockInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({
          error: null,
          data: {
            id: 'gift-new',
            nome: 'Squeeze',
            descricao: 'Garrafa',
            pontos_necessarios: 20,
            estoque: 5,
            imagem_url: null,
            ativo: true,
          },
        })),
      })),
    }))

    mockRpcSingle.mockResolvedValueOnce({
      error: { message: 'Could not find the function public.catalog_item_secure_upsert' },
      data: null,
    })
    mockFrom.mockReturnValueOnce({ insert: mockInsert })

    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: JSON.stringify({
        name: 'Squeeze',
        description: 'Garrafa',
        requiredPoints: 20,
        stock: 5,
        imageUrl: null,
        active: true,
      }),
    }, response)

    expect(response.statusCode).toBe(201)
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: 'tenant-1',
      nome: 'Squeeze',
      pontos_necessarios: 20,
      estoque: 5,
    }))
  })

  it('returns a controlled conflict when catalog create violates a unique constraint', async () => {
    const { default: handler } = await import('../../api/campaign/catalog/index.ts')
    const response = mockResponse()

    mockRpcSingle.mockResolvedValueOnce({
      error: { message: 'Could not find the function public.catalog_item_secure_upsert' },
      data: null,
    })
    mockFrom.mockReturnValueOnce({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({
            error: { code: '23505', message: 'duplicate key value violates unique constraint' },
            data: null,
          })),
        })),
      })),
    })

    await handler({
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: {
        name: 'Squeeze',
        description: null,
        requiredPoints: 20,
        stock: 5,
        imageUrl: null,
        active: true,
      },
    }, response)

    expect(response.statusCode).toBe(409)
    expect(response.body).toEqual({ error: 'duplicate key value violates unique constraint' })
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
