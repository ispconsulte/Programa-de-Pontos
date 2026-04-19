import { supabase } from '@/lib/supabase-client'

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

/** Friendly error messages for common network/backend failures */
function friendlyErrorMessage(raw: string, status?: number): string {
  const lower = raw.toLowerCase()

  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('load failed')) {
    return 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.'
  }
  if (lower.includes('timeout') || lower.includes('aborted')) {
    return 'A requisição demorou demais. Tente novamente em alguns instantes.'
  }
  if (status === 401 || lower.includes('unauthorized') || lower.includes('session')) {
    return 'Sua sessão expirou. Faça login novamente.'
  }
  if (status === 403 || lower.includes('forbidden') || lower.includes('user disabled')) {
    return 'Você não tem permissão para acessar este recurso.'
  }
  if (status === 404) {
    return 'O recurso solicitado não foi encontrado.'
  }
  if (status === 409) {
    if (lower.includes('ixc') && (lower.includes('config') || lower.includes('integra'))) {
      return 'A integração IXC ainda não foi configurada. Acesse Administração > Empresa para configurar.'
    }

    if (raw.length < 200) {
      return raw
    }
  }
  if (status && status >= 500) {
    return 'Ocorreu um erro interno no servidor. Tente novamente em alguns instantes.'
  }

  // Return the original if it's already user-friendly (Portuguese)
  if (/^[A-ZÁÉÍÓÚÃÕÂÊÎÔÛÇ]/.test(raw) && raw.length < 200) {
    return raw
  }

  return 'Ocorreu um erro inesperado. Tente novamente.'
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
    response = await fetch(buildUrl(path), {
      ...init,
      headers,
    })
  } catch (networkError) {
    const rawMsg = networkError instanceof Error ? networkError.message : 'Failed to fetch'
    throw new Error(friendlyErrorMessage(rawMsg))
  }

  if (response.status === 204) {
    return undefined as T
  }

  const payload = await response.json().catch(() => null) as { error?: string } | null
  if (!response.ok) {
    const serverMsg = payload?.error || `Falha na requisição (${response.status})`
    throw new Error(friendlyErrorMessage(serverMsg, response.status))
  }

  return payload as T
}
