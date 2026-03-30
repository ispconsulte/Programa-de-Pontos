import { readFileSync, readdirSync } from 'fs'
import { config as loadEnv } from 'dotenv'
import { join } from 'path'
import { pool } from './pool.js'

const currentDir = __dirname
const backendRoot = join(currentDir, '..', '..')
const repositoryRoot = join(backendRoot, '..')

loadEnv({ path: join(repositoryRoot, '.env') })
loadEnv({ path: join(backendRoot, '.env'), override: false })

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    const migrationsDir = join(currentDir, 'migrations')
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort()

    for (const file of files) {
      const { rows } = await client.query('SELECT id FROM _migrations WHERE filename = $1', [file])
      if (rows.length > 0) {
        console.log(`  skip: ${file}`)
        continue
      }

      const sql = readFileSync(join(migrationsDir, file), 'utf8')
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file])
        await client.query('COMMIT')
        console.log(`  applied: ${file}`)
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      }
    }

    console.log('Migrations complete.')
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch((err) => {
  console.error(err)
  process.exit(1)
})
