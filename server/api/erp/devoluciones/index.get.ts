import { getMysqlPool } from '../../../utils/db'
import { fetchDevoluciones } from '../../../utils/erp/repository'
import { ensureErpSchema } from '../../../utils/erp/ensure-schema'

let synced = false

export default defineEventHandler(async () => {
  try {
    const pool = getMysqlPool()
    if (!synced) { await ensureErpSchema(pool); synced = true }
    return await fetchDevoluciones(pool)
  } catch (err) {
    console.error('[devoluciones]', err)
    return []
  }
})
