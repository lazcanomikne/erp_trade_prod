import { createError, readBody } from 'h3'
import { getMysqlPool } from '../../../utils/db'
import { upsertClienteByNombre, fetchClientes } from '../../../utils/erp/repository'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ nombre: string }>(event)
  if (!body?.nombre?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'nombre es obligatorio' })
  }
  const pool = getMysqlPool()
  const id = await upsertClienteByNombre(pool, body.nombre.trim())
  return { id, nombre: body.nombre.trim() }
})
