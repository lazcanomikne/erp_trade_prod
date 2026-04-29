import { getMysqlPool } from '../../../utils/db'
import { fetchClientes } from '../../../utils/erp/repository'

export default defineEventHandler(async () => {
  const pool = getMysqlPool()
  return fetchClientes(pool)
})
