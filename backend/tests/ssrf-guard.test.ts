import { describe, it, expect, vi, beforeEach } from 'vitest'
import { assertSafeUrl } from '../src/lib/ssrf-guard.js'

vi.mock('dns/promises', () => ({
  lookup: vi.fn(),
}))

import { lookup } from 'dns/promises'
const mockLookup = vi.mocked(lookup)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('assertSafeUrl', () => {
  it('rejects hostname that resolves to private IP 192.168.1.1', async () => {
    mockLookup.mockResolvedValue({ address: '192.168.1.1', family: 4 })
    await expect(assertSafeUrl('https://evil.example.com')).rejects.toMatchObject({
      statusCode: 422,
      message: 'Invalid URL',
    })
  })

  it('accepts hostname that resolves to a public IP', async () => {
    mockLookup.mockResolvedValue({ address: '8.8.8.8', family: 4 })
    await expect(assertSafeUrl('https://public.example.com')).resolves.toBeUndefined()
  })

  it('rejects HTTP (non-HTTPS) scheme', async () => {
    await expect(assertSafeUrl('http://example.com')).rejects.toMatchObject({
      statusCode: 422,
      message: 'Invalid URL',
    })
  })

  it('rejects loopback IP 127.0.0.1', async () => {
    mockLookup.mockResolvedValue({ address: '127.0.0.1', family: 4 })
    await expect(assertSafeUrl('https://localhost.example.com')).rejects.toMatchObject({
      statusCode: 422,
    })
  })

  it('rejects 10.x.x.x private IP', async () => {
    mockLookup.mockResolvedValue({ address: '10.0.0.1', family: 4 })
    await expect(assertSafeUrl('https://internal.example.com')).rejects.toMatchObject({
      statusCode: 422,
    })
  })
})
