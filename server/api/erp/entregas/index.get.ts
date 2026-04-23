import { getMysqlPool } from '../../../utils/db'
import { fetchEntregas } from '../../../utils/erp/repository'
import { ensureErpSchema } from '../../../utils/erp/ensure-schema'

let synced = false

export default defineEventHandler(async () => {
  try {
    const pool = getMysqlPool()
    if (!synced) { await ensureErpSchema(pool); synced = true }
    return await fetchEntregas(pool)
  } catch (err) {
    console.error('[entregas]', err)
    return []
  }
})
