import { getMysqlPool } from '../../../../utils/db'
import { cancelarDevolucion, fetchDevolucionDetalle } from '../../../../utils/erp/repository'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id requerido' })
  const pool = getMysqlPool()
  const ok = await cancelarDevolucion(pool, id)
  if (!ok) throw createError({ statusCode: 409, statusMessage: 'La devolución ya fue cancelada o no existe' })
  return await fetchDevolucionDetalle(pool, id)
})
