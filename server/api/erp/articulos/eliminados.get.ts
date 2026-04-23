import { fetchArticulosEliminados } from '../../../utils/erp/repository'
import { ensureErpSchema } from '../../../utils/erp/ensure-schema'
import { getMysqlPool } from '../../../utils/db'

let schemaSynced = false

export default defineEventHandler(async () => {
  const pool = getMysqlPool()
  if (!schemaSynced) {
    await ensureErpSchema(pool)
    schemaSynced = true
  }
  return fetchArticulosEliminados(pool)
})
