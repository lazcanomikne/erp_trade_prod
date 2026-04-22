import { createError, getRouterParam, readBody } from 'h3'
import type { ArticuloProyecto } from '~/types'
import { fetchFullSnapshot, updateArticuloEstatus, updateArticuloReferencia } from '../../../../../utils/erp/repository'
import { getMysqlPool } from '../../../../../utils/db'

export default defineEventHandler(async (event) => {
  const idProyecto = getRouterParam(event, 'id')
  const idArticulo = getRouterParam(event, 'aid')
  if (!idProyecto || !idArticulo) {
    throw createError({ statusCode: 400, statusMessage: 'parámetros inválidos' })
  }
  const body = await readBody<{
    estatus?: ArticuloProyecto['estatus']
    referenciaLogistica?: string | null
  }>(event)

  const pool = getMysqlPool()

  if (body?.estatus) {
    const ok = await updateArticuloEstatus(pool, idProyecto, idArticulo, body.estatus)
    if (!ok) {
      throw createError({ statusCode: 404, statusMessage: 'Artículo no encontrado' })
    }
  }

  if ('referenciaLogistica' in body) {
    const ok = await updateArticuloReferencia(pool, idProyecto, idArticulo, body.referenciaLogistica ?? null)
    if (!ok) {
      throw createError({ statusCode: 404, statusMessage: 'Artículo no encontrado' })
    }
  }

  if (!body?.estatus && !('referenciaLogistica' in body)) {
    throw createError({ statusCode: 400, statusMessage: 'Se requiere estatus o referenciaLogistica' })
  }

  return fetchFullSnapshot(pool)
})
