import { createError, getRouterParam, readBody } from 'h3'
import { updateManifiestoLinea } from '../../../../../utils/erp/repository'
import { getMysqlPool } from '../../../../../utils/db'

export default defineEventHandler(async (event) => {
  const lineaId = getRouterParam(event, 'lineaId')
  if (!lineaId) throw createError({ statusCode: 400, statusMessage: 'lineaId requerido' })
  const body = await readBody<{ descripcionGenerica: string; cantidadCorte: number; precioCorte: number }>(event)
  const pool = getMysqlPool()
  await updateManifiestoLinea(pool, lineaId, {
    descripcionGenerica: body.descripcionGenerica ?? '',
    cantidadCorte: Number(body.cantidadCorte) || 1,
    precioCorte: Number(body.precioCorte) || 0
  })
  return { ok: true }
})
