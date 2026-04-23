import { fetchFullSnapshot } from '../../utils/erp/repository'
import { getMysqlPool } from '../../utils/db'
import { ensureErpSchema } from '../../utils/erp/ensure-schema'

let schemaSynced = false

export default defineEventHandler(async () => {
  try {
    const pool = getMysqlPool()
    if (!schemaSynced) {
      await ensureErpSchema(pool)
      schemaSynced = true
    }
    return await fetchFullSnapshot(pool)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[erp/snapshot]', msg)
    return { proyectos: [], limbo: [] }
  }
})
