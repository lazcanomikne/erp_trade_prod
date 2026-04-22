import { createError, getRouterParam, readBody } from 'h3'
import type { ArticuloProyecto } from '~/types'
import { fetchFullSnapshot, updateArticuloEstatus } from '../../../../../utils/erp/repository'
import { getMysqlPool } from '../../../../../utils/db'

export default defineEventHandler(async (event) => {
  const idProyecto = getRouterParam(event, 'id')
  const idArticulo = getRouterParam(event, 'aid')
  if (!idProyecto || !idArticulo) {
    throw createError({ statusCode: 400, statusMessage: 'parámetros inválidos' })
  }
  const body = await readBody<{ estatus: ArticuloProyecto['estatus'] }>(event)
  if (!body?.estatus) {
    throw createError({ statusCode: 400, statusMessage: 'estatus requerido' })
  }
  const pool = getMysqlPool()
  const ok = await updateArticuloEstatus(pool, idProyecto, idArticulo, body.estatus)
  if (!ok) {
    throw createError({ statusCode: 404, statusMessage: 'Artículo no encontrado' })
  }
  return fetchFullSnapshot(pool)
})
