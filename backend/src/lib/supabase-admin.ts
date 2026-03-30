import { createClient } from '@supabase/supabase-js'
import { AppError } from './app-error.js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new AppError(500, 'Supabase service role is not configured on server')
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export function toByteaHex(value: Buffer): string {
  return `\\x${value.toString('hex')}`
}

export function fromBytea(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value
  if (typeof value === 'string') {
    const normalized = value.startsWith('\\x') ? value.slice(2) : value
    return Buffer.from(normalized, 'hex')
  }
  return Buffer.alloc(0)
}

