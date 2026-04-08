import { supabase } from '@/lib/supabase-client'

function resolveApiBaseUrl(): string {
  const explicit = import.meta.env.VITE_API_BASE_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')

  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3000'
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

  const response = await fetch(buildUrl(path), {
    ...init,
    headers,
  })

  if (response.status === 204) {
    return undefined as T
  }

  const payload = await response.json().catch(() => null) as { error?: string } | null
  if (!response.ok) {
    throw new Error(payload?.error || `Falha na requisição (${response.status})`)
  }

  return payload as T
}
