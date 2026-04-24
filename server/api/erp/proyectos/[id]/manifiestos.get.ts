import { createError, getRouterParam } from 'h3'
import { fetchManifiestosByProyecto } from '../../../../utils/erp/repository'
import { getMysqlPool } from '../../../../utils/db'

export default defineEventHandler(async (event) => {
  const idProyecto = getRouterParam(event, 'id')
  if (!idProyecto) throw createError({ statusCode: 400, statusMessage: 'id requerido' })
  const pool = getMysqlPool()
  return fetchManifiestosByProyecto(pool, idProyecto)
})
