import { createError, getRouterParam } from 'h3'
import { getMysqlPool } from '../../../../utils/db'
import { ensureErpSchema } from '../../../../utils/erp/ensure-schema'
import { restoreInventarioLibre } from '../../../../utils/erp/repository'

let schemaSynced = false

export default defineEventHandler(async (event) => {
  const idArticulo = getRouterParam(event, 'id')
  if (!idArticulo) {
    throw createError({ statusCode: 400, statusMessage: 'parámetros inválidos' })
  }

  const pool = getMysqlPool()
  if (!schemaSynced) {
    await ensureErpSchema(pool)
    schemaSynced = true
  }
  const ok = await restoreInventarioLibre(pool, idArticulo)
  if (!ok) {
    throw createError({ statusCode: 404, statusMessage: 'Artículo no encontrado' })
  }
  return { ok: true }
})
