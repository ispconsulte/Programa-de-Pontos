import { AppError } from './app-error.js'

interface SupabaseAuthUser {
  id: string
  email?: string
}

interface SupabaseTokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  user?: SupabaseAuthUser
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new AppError(500, 'Supabase auth is not configured on server')
  }

  return {
    url: url.replace(/\/+$/, ''),
    anonKey,
  }
}

export async function getSupabaseUserFromAccessToken(accessToken: string): Promise<SupabaseAuthUser | null> {
  const { url, anonKey } = getSupabaseConfig()
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    return null
  }

  const user = await response.json() as SupabaseAuthUser
  if (!user?.id) {
    return null
  }

  return user
}

export async function supabasePasswordSignIn(email: string, password: string): Promise<SupabaseTokenResponse> {
  const { url, anonKey } = getSupabaseConfig()
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data?.access_token) {
    throw new AppError(401, 'Unauthorized')
  }

  return data as SupabaseTokenResponse
}

export async function supabaseRefreshSession(refreshToken: string): Promise<SupabaseTokenResponse> {
  const { url, anonKey } = getSupabaseConfig()
  const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data?.access_token) {
    throw new AppError(401, 'Unauthorized')
  }

  return data as SupabaseTokenResponse
}

