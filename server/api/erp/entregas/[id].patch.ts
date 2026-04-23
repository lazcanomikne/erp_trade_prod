import { getMysqlPool } from '../../../utils/db'
import { updateEntregaEstatus, fetchEntrega } from '../../../utils/erp/repository'
import type { ActualizarEntregaBody } from '../../../utils/erp/types'

export default defineEventHandler(async (event) => {
  const id = decodeURIComponent(getRouterParam(event, 'id') ?? '')
  const body = await readBody<ActualizarEntregaBody>(event)
  const pool = getMysqlPool()
  await updateEntregaEstatus(pool, id, body)
  return await fetchEntrega(pool, id)
})
