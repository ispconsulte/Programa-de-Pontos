import type { FastifyRequest, FastifyReply } from 'fastify'
import { AppError } from '../lib/app-error.js'
import { fromBytea, supabaseAdmin } from '../lib/supabase-admin.js'
import { getSupabaseUserFromAccessToken } from '../lib/supabase.js'
import { loadTenantIxcConnection } from '../lib/ixc-connections.js'

export interface JwtPayload {
  sub: string
  tenantId: string
  iat: number
  exp: number
}

export interface TenantCredentialsRow {
  id: string
  ixc_base_url: string
  ixc_user: string
  ixc_token_enc: Buffer
  ixc_token_iv: Buffer
}

declare module 'fastify' {
  interface FastifyRequest {
    userId: string
    tenantId: string
    userRole: string
    ixcConnectionId?: string
  }
}

export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const authorization = request.headers.authorization
  const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : ''
  if (!token) {
    throw new AppError(401, 'Unauthorized')
  }

  const supabaseUser = await getSupabaseUserFromAccessToken(token)
  if (!supabaseUser?.id) {
    throw new AppError(401, 'Unauthorized')
  }

  const { data: userRow, error: userRowError } = await supabaseAdmin
    .from('users')
    .select('id, tenant_id, role')
    .eq('id', supabaseUser.id)
    .maybeSingle()

  if (userRowError) {
    throw new AppError(500, userRowError.message)
  }
  if (!userRow) {
    throw new AppError(401, 'Unauthorized')
  }

  request.userId = userRow.id
  request.tenantId = userRow.tenant_id
  request.userRole = userRow.role
}

export async function requireAdmin(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (request.userRole !== 'admin') {
    throw new AppError(403, 'Forbidden')
  }
}

export async function loadTenantCredentials(tenantId: string): Promise<TenantCredentialsRow> {
  const { data: row, error } = await supabaseAdmin
    .from('tenants')
    .select('id, ixc_base_url, ixc_user, ixc_token_enc, ixc_token_iv, active')
    .eq('id', tenantId)
    .eq('active', true)
    .maybeSingle()

  if (error) {
    throw new AppError(500, error.message)
  }
  if (!row) {
    throw new AppError(401, 'Unauthorized')
  }

  const tokenEnc = row.ixc_token_enc ? fromBytea(row.ixc_token_enc) : null
  const tokenIv = row.ixc_token_iv ? fromBytea(row.ixc_token_iv) : null

  const missingConfig =
    !row.ixc_base_url ||
    !row.ixc_user ||
    !tokenEnc ||
    !tokenIv ||
    tokenEnc.length === 0 ||
    tokenIv.length === 0

  if (missingConfig) {
    throw new AppError(409, 'IXC integration not configured')
  }

  return {
    id: row.id,
    ixc_base_url: row.ixc_base_url,
    ixc_user: row.ixc_user,
    ixc_token_enc: tokenEnc,
    ixc_token_iv: tokenIv,
  } as TenantCredentialsRow
}

export function resolveRequestedIxcConnectionId(request: FastifyRequest): string | undefined {
  const headerValue = request.headers['x-ixc-connection-id']
  if (typeof headerValue === 'string' && headerValue.trim()) {
    return headerValue.trim()
  }

  const query = request.query as Record<string, unknown> | undefined
  const queryValue = query?.ixcConnectionId
  if (typeof queryValue === 'string' && queryValue.trim()) {
    return queryValue.trim()
  }

  return undefined
}

export async function loadTenantCredentialsForRequest(request: FastifyRequest): Promise<TenantCredentialsRow & { connection_id: string }> {
  const requestedConnectionId = resolveRequestedIxcConnectionId(request)
  const connection = await loadTenantIxcConnection(request.tenantId, requestedConnectionId)

  request.ixcConnectionId = connection.id

  return {
    id: connection.tenant_id,
    connection_id: connection.id,
    ixc_base_url: connection.ixc_base_url,
    ixc_user: connection.ixc_user,
    ixc_token_enc: connection.ixc_token_enc,
    ixc_token_iv: connection.ixc_token_iv,
  }
}
