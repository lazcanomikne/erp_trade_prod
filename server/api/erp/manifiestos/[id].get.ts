import { createError, getRouterParam } from 'h3'
import { fetchManifiesto } from '../../../utils/erp/repository'
import { getMysqlPool } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id requerido' })
  const pool = getMysqlPool()
  const m = await fetchManifiesto(pool, id)
  if (!m) throw createError({ statusCode: 404, statusMessage: 'Manifiesto no encontrado' })
  return m
})
