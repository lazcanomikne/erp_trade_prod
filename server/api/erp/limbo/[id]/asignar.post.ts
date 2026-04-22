import { createError, getRouterParam, readBody } from 'h3'
import { asignarLimbo, fetchFullSnapshot } from '../../../../utils/erp/repository'
import { getMysqlPool } from '../../../../utils/db'

export default defineEventHandler(async (event) => {
  const idLimbo = getRouterParam(event, 'id')
  if (!idLimbo) {
    throw createError({ statusCode: 400, statusMessage: 'id limbo requerido' })
  }
  const body = await readBody<{
    idProyecto: string
    precioUnitario: number
    cantidadTotal?: number
    sgFinal?: string
    marcarRecibidoMonterrey?: boolean
  }>(event)
  if (!body?.idProyecto?.trim() || !Number.isFinite(Number(body.precioUnitario))) {
    throw createError({ statusCode: 400, statusMessage: 'proyecto y precio obligatorios' })
  }
  const pool = getMysqlPool()
  const ok = await asignarLimbo(pool, idLimbo, body.idProyecto.trim(), {
    precioUnitario: Number(body.precioUnitario),
    cantidadTotal: body.cantidadTotal,
    sgFinal: body.sgFinal,
    marcarRecibidoMonterrey: body.marcarRecibidoMonterrey
  })
  if (!ok) {
    throw createError({ statusCode: 404, statusMessage: 'Arribo no encontrado' })
  }
  return fetchFullSnapshot(pool)
})
