import { getMysqlPool } from '../../../utils/db'
import { fetchArticulosDisponiblesDevolucion } from '../../../utils/erp/repository'

export default defineEventHandler(async () => {
  try {
    const pool = getMysqlPool()
    return await fetchArticulosDisponiblesDevolucion(pool)
  } catch (err) {
    console.error('[devoluciones/disponibles]', err)
    return []
  }
})
