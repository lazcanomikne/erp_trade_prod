import { getMysqlPool } from '../../../utils/db'
import { fetchEntrega } from '../../../utils/erp/repository'

export default defineEventHandler(async (event) => {
  const id = decodeURIComponent(getRouterParam(event, 'id') ?? '')
  const pool = getMysqlPool()
  const entrega = await fetchEntrega(pool, id)
  if (!entrega) throw createError({ statusCode: 404, statusMessage: 'Entrega no encontrada' })
  return entrega
})
