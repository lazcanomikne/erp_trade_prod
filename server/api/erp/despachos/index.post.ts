import { createError, readBody } from 'h3'
import { getMysqlPool } from '../../../utils/db'
import { upsertDespachoByNombre } from '../../../utils/erp/repository'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ nombre: string }>(event)
  if (!body?.nombre?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'nombre es obligatorio' })
  }
  const pool = getMysqlPool()
  const nombre = body.nombre.trim()
  const id = await upsertDespachoByNombre(pool, nombre)
  return { id, nombre }
})
