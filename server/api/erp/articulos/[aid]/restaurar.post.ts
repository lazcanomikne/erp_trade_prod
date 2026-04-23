import { createError, getRouterParam } from 'h3'
import { restoreArticulo } from '../../../../utils/erp/repository'
import { getMysqlPool } from '../../../../utils/db'

export default defineEventHandler(async (event) => {
  const idArticulo = getRouterParam(event, 'aid')
  if (!idArticulo) {
    throw createError({ statusCode: 400, statusMessage: 'parámetros inválidos' })
  }
  const pool = getMysqlPool()
  const ok = await restoreArticulo(pool, idArticulo)
  if (!ok) {
    throw createError({ statusCode: 404, statusMessage: 'Artículo no encontrado' })
  }
  return { ok: true }
})
