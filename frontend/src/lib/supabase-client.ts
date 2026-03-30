import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

type SupabaseLike = Pick<SupabaseClient, 'auth'>

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
  } as unknown as SupabaseLike
}

export const supabase: SupabaseLike = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : createUnavailableClient()
