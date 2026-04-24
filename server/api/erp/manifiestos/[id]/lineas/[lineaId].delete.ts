import { createError, getRouterParam } from 'h3'
import { deleteManifiestoLinea, fetchFullSnapshot } from '../../../../../utils/erp/repository'
import { getMysqlPool } from '../../../../../utils/db'

export default defineEventHandler(async (event) => {
  const lineaId = getRouterParam(event, 'lineaId')
  if (!lineaId) throw createError({ statusCode: 400, statusMessage: 'lineaId requerido' })
  const pool = getMysqlPool()
  await deleteManifiestoLinea(pool, lineaId)
  return fetchFullSnapshot(pool)
})
