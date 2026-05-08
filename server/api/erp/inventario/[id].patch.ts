import { createError, getRouterParam, readBody } from 'h3'
import type { ArticuloInventarioLibre } from '~/types'
import { getMysqlPool } from '../../../utils/db'
import { ensureErpSchema } from '../../../utils/erp/ensure-schema'
import { updateInventarioLibreCampos } from '../../../utils/erp/repository'

let schemaSynced = false

export default defineEventHandler(async (event) => {
  const idArticulo = getRouterParam(event, 'id')
  if (!idArticulo) {
    throw createError({ statusCode: 400, statusMessage: 'parámetros inválidos' })
  }
  const body = await readBody<{
    estatus?: ArticuloInventarioLibre['estatus']
    referenciaLogistica?: string | null
    sg?: string
    descripcion?: string
    marca?: string | null
    bultos?: number | null
    numeroRack?: string | null
    cantidadTotal?: number
    precioUnitario?: number
  }>(event)

  const isFullEdit = body?.sg !== undefined
    || body?.descripcion !== undefined
    || 'marca' in (body ?? {})
    || 'bultos' in (body ?? {})
    || 'numeroRack' in (body ?? {})
    || body?.cantidadTotal !== undefined
    || body?.precioUnitario !== undefined
    || body?.estatus !== undefined
    || 'referenciaLogistica' in (body ?? {})

  if (!isFullEdit) {
    throw createError({ statusCode: 400, statusMessage: 'Se requiere al menos un campo a actualizar' })
  }

  const pool = getMysqlPool()
  if (!schemaSynced) {
    await ensureErpSchema(pool)
    schemaSynced = true
  }

  const ok = await updateInventarioLibreCampos(pool, idArticulo, {
    sg: body.sg,
    descripcion: body.descripcion,
    marca: 'marca' in (body ?? {}) ? body.marca : undefined,
    bultos: 'bultos' in (body ?? {}) ? body.bultos : undefined,
    numeroRack: 'numeroRack' in (body ?? {}) ? body.numeroRack : undefined,
    cantidadTotal: body.cantidadTotal,
    precioUnitario: body.precioUnitario,
    estatus: body.estatus,
    referenciaLogistica: 'referenciaLogistica' in (body ?? {}) ? body.referenciaLogistica : undefined
  })

  if (!ok) {
    throw createError({ statusCode: 404, statusMessage: 'Artículo no encontrado' })
  }

  return { ok: true }
})
