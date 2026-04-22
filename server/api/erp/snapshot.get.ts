import { fetchFullSnapshot } from '../../utils/erp/repository'
import { getMysqlPool } from '../../utils/db'

export default defineEventHandler(async () => {
  try {
    const pool = getMysqlPool()
    return await fetchFullSnapshot(pool)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[erp/snapshot]', msg)
    return { proyectos: [], limbo: [] }
  }
})
