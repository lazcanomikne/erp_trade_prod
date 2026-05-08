import { createError, getRouterParam, readBody } from 'h3'
import { getMysqlPool } from '../../../utils/db'
import { ensureErpSchema } from '../../../utils/erp/ensure-schema'
import { softDeleteInventarioLibre } from '../../../utils/erp/repository'

let schemaSynced = false

export default defineEventHandler(async (event) => {
  const idArticulo = getRouterParam(event, 'id')
  if (!idArticulo) {
    throw createError({ statusCode: 400, statusMessage: 'parámetros inválidos' })
  }
  const body = await readBody<{ comentario?: string }>(event)
  const comentario = (body?.comentario ?? '').trim()
  if (!comentario) {
    throw createError({ statusCode: 400, statusMessage: 'Se requiere un comentario de eliminación' })
  }

  const pool = getMysqlPool()
  if (!schemaSynced) {
    await ensureErpSchema(pool)
    schemaSynced = true
  }
  const ok = await softDeleteInventarioLibre(pool, idArticulo, comentario)
  if (!ok) {
    throw createError({ statusCode: 404, statusMessage: 'Artículo no encontrado' })
  }
  return { ok: true }
})
