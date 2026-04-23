import { randomUUID } from 'node:crypto'
import type { Pool, RowDataPacket } from 'mysql2/promise'
import type {
  ArticuloLimbo,
  ArticuloProyecto,
  PagoProyecto,
  Proyecto,
  ProyectoDetalleInicial,
  ProyectoEstatus
} from '~/types'
import { proyectoMetricsFromArticulos } from '~/utils/proyectoMetrics'
import type { ActualizarProyectoBody, AgregarArticuloBody, CrearProyectoBody, ErpSnapshot, ProyectoSnapshot } from './types'

type SqlExecutor = Pick<Pool, 'query'>

function num(v: unknown): number {
  if (v == null) {
    return 0
  }
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function rowArticulo(r: RowDataPacket): ArticuloProyecto {
  return {
    id: String(r.id),
    sg: String(r.sg),
    referenciaLogistica: r.referencia_logistica ? String(r.referencia_logistica) : undefined,
    descripcion: String(r.descripcion),
    imagenUrl: String(r.imagen_url),
    cantidadTotal: Number(r.cantidad_total) || 0,
    cantidadRecibida: Number(r.cantidad_recibida) || 0,
    precioUnitario: num(r.precio_unitario),
    estatus: r.estatus as ArticuloProyecto['estatus']
  }
}

function rowPago(r: RowDataPacket): PagoProyecto {
  return {
    id: String(r.id),
    montoUsd: num(r.monto_usd),
    fecha: String(r.fecha).slice(0, 10),
    nota: r.nota ? String(r.nota) : undefined
  }
}

function rowLimbo(r: RowDataPacket): ArticuloLimbo {
  return {
    id: String(r.id),
    sgProvisional: String(r.sg_provisional),
    descripcion: String(r.descripcion),
    imagenUrl: String(r.imagen_url),
    fechaRegistro: String(r.fecha_registro).slice(0, 10)
  }
}

export async function fetchProyectoSnapshot(pool: Pool, idProyecto: string): Promise<ProyectoSnapshot | null> {
  const [prows] = await pool.query<RowDataPacket[]>(
    `SELECT id_proyecto, cliente, nombre, folio_propuesta, estatus FROM proyectos WHERE id_proyecto = ? LIMIT 1`,
    [idProyecto]
  )
  if (!prows.length) {
    return null
  }
  const p = prows[0]!
  const [frows] = await pool.query<RowDataPacket[]>(
    `SELECT flete_usd, aduana_usd, porcentaje_servicio, tarifa_importacion_pct, anticipo_usd,
            maniobras_usd, flete_laredo_mty_usd, flete_nacional_usd,
            flete_extra_1_label, flete_extra_1_usd,
            flete_extra_2_label, flete_extra_2_usd,
            flete_extra_3_label, flete_extra_3_usd,
            igi_pct, wire_transfer_usd, comercializadora_pct
     FROM proyecto_finanzas WHERE id_proyecto = ? LIMIT 1`,
    [idProyecto]
  )
  const f = frows[0]
  const [arows] = await pool.query<RowDataPacket[]>(
    `SELECT id, sg, referencia_logistica, descripcion, imagen_url, cantidad_total, cantidad_recibida,
            precio_unitario, estatus FROM articulos WHERE id_proyecto = ? ORDER BY id`,
    [idProyecto]
  )
  const [prowsP] = await pool.query<RowDataPacket[]>(
    `SELECT id, monto_usd, fecha, nota FROM pagos WHERE id_proyecto = ? ORDER BY fecha, id`,
    [idProyecto]
  )
  const articulos = arows.map(rowArticulo)
  const pagos = prowsP.map(rowPago)
  const fletesExtra: ProyectoDetalleInicial['fletesExtra'] = []
  for (let i = 1; i <= 3; i++) {
    const label = f?.[`flete_extra_${i}_label`]
    const monto = num(f?.[`flete_extra_${i}_usd`])
    if (label || monto) {
      fletesExtra.push({ label: label ? String(label) : '', monto })
    }
  }
  const detalle: ProyectoDetalleInicial = {
    articulos,
    pagos,
    fleteUsd: num(f?.flete_usd),
    aduanaUsd: num(f?.aduana_usd),
    porcentajeServicio: num(f?.porcentaje_servicio),
    tarifaImportacionPct: num(f?.tarifa_importacion_pct),
    anticipoUsd: num(f?.anticipo_usd),
    maniobrasUsd: num(f?.maniobras_usd),
    fleteLaredoMtyUsd: num(f?.flete_laredo_mty_usd),
    fleteNacionalUsd: num(f?.flete_nacional_usd),
    fletesExtra,
    igiPct: num(f?.igi_pct),
    wireTransferUsd: num(f?.wire_transfer_usd),
    comercializadoraPct: num(f?.comercializadora_pct)
  }
  const m = proyectoMetricsFromArticulos(articulos)
  const cabecera: Proyecto = {
    idProyecto: String(p.id_proyecto),
    cliente: String(p.cliente),
    nombre: String(p.nombre),
    folioPropuesta: p.folio_propuesta ? String(p.folio_propuesta) : undefined,
    estatus: p.estatus as ProyectoEstatus,
    valorTotalUsd: m.valorTotalUsd,
    montoMonterreyUsd: m.montoMonterreyUsd,
    progresoDevengadoPct: m.progresoDevengadoPct
  }
  return { cabecera, detalle }
}

export async function fetchFullSnapshot(pool: Pool): Promise<ErpSnapshot> {
  const [ids] = await pool.query<RowDataPacket[]>(
    `SELECT id_proyecto FROM proyectos ORDER BY created_at DESC, id_proyecto`
  )
  const proyectos: ProyectoSnapshot[] = []
  for (const row of ids) {
    const id = String(row.id_proyecto)
    const snap = await fetchProyectoSnapshot(pool, id)
    if (snap) {
      proyectos.push(snap)
    }
  }
  const [lrows] = await pool.query<RowDataPacket[]>(
    `SELECT id, sg_provisional, descripcion, imagen_url, fecha_registro FROM articulos_limbo ORDER BY fecha_registro DESC, id`
  )
  return { proyectos, limbo: lrows.map(rowLimbo) }
}

export async function updateProyecto(
  pool: Pool,
  idProyecto: string,
  body: ActualizarProyectoBody
): Promise<boolean> {
  const setsP: string[] = []
  const valsP: unknown[] = []
  if (body.cliente !== undefined) {
    setsP.push('cliente = ?')
    valsP.push(body.cliente.trim())
  }
  if (body.nombre !== undefined) {
    setsP.push('nombre = ?')
    valsP.push(body.nombre.trim())
  }
  if (body.folioPropuesta !== undefined) {
    setsP.push('folio_propuesta = ?')
    const fp = typeof body.folioPropuesta === 'string' ? body.folioPropuesta.trim() : ''
    valsP.push(fp.length ? fp : null)
  }
  if (body.estatus !== undefined) {
    setsP.push('estatus = ?')
    valsP.push(body.estatus)
  }
  if (setsP.length) {
    valsP.push(idProyecto)
    await pool.query(`UPDATE proyectos SET ${setsP.join(', ')} WHERE id_proyecto = ?`, valsP)
  }

  const setsF: string[] = []
  const valsF: unknown[] = []
  if (body.tarifaImportacionPct !== undefined) {
    setsF.push('tarifa_importacion_pct = ?')
    valsF.push(body.tarifaImportacionPct)
  }
  if (body.despachoAduanalUsd !== undefined) {
    setsF.push('aduana_usd = ?')
    valsF.push(Math.max(0, body.despachoAduanalUsd))
  }
  if (body.fleteLogisticaUsd !== undefined) {
    setsF.push('flete_usd = ?')
    valsF.push(Math.max(0, body.fleteLogisticaUsd))
  }
  if (body.anticipoUsd !== undefined) {
    setsF.push('anticipo_usd = ?')
    valsF.push(Math.max(0, body.anticipoUsd))
  }
  if (body.maniobrasUsd !== undefined) {
    setsF.push('maniobras_usd = ?')
    valsF.push(Math.max(0, body.maniobrasUsd))
  }
  if (body.fleteLaredoMtyUsd !== undefined) {
    setsF.push('flete_laredo_mty_usd = ?')
    valsF.push(Math.max(0, body.fleteLaredoMtyUsd))
  }
  if (body.fleteNacionalUsd !== undefined) {
    setsF.push('flete_nacional_usd = ?')
    valsF.push(Math.max(0, body.fleteNacionalUsd))
  }
  if (body.fleteExtra1Label !== undefined) {
    setsF.push('flete_extra_1_label = ?')
    valsF.push(body.fleteExtra1Label || null)
  }
  if (body.fleteExtra1Usd !== undefined) {
    setsF.push('flete_extra_1_usd = ?')
    valsF.push(Math.max(0, body.fleteExtra1Usd))
  }
  if (body.fleteExtra2Label !== undefined) {
    setsF.push('flete_extra_2_label = ?')
    valsF.push(body.fleteExtra2Label || null)
  }
  if (body.fleteExtra2Usd !== undefined) {
    setsF.push('flete_extra_2_usd = ?')
    valsF.push(Math.max(0, body.fleteExtra2Usd))
  }
  if (body.fleteExtra3Label !== undefined) {
    setsF.push('flete_extra_3_label = ?')
    valsF.push(body.fleteExtra3Label || null)
  }
  if (body.fleteExtra3Usd !== undefined) {
    setsF.push('flete_extra_3_usd = ?')
    valsF.push(Math.max(0, body.fleteExtra3Usd))
  }
  if (body.igiPct !== undefined) {
    setsF.push('igi_pct = ?')
    valsF.push(Math.max(0, body.igiPct))
  }
  if (body.wireTransferUsd !== undefined) {
    setsF.push('wire_transfer_usd = ?')
    valsF.push(Math.max(0, body.wireTransferUsd))
  }
  if (body.comercializadoraPct !== undefined) {
    setsF.push('comercializadora_pct = ?')
    valsF.push(Math.max(0, body.comercializadoraPct))
  }
  if (setsF.length) {
    valsF.push(idProyecto)
    await pool.query(`UPDATE proyecto_finanzas SET ${setsF.join(', ')} WHERE id_proyecto = ?`, valsF)
  }

  return setsP.length > 0 || setsF.length > 0
}

export async function insertProyecto(pool: Pool, body: CrearProyectoBody, idProyecto: string): Promise<void> {
  const folio = body.folioPropuesta?.trim() || null
  await pool.query(
    `INSERT INTO proyectos (id_proyecto, cliente, nombre, folio_propuesta, estatus)
     VALUES (?, ?, ?, ?, 'En Proceso')`,
    [idProyecto, body.cliente.trim(), body.nombre.trim(), folio]
  )
  await pool.query(
    `INSERT INTO proyecto_finanzas
      (id_proyecto, flete_usd, aduana_usd, porcentaje_servicio, tarifa_importacion_pct, anticipo_usd,
       maniobras_usd, flete_laredo_mty_usd, flete_nacional_usd,
       flete_extra_1_label, flete_extra_1_usd,
       flete_extra_2_label, flete_extra_2_usd,
       flete_extra_3_label, flete_extra_3_usd,
       igi_pct, wire_transfer_usd, comercializadora_pct)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      idProyecto,
      Math.max(0, body.fleteLogisticaUsd),
      Math.max(0, body.despachoAduanalUsd),
      21,
      body.tarifaImportacionPct,
      Math.max(0, body.anticipoUsd),
      Math.max(0, body.maniobrasUsd),
      Math.max(0, body.fleteLaredoMtyUsd),
      Math.max(0, body.fleteNacionalUsd),
      body.fleteExtra1Label || null,
      Math.max(0, body.fleteExtra1Usd),
      body.fleteExtra2Label || null,
      Math.max(0, body.fleteExtra2Usd),
      body.fleteExtra3Label || null,
      Math.max(0, body.fleteExtra3Usd),
      Math.max(0, body.igiPct),
      Math.max(0, body.wireTransferUsd),
      Math.max(0, body.comercializadoraPct)
    ]
  )
}

export async function insertArticulo(
  executor: SqlExecutor,
  idProyecto: string,
  art: AgregarArticuloBody,
  id?: string
): Promise<string> {
  const aid = id ?? `art-${randomUUID()}`
  await executor.query(
    `INSERT INTO articulos (id, id_proyecto, sg, referencia_logistica, descripcion, imagen_url,
      cantidad_total, cantidad_recibida, precio_unitario, estatus)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      aid,
      idProyecto,
      art.sg.trim(),
      art.referenciaLogistica?.trim() || null,
      art.descripcion.trim(),
      art.imagenUrl,
      Math.max(1, Math.floor(art.cantidadTotal)),
      Math.max(0, Math.floor(art.cantidadRecibida)),
      art.precioUnitario,
      art.estatus
    ]
  )
  return aid
}

