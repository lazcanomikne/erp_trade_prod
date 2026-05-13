import { getMysqlPool } from '../../../utils/db'
import { fetchDespachos } from '../../../utils/erp/repository'

export default defineEventHandler(async () => {
  const pool = getMysqlPool()
  return fetchDespachos(pool)
})
