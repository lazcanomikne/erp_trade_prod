import { createError } from 'h3'
import { getMysqlPool } from '../../../utils/db'
import { deleteProyecto } from '../../../utils/erp/repository'

export default defineEventHandler(async (event) => {
  const id = decodeURIComponent(event.context.params?.id ?? '')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'ID de proyecto requerido' })
  }
  const pool = getMysqlPool()
  const ok = await deleteProyecto(pool, id)
  if (!ok) {
    throw createError({ statusCode: 404, statusMessage: 'Proyecto no encontrado' })
  }
  return { ok: true }
})
