import pg from 'pg'

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
})
