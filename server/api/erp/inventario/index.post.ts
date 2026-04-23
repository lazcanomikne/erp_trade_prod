import { getMysqlPool } from '../../../utils/db'
import { insertInventarioLibre } from '../../../utils/erp/repository'
import type { AgregarInventarioLibreBody } from '../../../utils/erp/types'

export default defineEventHandler(async (event) => {
  const body = await readBody<AgregarInventarioLibreBody>(event)
  if (!body.sg?.trim() || !body.descripcion?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'sg y descripcion son requeridos' })
  }
  const pool = getMysqlPool()
  const id = await insertInventarioLibre(pool, {
    sg: body.sg,
    descripcion: body.descripcion,
    imagenUrl: body.imagenUrl || `https://picsum.photos/seed/${encodeURIComponent(body.sg)}/96/96`,
    marca: body.marca,
    bultos: body.bultos,
    numeroRack: body.numeroRack,
    cantidadTotal: body.cantidadTotal ?? 1,
    precioUnitario: body.precioUnitario ?? 0,
    estatus: body.estatus ?? 'Monterrey',
    referenciaLogistica: body.referenciaLogistica,
    notas: body.notas
  })
  return { id }
})
