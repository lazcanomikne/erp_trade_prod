import { createError, readBody } from 'h3'
import type { RowDataPacket } from 'mysql2'
import { fetchFullSnapshot, insertPago } from '../../../utils/erp/repository'
import { getMysqlPool } from '../../../utils/db'

interface Asignacion {
  idProyecto: string
  montoUsd: number
}

/**
 * Registra un pago consolidado de un cliente, repartido entre sus proyectos.
 * Cada asignación se guarda como un pago individual en su proyecto (el modelo
 * de datos aplica pagos por proyecto). Comparten fecha, referencia y forma de
 * pago para poder identificarlos como parte del mismo pago del cliente.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{
    cliente?: string
    fecha?: string
    referencia?: string
    formaPago?: string
    asignaciones?: Asignacion[]
  }>(event)

  const cliente = body?.cliente?.trim()
  if (!cliente) {
    throw createError({ statusCode: 400, statusMessage: 'cliente es obligatorio' })
  }

  const asignaciones = Array.isArray(body?.asignaciones) ? body!.asignaciones : []
  const validas = asignaciones
    .map(a => ({ idProyecto: String(a?.idProyecto ?? ''), montoUsd: Number(a?.montoUsd) }))
    .filter(a => a.idProyecto && Number.isFinite(a.montoUsd) && a.montoUsd > 0)

  if (!validas.length) {
    throw createError({ statusCode: 400, statusMessage: 'Se requiere al menos una asignación con monto mayor a cero' })
  }

  const fecha = body?.fecha?.slice(0, 10) || new Date().toISOString().slice(0, 10)
  const referencia = body?.referencia?.trim() || undefined
  const formaPago = body?.formaPago?.trim() || undefined

  const pool = getMysqlPool()

  // Verifica que todos los proyectos existan y pertenezcan al cliente indicado.
  const ids = validas.map(a => a.idProyecto)
  const placeholders = ids.map(() => '?').join(',')
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id_proyecto, cliente FROM proyectos WHERE id_proyecto IN (${placeholders})`,
    ids
  )
  const clientePorProyecto = new Map<string, string>()
  for (const r of rows) clientePorProyecto.set(String(r.id_proyecto), String(r.cliente))

  for (const a of validas) {
    const dueno = clientePorProyecto.get(a.idProyecto)
    if (dueno === undefined) {
      throw createError({ statusCode: 404, statusMessage: `Proyecto ${a.idProyecto} no encontrado` })
    }
    if (dueno !== cliente) {
      throw createError({ statusCode: 400, statusMessage: `El proyecto ${a.idProyecto} no pertenece al cliente ${cliente}` })
    }
  }

  for (const a of validas) {
    await insertPago(pool, a.idProyecto, a.montoUsd, fecha, referencia, formaPago)
  }

  return fetchFullSnapshot(pool)
})
