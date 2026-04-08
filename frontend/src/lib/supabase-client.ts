import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string | undefined

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
