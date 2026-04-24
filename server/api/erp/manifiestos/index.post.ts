import { createError, readBody } from 'h3'
import { crearManifiesto } from '../../../utils/erp/repository'
import { getMysqlPool } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    lineas: {
      idArticulo: string
      idProyecto: string
      sg: string
      descripcionOriginal: string
      descripcionGenerica: string
      cantidadCorte: number
      precioOriginal: number
      precioCorte: number
    }[]
    observaciones?: string
  }>(event)

  if (!body?.lineas?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Se requiere al menos una línea' })
  }

  const pool = getMysqlPool()
  return crearManifiesto(pool, body.lineas, body.observaciones)
})
