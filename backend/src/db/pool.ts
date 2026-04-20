import pg, { type QueryResult, type QueryResultRow } from 'pg'
import { AppError } from '../lib/app-error.js'

const { Pool } = pg

function resolveSslConfig(connectionString?: string): false | { rejectUnauthorized: boolean } {
  const sslMode = process.env.PGSSLMODE?.toLowerCase()
  const dbSsl = process.env.DB_SSL?.toLowerCase()
  const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true'

  let hostIsLocal = false
  let sslExplicitlyDisabledByUrl = false
  const requiresSslByEnv =
    sslMode === 'require' ||
    sslMode === 'verify-ca' ||
    sslMode === 'verify-full' ||
    dbSsl === 'true'

  let requiresSslByUrl = false
  if (connectionString) {
    try {
      const url = new URL(connectionString)
      const host = url.hostname.toLowerCase()
      hostIsLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1'
      const sslmode = url.searchParams.get('sslmode')?.toLowerCase()
      sslExplicitlyDisabledByUrl = sslmode === 'disable'
      requiresSslByUrl =
        sslmode === 'require' || sslmode === 'verify-ca' || sslmode === 'verify-full'
    } catch {
      // ignore malformed URL here; pg will throw a clearer error later
    }
  }

  if (sslExplicitlyDisabledByUrl || (hostIsLocal && dbSsl !== 'true')) {
    return false
  }

  if (requiresSslByEnv || requiresSslByUrl) {
    return { rejectUnauthorized }
  }
  return false
}

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://ixcapi:ixcapi@localhost:5432/ixcapi'

export const pool = new Pool({
  connectionString,
  ssl: resolveSslConfig(connectionString),
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 30_000,
  query_timeout: 30_000,
})

export function assertSafeLimit(limit: number) {
  if (limit > 1000) {
    throw new AppError(400, 'Paginação obrigatória para consultas grandes. Use os parâmetros page e limit.')
  }
}

export async function safeQuery<T extends QueryResultRow = QueryResultRow>(
  query: string,
  params: unknown[] = [],
  maxRows = 100
): Promise<QueryResult<T>> {
  assertSafeLimit(maxRows)

  const trimmed = query.trim()
  const hasLimit = /\blimit\b/i.test(trimmed)
  const guardedQuery = /^\s*select\b/i.test(trimmed) && !hasLimit
    ? `${trimmed}\nLIMIT ${maxRows}`
    : query

  return pool.query<T>(guardedQuery, params)
}

export async function withRequestLock<T>(
  lockKey: string,
  lockedBy: string | null | undefined,
  operation: () => Promise<T>
): Promise<T> {
  await pool.query('DELETE FROM request_locks WHERE expires_at <= now()')

  const lock = await pool.query(
    `
      INSERT INTO request_locks (lock_key, locked_by, expires_at)
      VALUES ($1, $2, now() + interval '30 seconds')
      ON CONFLICT (lock_key) DO NOTHING
      RETURNING lock_key
    `,
    [lockKey, lockedBy ?? null]
  )

  if (!lock.rows[0]) {
    await pool.query(
      `
        INSERT INTO flood_audit_log (
          user_id,
          endpoint,
          attempts,
          first_attempt_at,
          last_attempt_at,
          action_taken
        )
        VALUES ($1, $2, 1, now(), now(), 'request_lock')
      `,
      [lockedBy ?? null, lockKey]
    ).catch(() => {})
    throw new AppError(429, 'Operação já em processamento. Aguarde alguns segundos.')
  }

  try {
    return await operation()
  } finally {
    await pool.query('DELETE FROM request_locks WHERE lock_key = $1', [lockKey]).catch(() => {})
  }
}
