import { createError } from 'h3'
import { getMysqlPool } from '../../../../../utils/db'
import { deleteOtroCargo, fetchProyectoSnapshot } from '../../../../../utils/erp/repository'

export default defineEventHandler(async (event) => {
  const idProyecto = decodeURIComponent(event.context.params?.id ?? '')
  const idOtro = decodeURIComponent(event.context.params?.otroId ?? '')
  const pool = getMysqlPool()
  await deleteOtroCargo(pool, idProyecto, idOtro)
  const snap = await fetchProyectoSnapshot(pool, idProyecto)
  if (!snap) throw createError({ statusCode: 404, statusMessage: 'Proyecto no encontrado' })
  return snap
})
