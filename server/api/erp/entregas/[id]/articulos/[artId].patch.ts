import { getMysqlPool } from '../../../../../utils/db'
import { updateEntregaArticuloEntregado } from '../../../../../utils/erp/repository'

export default defineEventHandler(async (event) => {
  const artId = decodeURIComponent(getRouterParam(event, 'artId') ?? '')
  const { entregado } = await readBody<{ entregado: boolean }>(event)
  const pool = getMysqlPool()
  const ok = await updateEntregaArticuloEntregado(pool, artId, entregado)
  return { ok }
})
