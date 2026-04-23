import { createError, readBody } from 'h3'
import { getMysqlPool } from '../../../../../utils/db'
import { fetchProyectoSnapshot, updateOtroCargo } from '../../../../../utils/erp/repository'

export default defineEventHandler(async (event) => {
  const idProyecto = decodeURIComponent(event.context.params?.id ?? '')
  const idOtro = decodeURIComponent(event.context.params?.otroId ?? '')
  const body = await readBody<{ descripcion?: string; montoUsd?: number }>(event)
  const pool = getMysqlPool()
  await updateOtroCargo(pool, idProyecto, idOtro, {
    descripcion: body.descripcion,
    montoUsd: body.montoUsd !== undefined ? Number(body.montoUsd) : undefined
  })
  const snap = await fetchProyectoSnapshot(pool, idProyecto)
  if (!snap) throw createError({ statusCode: 404, statusMessage: 'Proyecto no encontrado' })
  return snap
})
