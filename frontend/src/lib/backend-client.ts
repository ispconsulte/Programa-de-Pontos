import { supabase } from '@/lib/supabase-client'
import { friendlyError } from '@/lib/friendly-errors'
import { watchdogFetch } from '@/utils/requestWatchdog'

function resolveApiBaseUrl(): string {
  const explicit = import.meta.env.VITE_API_BASE_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]') {
      return 'http://localhost:3000'
    }
  }

  return ''
}

function buildUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const base = resolveApiBaseUrl()
  return `${base}${normalizedPath}`
}

export async function backendRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const accessToken = data.session?.access_token

  if (!accessToken) {
    throw new Error('Sessão inválida. Faça login novamente.')
  }

  const headers = new Headers(init.headers ?? {})
  headers.set('Authorization', `Bearer ${accessToken}`)

  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData
  if (!isFormData && init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response
  try {
    response = await watchdogFetch(buildUrl(path), {
      ...init,
      headers,
    }, path.includes('refresh') ? 'refresh' : init.method && init.method !== 'GET' ? 'submit' : 'load')
  } catch (networkError) {
    const rawMsg = networkError instanceof Error ? networkError.message : 'Failed to fetch'
    throw new Error(friendlyError(rawMsg, { action: init.method && init.method !== 'GET' ? 'save' : 'load', path }))
  }

  if (response.status === 204) {
    return undefined as T
  }

  const payload = await response.json().catch(() => null) as { error?: string } | null
  if (!response.ok) {
    const serverMsg = payload?.error || `Falha na requisição (${response.status})`
    throw new Error(friendlyError(serverMsg, {
      action: init.method && init.method !== 'GET' ? 'save' : 'load',
      status: response.status,
      path,
    }))
  }

  return payload as T
}
