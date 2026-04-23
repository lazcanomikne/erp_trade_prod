import { createError, getRouterParam, readBody } from 'h3'
import { softDeleteArticulo } from '../../../../../utils/erp/repository'
import { getMysqlPool } from '../../../../../utils/db'

export default defineEventHandler(async (event) => {
  const idProyecto = getRouterParam(event, 'id')
  const idArticulo = getRouterParam(event, 'aid')
  if (!idProyecto || !idArticulo) {
    throw createError({ statusCode: 400, statusMessage: 'parámetros inválidos' })
  }
  const body = await readBody<{ comentario?: string }>(event)
  const comentario = (body?.comentario ?? '').trim()
  if (!comentario) {
    throw createError({ statusCode: 400, statusMessage: 'Se requiere un comentario de eliminación' })
  }

  const pool = getMysqlPool()
  const ok = await softDeleteArticulo(pool, idArticulo, comentario)
  if (!ok) {
    throw createError({ statusCode: 404, statusMessage: 'Artículo no encontrado' })
  }
  return { ok: true }
})
