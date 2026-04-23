import { getMysqlPool } from '../../../../../utils/db'
import { updateDestinoConfirmacion } from '../../../../../utils/erp/repository'

export default defineEventHandler(async (event) => {
  const destId = decodeURIComponent(getRouterParam(event, 'destId') ?? '')
  const body = await readBody<{ confirmado: boolean; firmaUrl?: string | null; fotoUrl?: string | null }>(event)
  const pool = getMysqlPool()
  const ok = await updateDestinoConfirmacion(pool, destId, body)
  return { ok }
})
