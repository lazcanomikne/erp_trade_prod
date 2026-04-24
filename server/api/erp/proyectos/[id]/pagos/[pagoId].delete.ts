import { createError, getRouterParam, readBody } from 'h3'
import { deletePagoConHistoria, fetchFullSnapshot } from '../../../../../utils/erp/repository'
import { getMysqlPool } from '../../../../../utils/db'

export default defineEventHandler(async (event) => {
  const pagoId = getRouterParam(event, 'pagoId')
  if (!pagoId) {
    throw createError({ statusCode: 400, statusMessage: 'pagoId requerido' })
  }
  const body = await readBody<{ motivo: string }>(event)
  if (!body?.motivo?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'motivo de eliminación requerido' })
  }
  const pool = getMysqlPool()
  await deletePagoConHistoria(pool, pagoId, body.motivo.trim())
  return fetchFullSnapshot(pool)
})
