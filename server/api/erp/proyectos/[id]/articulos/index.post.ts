import { createError, getRouterParam, readBody } from 'h3'
import type { AgregarArticuloBody } from '../../../../../utils/erp/types'
import { fetchFullSnapshot, insertArticulo } from '../../../../../utils/erp/repository'
import { getMysqlPool } from '../../../../../utils/db'

export default defineEventHandler(async (event) => {
  const idProyecto = getRouterParam(event, 'id')
  if (!idProyecto) {
    throw createError({ statusCode: 400, statusMessage: 'id de proyecto requerido' })
  }
  const body = await readBody<AgregarArticuloBody>(event)
  if (!body?.sg?.trim() || !body?.descripcion?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'sg y descripción son obligatorios' })
  }
  const pool = getMysqlPool()
  await insertArticulo(pool, idProyecto, {
    ...body,
    cantidadTotal: Number(body.cantidadTotal) || 1,
    cantidadRecibida: Number(body.cantidadRecibida) || 0,
    precioUnitario: Number(body.precioUnitario) || 0
  })
  return fetchFullSnapshot(pool)
})
