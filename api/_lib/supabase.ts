import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase service role is not configured')
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export function isAdminRole(role: string | null | undefined): boolean {
  return ['admin', 'owner', 'manager'].includes(String(role ?? '').toLowerCase())
}

export function normalizeDisplayName(user: {
  email?: string | null
  user_metadata?: Record<string, unknown> | null
}): string {
  const metadata = user.user_metadata ?? {}
  const candidates = [metadata.full_name, metadata.name, metadata.display_name]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }

  const email = typeof user.email === 'string' ? user.email : ''
  return email.split('@')[0] || 'Usuario'
}
