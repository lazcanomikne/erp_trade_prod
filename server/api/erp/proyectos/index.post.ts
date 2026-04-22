import { createError, readBody } from 'h3'
import type { CrearProyectoBody } from '../../../utils/erp/types'
import { fetchProyectoSnapshot, insertProyecto } from '../../../utils/erp/repository'
import { getMysqlPool } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody<CrearProyectoBody>(event)
  if (!body?.cliente?.trim() || !body?.nombre?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'cliente y nombre son obligatorios' })
  }
  const id = `PRY-${Date.now().toString(36).toUpperCase()}`
  const pool = getMysqlPool()
  await insertProyecto(pool, body, id)
  const snap = await fetchProyectoSnapshot(pool, id)
  if (!snap) {
    throw createError({ statusCode: 500, statusMessage: 'No se pudo leer el proyecto creado' })
  }
  return snap
})
