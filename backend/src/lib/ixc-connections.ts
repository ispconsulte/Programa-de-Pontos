import { AppError } from './app-error.js'
import { fromBytea, supabaseAdmin } from './supabase-admin.js'

export interface IxcConnectionRow {
  id: string
  tenant_id: string
  name: string
  ixc_base_url: string
  ixc_user: string
  ixc_token_enc: Buffer
  ixc_token_iv: Buffer
  active: boolean
  created_at?: string
  updated_at?: string
}

function normalizeConnection(row: Record<string, unknown>): IxcConnectionRow {
  const tokenEnc = fromBytea(row.ixc_token_enc)
  const tokenIv = fromBytea(row.ixc_token_iv)

  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    name: String(row.name ?? ''),
    ixc_base_url: String(row.ixc_base_url ?? ''),
    ixc_user: String(row.ixc_user ?? ''),
    ixc_token_enc: tokenEnc,
    ixc_token_iv: tokenIv,
    active: Boolean(row.active),
    created_at: typeof row.created_at === 'string' ? row.created_at : undefined,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : undefined,
  }
}

function hasCompleteCredentials(row: Pick<IxcConnectionRow, 'ixc_base_url' | 'ixc_user' | 'ixc_token_enc' | 'ixc_token_iv'>) {
  return (
    !!row.ixc_base_url &&
    !!row.ixc_user &&
    row.ixc_token_enc.length > 0 &&
    row.ixc_token_iv.length > 0
  )
}

export async function listTenantIxcConnections(tenantId: string): Promise<IxcConnectionRow[]> {
  const { data, error } = await supabaseAdmin
    .from('ixc_connections')
    .select('id, tenant_id, name, ixc_base_url, ixc_user, ixc_token_enc, ixc_token_iv, active, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .order('active', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) {
    throw new AppError(500, error.message)
  }

  return (data ?? []).map((row) => normalizeConnection(row as Record<string, unknown>))
}

export async function loadTenantIxcConnection(
  tenantId: string,
  connectionId?: string
): Promise<IxcConnectionRow> {
  let query = supabaseAdmin
    .from('ixc_connections')
    .select('id, tenant_id, name, ixc_base_url, ixc_user, ixc_token_enc, ixc_token_iv, active, created_at, updated_at')
    .eq('tenant_id', tenantId)

  if (connectionId) {
    query = query.eq('id', connectionId)
  } else {
    query = query.order('active', { ascending: false }).order('created_at', { ascending: true })
  }

  const { data, error } = await query.limit(1).maybeSingle()

  if (error) {
    throw new AppError(500, error.message)
  }
  if (!data) {
    throw new AppError(409, 'IXC integration not configured')
  }

  const normalized = normalizeConnection(data as Record<string, unknown>)
  if (!hasCompleteCredentials(normalized)) {
    throw new AppError(409, 'IXC integration not configured')
  }

  return normalized
}

export async function activateTenantIxcConnection(tenantId: string, connectionId: string): Promise<void> {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('ixc_connections')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('id', connectionId)
    .maybeSingle()

  if (existingError) {
    throw new AppError(500, existingError.message)
  }
  if (!existing) {
    throw new AppError(404, 'IXC connection not found')
  }

  const { error: clearError } = await supabaseAdmin
    .from('ixc_connections')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('active', true)

  if (clearError) {
    throw new AppError(500, clearError.message)
  }

  const { error: activateError } = await supabaseAdmin
    .from('ixc_connections')
    .update({ active: true, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', connectionId)

  if (activateError) {
    throw new AppError(500, activateError.message)
  }
}
