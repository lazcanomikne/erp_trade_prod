import { createError, getRouterParam, readBody } from 'h3'
import type { ArticuloProyecto } from '~/types'
import {
  fetchFullSnapshot,
  updateArticuloCampos,
  updateArticuloEstatus,
  updateArticuloReferencia
} from '../../../../../utils/erp/repository'
import { getMysqlPool } from '../../../../../utils/db'

export default defineEventHandler(async (event) => {
  const idProyecto = getRouterParam(event, 'id')
  const idArticulo = getRouterParam(event, 'aid')
  if (!idProyecto || !idArticulo) {
    throw createError({ statusCode: 400, statusMessage: 'parámetros inválidos' })
  }
  const body = await readBody<{
    estatus?: ArticuloProyecto['estatus']
    referenciaLogistica?: string | null
    sg?: string
    descripcion?: string
    marca?: string | null
    bultos?: number | null
    numeroRack?: string | null
    cantidadTotal?: number
    precioUnitario?: number
  }>(event)

  const pool = getMysqlPool()

  const isFullEdit = body?.sg !== undefined || body?.descripcion !== undefined ||
    'marca' in (body ?? {}) || 'bultos' in (body ?? {}) || 'numeroRack' in (body ?? {}) ||
    body?.cantidadTotal !== undefined || body?.precioUnitario !== undefined

  if (isFullEdit) {
    const ok = await updateArticuloCampos(pool, idProyecto, idArticulo, {
      sg: body.sg,
      descripcion: body.descripcion,
      marca: 'marca' in body ? body.marca : undefined,
      bultos: 'bultos' in body ? body.bultos : undefined,
      numeroRack: 'numeroRack' in body ? body.numeroRack : undefined,
      cantidadTotal: body.cantidadTotal,
      precioUnitario: body.precioUnitario,
      estatus: body.estatus,
      referenciaLogistica: 'referenciaLogistica' in body ? body.referenciaLogistica : undefined
    })
    if (!ok) {
      throw createError({ statusCode: 404, statusMessage: 'Artículo no encontrado' })
    }
    return fetchFullSnapshot(pool)
  }

  if (body?.estatus) {
    const ok = await updateArticuloEstatus(pool, idProyecto, idArticulo, body.estatus)
    if (!ok) {
      throw createError({ statusCode: 404, statusMessage: 'Artículo no encontrado' })
    }
  }

  if ('referenciaLogistica' in body) {
    const ok = await updateArticuloReferencia(pool, idProyecto, idArticulo, body.referenciaLogistica ?? null)
    if (!ok) {
      throw createError({ statusCode: 404, statusMessage: 'Artículo no encontrado' })
    }
  }

  if (!body?.estatus && !('referenciaLogistica' in body)) {
    throw createError({ statusCode: 400, statusMessage: 'Se requiere al menos un campo a actualizar' })
  }

  return fetchFullSnapshot(pool)
})
