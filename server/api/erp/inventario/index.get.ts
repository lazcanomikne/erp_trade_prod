import { getMysqlPool } from '../../../utils/db'
import { fetchInventarioLibre } from '../../../utils/erp/repository'
import { ensureErpSchema } from '../../../utils/erp/ensure-schema'

let synced = false

export default defineEventHandler(async () => {
  try {
    const pool = getMysqlPool()
    if (!synced) { await ensureErpSchema(pool); synced = true }
    return await fetchInventarioLibre(pool)
  } catch (err) {
    console.error('[inventario]', err)
    return []
  }
})
