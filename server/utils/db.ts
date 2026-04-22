import mysql from 'mysql2/promise'
import type { Pool } from 'mysql2/promise'

let pool: Pool | null = null

/**
 * Pool MySQL compartido (Nitro). Configura credenciales con variables de entorno NUXT_* (ver `.env.example`).
 * No incluyas contraseñas en el código fuente.
 */
export function getMysqlPool(): Pool {
  if (pool) {
    return pool
  }
  const config = useRuntimeConfig()
  pool = mysql.createPool({
    host: config.mysqlHost,
    port: Number(config.mysqlPort) || 3306,
    user: config.mysqlUser,
    password: config.mysqlPassword,
    database: config.mysqlDatabase,
    waitForConnections: true,
    connectionLimit: 10,
    enableKeepAlive: true
  })
  return pool
}

export async function pingMysql(): Promise<boolean> {
  try {
    const p = getMysqlPool()
    const [rows] = await p.query('SELECT 1 AS ok')
    return Array.isArray(rows) && rows.length > 0
  } catch {
    return false
  }
}
