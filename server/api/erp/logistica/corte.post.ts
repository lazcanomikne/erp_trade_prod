import { createError, readBody } from 'h3'
import { bulkLaredoToAduana, fetchFullSnapshot } from '../../../utils/erp/repository'
import { getMysqlPool } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ seleccion: { idProyecto: string, idArticulo: string }[] }>(event)
  const sel = body?.seleccion
  if (!Array.isArray(sel)) {
    throw createError({ statusCode: 400, statusMessage: 'seleccion debe ser un arreglo' })
  }
  const pool = getMysqlPool()
  await bulkLaredoToAduana(pool, sel)
  return fetchFullSnapshot(pool)
})
