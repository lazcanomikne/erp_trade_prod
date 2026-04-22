import { createError, readBody } from 'h3'
import { fetchFullSnapshot, insertLimbo } from '../../../utils/erp/repository'
import { getMysqlPool } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ sgProvisional: string, descripcion: string, imagenUrl: string }>(event)
  if (!body?.sgProvisional?.trim() || !body?.descripcion?.trim() || !body?.imagenUrl?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Datos incompletos para limbo' })
  }
  const pool = getMysqlPool()
  await insertLimbo(pool, body)
  return fetchFullSnapshot(pool)
})
