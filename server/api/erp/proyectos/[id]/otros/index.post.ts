import { createError, readBody } from 'h3'
import { getMysqlPool } from '../../../../../utils/db'
import { fetchProyectoSnapshot, insertOtroCargo } from '../../../../../utils/erp/repository'

export default defineEventHandler(async (event) => {
  const idProyecto = decodeURIComponent(event.context.params?.id ?? '')
  const body = await readBody<{ descripcion?: string; montoUsd?: number }>(event)
  if (!body?.descripcion?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'descripcion es obligatoria' })
  }
  const pool = getMysqlPool()
  await insertOtroCargo(pool, idProyecto, {
    descripcion: body.descripcion,
    montoUsd: Number(body.montoUsd) || 0
  })
  const snap = await fetchProyectoSnapshot(pool, idProyecto)
  if (!snap) throw createError({ statusCode: 404, statusMessage: 'Proyecto no encontrado' })
  return snap
})
