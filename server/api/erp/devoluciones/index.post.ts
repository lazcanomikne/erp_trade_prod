import { getMysqlPool } from '../../../utils/db'
import { insertDevolucion, fetchDevoluciones } from '../../../utils/erp/repository'
import type { CrearDevolucionBody } from '../../../utils/erp/types'

export default defineEventHandler(async (event) => {
  const body = await readBody<CrearDevolucionBody>(event)
  if (!body?.destino) {
    throw createError({ statusCode: 400, statusMessage: 'destino es requerido' })
  }
  if (!body?.articulos?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Al menos un artículo es requerido' })
  }
  for (const a of body.articulos) {
    if (a.motivo === 'Otros' && !a.motivoDetalle?.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'Motivo detalle requerido cuando motivo es Otros' })
    }
  }
  const pool = getMysqlPool()
  await insertDevolucion(pool, body)
  return await fetchDevoluciones(pool)
})
