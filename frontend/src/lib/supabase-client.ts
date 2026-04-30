import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'

declare const __PUBLIC_SUPABASE_URL__: string
declare const __PUBLIC_SUPABASE_ANON_KEY__: string

const supabaseUrl = (
  import.meta.env.VITE_SUPABASE_URL ||
  __PUBLIC_SUPABASE_URL__
) as string | undefined

const supabaseAnonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  __PUBLIC_SUPABASE_ANON_KEY__
) as string | undefined

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

type SupabaseLike = SupabaseClient<Database>

type SupabaseGlobal = typeof globalThis & {
  __bonificaSupabaseClient?: SupabaseLike
}

function createUnavailableClient(): SupabaseLike {
  const unavailableError = new Error('Configuração do Supabase indisponível no momento.')

  return {
    auth: {
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe: () => {},
          },
        },
      }),
      getSession: async () => ({
        data: { session: null },
        error: null,
      }),
      refreshSession: async () => ({
        data: { session: null },
        error: unavailableError,
      }),
      signOut: async () => ({
        error: null,
      }),
      signInWithPassword: async () => ({
        data: { session: null, user: null },
        error: unavailableError,
      }),
      signUp: async () => ({
        data: { session: null, user: null },
        error: unavailableError,
      }),
    },
    from: () => ({
      select: () => Promise.resolve({ data: null, error: unavailableError }),
    }),
    functions: {
      invoke: async () => ({
        data: null,
        error: unavailableError,
      }),
    },
  } as unknown as SupabaseLike
}

function createSupabaseClient(): SupabaseLike {
  return createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}

const globalScope = globalThis as SupabaseGlobal

export const supabase: SupabaseLike = isSupabaseConfigured
  ? (globalScope.__bonificaSupabaseClient ??= createSupabaseClient())
  : createUnavailableClient()

let sessionPromise: Promise<Session | null> | null = null

function isInvalidRefreshToken(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return message.toLowerCase().includes('invalid refresh token')
}

export async function getSupabaseSession(): Promise<Session | null> {
  if (!sessionPromise) {
    sessionPromise = supabase.auth.getSession()
      .then(async ({ data, error }) => {
        if (error) {
          if (isInvalidRefreshToken(error)) {
            await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
          }
          return null
        }

        return data.session
      })
      .catch(async (error) => {
        if (isInvalidRefreshToken(error)) {
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
        }
        return null
      })
      .finally(() => {
        sessionPromise = null
      })
  }

  return sessionPromise
}