export async function updateArticuloEstatus(
  pool: Pool,
  idProyecto: string,
  idArticulo: string,
  estatus: ArticuloProyecto['estatus']
): Promise<boolean> {
  const [r] = await pool.query(
    `UPDATE articulos SET estatus = ?, cantidad_recibida = IF(? = 'Monterrey', cantidad_total, cantidad_recibida)
     WHERE id = ? AND id_proyecto = ?`,
    [estatus, estatus, idArticulo, idProyecto]
  )
  const res = r as { affectedRows?: number }
  return (res.affectedRows ?? 0) > 0
}

export async function updateArticuloReferencia(
  pool: Pool,
  idProyecto: string,
  idArticulo: string,
  referenciaLogistica: string | null
): Promise<boolean> {
  const [r] = await pool.query(
    `UPDATE articulos SET referencia_logistica = ? WHERE id = ? AND id_proyecto = ?`,
    [referenciaLogistica || null, idArticulo, idProyecto]
  )
  const res = r as { affectedRows?: number }
  return (res.affectedRows ?? 0) > 0
}

export async function insertPago(pool: Pool, idProyecto: string, montoUsd: number): Promise<void> {
  const id = `pay-${randomUUID()}`
  const fecha = new Date().toISOString().slice(0, 10)
  await pool.query(
    `INSERT INTO pagos (id, id_proyecto, monto_usd, fecha, nota) VALUES (?, ?, ?, ?, NULL)`,
    [id, idProyecto, montoUsd, fecha]
  )
}

