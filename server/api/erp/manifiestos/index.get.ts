import { listarManifiestos } from '../../../utils/erp/repository'
import { getMysqlPool } from '../../../utils/db'

export default defineEventHandler(async () => {
  const pool = getMysqlPool()
  return listarManifiestos(pool)
})
