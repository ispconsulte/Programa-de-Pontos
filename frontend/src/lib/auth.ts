import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

let cachedAccessToken: string | null | undefined
let sessionLoadPromise: Promise<string | null> | null = null
let subscribed = false

function syncSessionCache(session: Session | null) {
  cachedAccessToken = session?.access_token ?? null
}

function ensureSubscription() {
  if (subscribed || typeof window === 'undefined') return
  subscribed = true

  supabase.auth.onAuthStateChange((_event, session) => {
    syncSessionCache(session)
  })
}

export function getCachedAccessToken(): string | null | undefined {
  ensureSubscription()
  return cachedAccessToken
}

export async function getAccessToken(): Promise<string | null> {
  ensureSubscription()

  if (cachedAccessToken !== undefined) {
    return cachedAccessToken
  }

  if (!sessionLoadPromise) {
    sessionLoadPromise = supabase.auth.getSession()
      .then(({ data }) => {
        syncSessionCache(data.session)
        return cachedAccessToken ?? null
      })
      .finally(() => {
        sessionLoadPromise = null
      })
  }

  return sessionLoadPromise
}

export async function refreshAccessToken(): Promise<string | null> {
  ensureSubscription()
  const { data } = await supabase.auth.refreshSession()
  syncSessionCache(data.session)
  return cachedAccessToken ?? null
}

export async function isAuthenticatedAsync(): Promise<boolean> {
  return !!(await getAccessToken())
}

export async function logout() {
  syncSessionCache(null)
  await supabase.auth.signOut()
  window.location.replace('/login')
}
