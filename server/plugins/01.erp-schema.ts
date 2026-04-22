import { getMysqlPool } from '../utils/db'
import { ensureErpSchema } from '../utils/erp/ensure-schema'
import { seedDatabaseIfEmpty } from '../utils/erp/seed-if-empty'

export default defineNitroPlugin(async () => {
  try {
    const pool = getMysqlPool()
    await ensureErpSchema(pool)
    await seedDatabaseIfEmpty(pool)
  } catch (err) {
    console.error('[erp] schema/seed failed (¿MySQL arrancado y DB_* correctos?):', err)
  }
})
