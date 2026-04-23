import { getMysqlPool } from '../../../utils/db'
import { insertEntrega, fetchEntrega } from '../../../utils/erp/repository'
import type { CrearEntregaBody } from '../../../utils/erp/types'

export default defineEventHandler(async (event) => {
  const body = await readBody<CrearEntregaBody>(event)
  if (!body.descripcion?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'descripcion es requerida' })
  }
  if (!body.destinos?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Al menos un destino es requerido' })
  }
  const pool = getMysqlPool()
  const id = await insertEntrega(pool, body)
  return await fetchEntrega(pool, id)
})
