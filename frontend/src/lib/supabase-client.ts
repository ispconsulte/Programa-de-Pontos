import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'

declare const __PUBLIC_SUPABASE_URL__: string
declare const __PUBLIC_SUPABASE_ANON_KEY__: string

const FALLBACK_SUPABASE_URL = 'https://bdbzxreipglgrybdowyp.supabase.co'
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkYnp4cmVpcGdsZ3J5YmRvd3lwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzODAwMjIsImV4cCI6MjA4OTk1NjAyMn0.uzEqq2iuVvfVedDb0yV5uimNdUtH9gDzpN2zWoJIo24'

const supabaseUrl = (
  import.meta.env.VITE_SUPABASE_URL ||
  __PUBLIC_SUPABASE_URL__ ||
  FALLBACK_SUPABASE_URL
) as string | undefined

const supabaseAnonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  __PUBLIC_SUPABASE_ANON_KEY__ ||
  FALLBACK_SUPABASE_ANON_KEY
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
