import { createError, getRouterParam, readBody } from 'h3'
import type { ActualizarProyectoBody } from '../../../utils/erp/types'
import { fetchProyectoSnapshot, updateProyecto } from '../../../utils/erp/repository'
import { getMysqlPool } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const idProyecto = getRouterParam(event, 'id')
  if (!idProyecto) {
    throw createError({ statusCode: 400, statusMessage: 'id de proyecto inválido' })
  }
  const body = await readBody<ActualizarProyectoBody>(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'cuerpo inválido' })
  }
  const has
    = body.cliente !== undefined
      || body.nombre !== undefined
      || body.folioPropuesta !== undefined
      || body.estatus !== undefined
      || body.compradoPorTrade !== undefined
      || body.tarifaImportacionPct !== undefined
      || body.despachoAduanalUsd !== undefined
      || body.fleteLogisticaUsd !== undefined
      || body.anticipoUsd !== undefined
  if (!has) {
    throw createError({ statusCode: 400, statusMessage: 'no hay campos para actualizar' })
  }
  const pool = getMysqlPool()
  await updateProyecto(pool, idProyecto, body)
  const snap = await fetchProyectoSnapshot(pool, idProyecto)
  if (!snap) {
    throw createError({ statusCode: 404, statusMessage: 'Proyecto no encontrado' })
  }
  return snap
})
