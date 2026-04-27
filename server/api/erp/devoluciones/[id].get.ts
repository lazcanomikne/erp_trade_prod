import { getMysqlPool } from '../../../utils/db'
import { fetchDevolucionDetalle } from '../../../utils/erp/repository'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id requerido' })
  const pool = getMysqlPool()
  const dev = await fetchDevolucionDetalle(pool, id)
  if (!dev) throw createError({ statusCode: 404, statusMessage: 'Devolución no encontrada' })
  return dev
})
