import { supabase } from './supabase-client'
import { getAccessToken, refreshAccessToken } from './auth-client'
import { emitAppNavigate } from '@/components/NavigationEventBridge'

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '')
const inflightGetRequests = new Map<string, Promise<Response>>()
const GET_REQUEST_TTL_MS = 1500
const GET_RESPONSE_CACHE_TTL_MS = 10000
type CachedResponseEntry = {
  expiresAt: number
  status: number
  statusText: string
  headers: [string, string][]
  body: string
}
const cachedGetResponses = new Map<string, CachedResponseEntry>()

export class ApiRequestError extends Error {
  status?: number
  code: 'network' | 'auth' | 'server'

  constructor(message: string, code: 'network' | 'auth' | 'server', status?: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.code = code
    this.status = status
  }
}

async function requestWithToken(path: string, options: RequestInit | undefined, token?: string | null): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
}

function canDeduplicateRequest(options?: RequestInit): boolean {
  const method = (options?.method ?? 'GET').toUpperCase()
  return method === 'GET' && !options?.body && !options?.signal
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function getRequestCacheKey(path: string, token?: string | null) {
  return `${token ?? 'anonymous'}:${path}`
}

function buildResponseFromCache(entry: CachedResponseEntry) {
  return new Response(entry.body, {
    status: entry.status,
    statusText: entry.statusText,
    headers: new Headers(entry.headers),
  })
}

function getCachedResponse(path: string, token?: string | null): Response | null {
  const key = getRequestCacheKey(path, token)
  const entry = cachedGetResponses.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    cachedGetResponses.delete(key)
    return null
  }

  return buildResponseFromCache(entry)
}

async function cacheSuccessfulGetResponse(path: string, token: string | null | undefined, response: Response) {
  const key = getRequestCacheKey(path, token)
  const body = await response.clone().text()
  cachedGetResponses.set(key, {
    expiresAt: Date.now() + GET_RESPONSE_CACHE_TTL_MS,
    status: response.status,
    statusText: response.statusText,
    headers: Array.from(response.headers.entries()),
    body,
  })
}

async function deduplicatedRequest(path: string, options: RequestInit | undefined, token?: string | null): Promise<Response> {
  if (!canDeduplicateRequest(options)) {
    return requestWithToken(path, options, token)
  }

  const cached = getCachedResponse(path, token)
  if (cached) {
    return cached
  }

  const key = getRequestCacheKey(path, token)
  const existing = inflightGetRequests.get(key)
  if (existing) {
    const response = await existing
    return response.clone()
  }

  const requestPromise = requestWithToken(path, options, token)
  inflightGetRequests.set(key, requestPromise)

  try {
    const response = await requestPromise
    if (response.ok) {
      await cacheSuccessfulGetResponse(path, token, response)
    }
    return response.clone()
  } catch (error) {
    inflightGetRequests.delete(key)
    throw error
  } finally {
    window.setTimeout(() => {
      inflightGetRequests.delete(key)
    }, GET_REQUEST_TTL_MS)
  }
}

async function parseErrorBody(response: Response): Promise<string | null> {
  const text = await response.text().catch(() => '')
  if (!text) return null

  try {
    const json = JSON.parse(text) as { error?: string; message?: string; details?: string }
    return json.error || json.message || json.details || text
  } catch {
    return text
  }
}

export async function getApiErrorMessage(response: Response, fallback: string): Promise<string> {
  const parsed = await parseErrorBody(response)
  return parsed || fallback
}

export function getDisplayError(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) {
    return error.message
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = await getAccessToken()
  const shouldRetryNetwork = canDeduplicateRequest(options)

  let res: Response
  try {
    res = await deduplicatedRequest(path, options, token)
  } catch {
    if (shouldRetryNetwork) {
      for (const waitMs of [250, 700]) {
        await delay(waitMs)
        try {
          res = await deduplicatedRequest(path, options, token)
          break
        } catch {
          continue
        }
      }
    }

    if (!res!) {
      throw new ApiRequestError(
        'Nao foi possivel conectar com a API. Verifique se o backend esta ativo em http://localhost:3000.',
        'network'
      )
    }
  }

  if (res.status === 401) {
    const refreshedToken = await refreshAccessToken()
    if (refreshedToken) {
      try {
        res = await deduplicatedRequest(path, options, refreshedToken)
      } catch {
        throw new ApiRequestError(
          'Sua sessao foi renovada, mas a API nao respondeu. Confirme se o backend esta ativo.',
          'network'
        )
      }
    }

    if (res.status === 401) {
      await supabase.auth.signOut()
      emitAppNavigate({ to: '/login', replace: true })
      throw new ApiRequestError('Sua sessao expirou. Faca login novamente.', 'auth', 401)
    }
  }

  return res
}

export async function prefetchApi(path: string): Promise<void> {
  try {
    const response = await apiFetch(path)
    response.body?.cancel().catch(() => {})
  } catch {
    // background prefetch should never block the UI
  }
}
