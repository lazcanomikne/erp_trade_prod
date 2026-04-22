import { createError, getRouterParam, readBody } from 'h3'
import { fetchFullSnapshot, insertPago } from '../../../../../utils/erp/repository'
import { getMysqlPool } from '../../../../../utils/db'

export default defineEventHandler(async (event) => {
  const idProyecto = getRouterParam(event, 'id')
  if (!idProyecto) {
    throw createError({ statusCode: 400, statusMessage: 'id de proyecto requerido' })
  }
  const body = await readBody<{ montoUsd: number }>(event)
  const m = Number(body?.montoUsd)
  if (!Number.isFinite(m) || m <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'montoUsd inválido' })
  }
  const pool = getMysqlPool()
  await insertPago(pool, idProyecto, m)
  return fetchFullSnapshot(pool)
})
