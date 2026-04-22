import mysql from 'mysql2/promise'
import type { Pool } from 'mysql2/promise'

let pool: Pool | null = null
let diagnosticStarted = false

function logMysqlFailure(context: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(`[mysql] ${context}: ${msg}`)
}

/**
 * Pool MySQL compartido (Nitro). Credenciales vía runtimeConfig / NUXT_* (ver `.env.example`).
 * En el primer uso intenta SELECT 1; si falla, deja traza en consola (logs Passenger/cPanel).
 */
export function getMysqlPool(): Pool {
  if (pool) {
    return pool
  }
  const config = useRuntimeConfig()
  const host = String(config.mysqlHost ?? 'localhost').trim() || 'localhost'
  const port = Number(config.mysqlPort) || 3306
  const user = String(config.mysqlUser ?? 'sa').trim() || 'sa'
  const password = config.mysqlPassword != null ? String(config.mysqlPassword) : ''
  const database = String(config.mysqlDatabase ?? 'tradeadmin_sergio_erp_comercial').trim()
    || 'tradeadmin_sergio_erp_comercial'

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
