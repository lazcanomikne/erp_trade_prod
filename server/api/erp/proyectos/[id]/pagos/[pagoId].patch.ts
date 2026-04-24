import { createError, getRouterParam, readBody } from 'h3'
import { fetchFullSnapshot, updatePago } from '../../../../../utils/erp/repository'
import { getMysqlPool } from '../../../../../utils/db'

export default defineEventHandler(async (event) => {
  const pagoId = getRouterParam(event, 'pagoId')
  if (!pagoId) {
    throw createError({ statusCode: 400, statusMessage: 'pagoId requerido' })
  }
  const body = await readBody<{
    montoUsd: number
    fecha: string
    referencia?: string | null
    formaPago?: string | null
    motivo: string
  }>(event)
  const m = Number(body?.montoUsd)
  if (!Number.isFinite(m) || m <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'montoUsd inválido' })
  }
  if (!body?.fecha) {
    throw createError({ statusCode: 400, statusMessage: 'fecha requerida' })
  }
  const pool = getMysqlPool()
  await updatePago(
    pool,
    pagoId,
    m,
    body.fecha.slice(0, 10),
    body.referencia ?? null,
    body.formaPago ?? null,
    body.motivo ?? ''
  )
  return fetchFullSnapshot(pool)
})