export async function bulkLaredoToAduana(
  pool: Pool,
  seleccion: { idProyecto: string, idArticulo: string }[]
): Promise<number> {
  let n = 0
  for (const { idProyecto, idArticulo } of seleccion) {
    const [r] = await pool.query(
      `UPDATE articulos SET estatus = 'En Aduana' WHERE id_proyecto = ? AND id = ? AND estatus = 'Laredo'`,
      [idProyecto, idArticulo]
    )
    const res = r as { affectedRows?: number }
    n += res.affectedRows ?? 0
  }
  return n
}

export async function insertLimbo(
  pool: Pool,
  payload: { sgProvisional: string, descripcion: string, imagenUrl: string }
): Promise<string> {
  const id = `limbo-${randomUUID()}`
  const fecha = new Date().toISOString().slice(0, 10)
  await pool.query(
    `INSERT INTO articulos_limbo (id, sg_provisional, descripcion, imagen_url, fecha_registro)
     VALUES (?, ?, ?, ?, ?)`,
    [id, payload.sgProvisional.trim(), payload.descripcion.trim(), payload.imagenUrl, fecha]
  )
  return id
}

export async function asignarLimbo(
  pool: Pool,
  idLimbo: string,
  idProyecto: string,
  opts: {
    precioUnitario: number
    cantidadTotal?: number
    sgFinal?: string
    marcarRecibidoMonterrey?: boolean
  }
): Promise<boolean> {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [lrows] = await conn.query<RowDataPacket[]>(
      `SELECT id, sg_provisional, descripcion, imagen_url FROM articulos_limbo WHERE id = ? FOR UPDATE`,
      [idLimbo]
    )
    if (!lrows.length) {
      await conn.rollback()
      return false
    }
    const lim = lrows[0]!
    const cant
      = opts.cantidadTotal != null && opts.cantidadTotal > 0 ? Math.floor(opts.cantidadTotal) : 1
    const precio = opts.precioUnitario
    const sg = (opts.sgFinal ?? lim.sg_provisional).toString().trim()
    const enMty = opts.marcarRecibidoMonterrey === true
    const body: AgregarArticuloBody = {
      sg,
      descripcion: String(lim.descripcion),
      imagenUrl: String(lim.imagen_url),
      cantidadTotal: cant,
      cantidadRecibida: enMty ? cant : 0,
      precioUnitario: precio,
      estatus: enMty ? 'Monterrey' : 'Laredo',
      referenciaLogistica: ''
    }
    await insertArticulo(conn, idProyecto, body)
    await conn.query(`DELETE FROM articulos_limbo WHERE id = ?`, [idLimbo])
    await conn.commit()
    return true
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
}
