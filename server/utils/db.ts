import mysql from 'mysql2/promise'
import type { Pool } from 'mysql2/promise'

let pool: Pool | null = null
let diagnosticStarted = false

function logMysqlFailure(context: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(`[mysql] ${context}: ${msg}`)
}

/**
 * Pool MySQL compartido (Nitro). Credenciales vía `runtimeConfig` (mapeadas desde DB_* en nuxt.config).
 * En Vercel (u otros serverless) el host debe ser alcanzable desde Internet (no 127.0.0.1 salvo túnel).
 */
export function getMysqlPool(): Pool {
  if (pool) {
    return pool
  }
  const config = useRuntimeConfig()
  const host = String(config.dbHost ?? 'localhost').trim() || 'localhost'
  const port = Number(config.dbPort) || 3306
  const user = String(config.dbUser ?? 'sa').trim() || 'sa'
  const password = config.dbPassword != null ? String(config.dbPassword) : ''
  const database = String(config.dbName ?? '').trim() || 'tradeadmin_sergio_erp_comercial'

  try {
    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      enableKeepAlive: true
    })
  } catch (err) {
    logMysqlFailure('No se pudo crear el pool', err)
    throw err
  }

  if (!diagnosticStarted) {
    diagnosticStarted = true
    void pool.query('SELECT 1 AS ok')
      .catch((err: unknown) => {
        logMysqlFailure('Conexión o credenciales rechazadas al verificar el pool', err)
      })
  }

  return pool
}

export async function pingMysql(): Promise<boolean> {
  try {
    const p = getMysqlPool()
    const [rows] = await p.query('SELECT 1 AS ok')
    return Array.isArray(rows) && rows.length > 0
  } catch (err) {
    logMysqlFailure('pingMysql (SELECT 1)', err)
    return false
  }
}
