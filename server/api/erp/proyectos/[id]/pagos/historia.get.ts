import { createError, getRouterParam } from 'h3'
import { fetchPagoHistoria } from '../../../../../utils/erp/repository'
import { getMysqlPool } from '../../../../../utils/db'

export default defineEventHandler(async (event) => {
  const idProyecto = getRouterParam(event, 'id')
  if (!idProyecto) {
    throw createError({ statusCode: 400, statusMessage: 'id de proyecto requerido' })
  }
  const pool = getMysqlPool()
  return fetchPagoHistoria(pool, idProyecto)
})
