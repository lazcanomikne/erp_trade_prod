import { randomUUID } from 'node:crypto'
import type { Pool, RowDataPacket } from 'mysql2/promise'
import type {
  ArticuloInventarioLibre,
  ArticuloLimbo,
  ArticuloProyecto,
  Entrega,
  EntregaArticulo,
  EntregaDestino,
  ManifiestoDetalle,
  ManifiestoLinea,
  ManifiestoResumen,
  OtroCargoProyecto,
  PagoHistoriaEntry,
  PagoProyecto,
  Proyecto,
  ProyectoDetalleInicial,
  ProyectoEstatus
} from '~/types'
import { proyectoMetricsFromArticulos } from '~/utils/proyectoMetrics'
import type { ActualizarEntregaBody, ActualizarProyectoBody, AgregarArticuloBody, AgregarInventarioLibreBody, AgregarOtroCargoBody, ArticuloDisponibleDevolucion, CrearDevolucionBody, CrearEntregaBody, CrearProyectoBody, Devolucion, DevolucionArticulo, ErpSnapshot, ProyectoSnapshot } from './types'

type SqlExecutor = Pick<Pool, 'query'>

/** MySQL2 devuelve TIMESTAMP/DATETIME como objetos Date; DATE como string. Este helper normaliza ambos a yyyy-mm-dd. */
function toDateStr(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}

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
    estatus: r.estatus as ArticuloProyecto['estatus'],
    marca: r.marca ? String(r.marca) : undefined,
    bultos: r.bultos != null ? Number(r.bultos) : undefined,
    numeroRack: r.numero_rack ? String(r.numero_rack) : undefined,
    compradoPorTrade: r.comprado_por_trade == null ? true : Boolean(r.comprado_por_trade)
  }
}

function rowPago(r: RowDataPacket): PagoProyecto {
  return {
    id: String(r.id),
    montoUsd: num(r.monto_usd),
    fecha: toDateStr(r.fecha),
    nota: r.nota ? String(r.nota) : undefined,
    referencia: r.referencia ? String(r.referencia) : undefined,
    formaPago: r.forma_pago ? String(r.forma_pago) : undefined
  }
}

function rowLimbo(r: RowDataPacket): ArticuloLimbo {
  return {
    id: String(r.id),
    sgProvisional: String(r.sg_provisional),
    descripcion: String(r.descripcion),
    imagenUrl: String(r.imagen_url),
    fechaRegistro: toDateStr(r.fecha_registro)
  }
}

export async function fetchProyectoSnapshot(pool: Pool, idProyecto: string): Promise<ProyectoSnapshot | null> {
  const [prows] = await pool.query<RowDataPacket[]>(
    `SELECT id_proyecto, cliente, nombre, folio_propuesta, estatus, created_at FROM proyectos WHERE id_proyecto = ? LIMIT 1`,
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
  let arows: RowDataPacket[]
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, sg, referencia_logistica, descripcion, imagen_url, cantidad_total, cantidad_recibida,
              precio_unitario, estatus, marca, bultos, numero_rack, comprado_por_trade FROM articulos WHERE id_proyecto = ? AND deleted_at IS NULL ORDER BY id`,
      [idProyecto]
    )
    arows = rows
  } catch {
    // columna comprado_por_trade aún no existe (migración pendiente) — fallback sin ella
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, sg, referencia_logistica, descripcion, imagen_url, cantidad_total, cantidad_recibida,
              precio_unitario, estatus, marca, bultos, numero_rack FROM articulos WHERE id_proyecto = ? AND deleted_at IS NULL ORDER BY id`,
      [idProyecto]
    )
    arows = rows
  }
  const [prowsP] = await pool.query<RowDataPacket[]>(
    `SELECT id, monto_usd, fecha, nota, referencia, forma_pago FROM pagos WHERE id_proyecto = ? ORDER BY fecha, id`,
    [idProyecto]
  )
  const [orows] = await pool.query<RowDataPacket[]>(
    `SELECT id, descripcion, monto_usd FROM proyecto_otros WHERE id_proyecto = ? ORDER BY id`,
    [idProyecto]
  )
  const articulos = arows.map(rowArticulo)
  const pagos = prowsP.map(rowPago)
  const otrosExtras: OtroCargoProyecto[] = orows.map(r => ({
    id: String(r.id),
    descripcion: String(r.descripcion),
    montoUsd: num(r.monto_usd)
  }))
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
    otrosExtras,
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
    progresoDevengadoPct: m.progresoDevengadoPct,
    createdAt: toDateStr(p.created_at)
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
      cantidad_total, cantidad_recibida, precio_unitario, estatus, marca, bultos, numero_rack, comprado_por_trade)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      art.estatus,
      art.marca?.trim() || null,
      art.bultos ?? 0,
      art.numeroRack?.trim() || null,
      art.compradoPorTrade !== false ? 1 : 0
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

export async function insertPago(
  pool: Pool,
  idProyecto: string,
  montoUsd: number,
  fecha: string,
  referencia?: string,
  formaPago?: string
): Promise<void> {
  const id = `pay-${randomUUID()}`
  await pool.query(
    `INSERT INTO pagos (id, id_proyecto, monto_usd, fecha, nota, referencia, forma_pago) VALUES (?, ?, ?, ?, NULL, ?, ?)`,
    [id, idProyecto, montoUsd, fecha, referencia ?? null, formaPago ?? null]
  )
}

export async function updatePago(
  pool: Pool,
  idPago: string,
  montoUsd: number,
  fecha: string,
  referencia: string | null,
  formaPago: string | null,
  motivo: string
): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, id_proyecto, monto_usd, fecha, referencia, forma_pago FROM pagos WHERE id = ?`,
    [idPago]
  )
  if (!rows.length) throw new Error('Pago no encontrado')
  const before = rows[0]!
  const idProyecto = String(before.id_proyecto)
  await pool.query(
    `UPDATE pagos SET monto_usd = ?, fecha = ?, referencia = ?, forma_pago = ? WHERE id = ?`,
    [montoUsd, fecha, referencia, formaPago, idPago]
  )
  const histId = `phist-${randomUUID()}`
  await pool.query(
    `INSERT INTO pago_historia (id, id_pago, id_proyecto, accion, motivo, snapshot_antes) VALUES (?, ?, ?, 'edicion', ?, ?)`,
    [histId, idPago, idProyecto, motivo, JSON.stringify({
      montoUsd: num(before.monto_usd),
      fecha: toDateStr(before.fecha),
      referencia: before.referencia ? String(before.referencia) : null,
      formaPago: before.forma_pago ? String(before.forma_pago) : null
    })]
  )
}

export async function deletePagoConHistoria(pool: Pool, idPago: string, motivo: string): Promise<void> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, id_proyecto, monto_usd, fecha, referencia, forma_pago FROM pagos WHERE id = ?`,
    [idPago]
  )
  if (!rows.length) throw new Error('Pago no encontrado')
  const before = rows[0]!
  const idProyecto = String(before.id_proyecto)
  const histId = `phist-${randomUUID()}`
  await pool.query(
    `INSERT INTO pago_historia (id, id_pago, id_proyecto, accion, motivo, snapshot_antes) VALUES (?, ?, ?, 'eliminacion', ?, ?)`,
    [histId, idPago, idProyecto, motivo, JSON.stringify({
      montoUsd: num(before.monto_usd),
      fecha: toDateStr(before.fecha),
      referencia: before.referencia ? String(before.referencia) : null,
      formaPago: before.forma_pago ? String(before.forma_pago) : null
    })]
  )
  await pool.query(`DELETE FROM pagos WHERE id = ?`, [idPago])
}

export async function fetchPagoHistoria(pool: Pool, idProyecto: string): Promise<PagoHistoriaEntry[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, id_pago, accion, motivo, snapshot_antes, created_at FROM pago_historia WHERE id_proyecto = ? ORDER BY created_at DESC`,
    [idProyecto]
  )
  return rows.map(r => ({
    id: String(r.id),
    idPago: String(r.id_pago),
    accion: String(r.accion) as 'edicion' | 'eliminacion',
    motivo: String(r.motivo),
    snapshotAntes: JSON.parse(String(r.snapshot_antes)),
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at)
  }))
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

export async function insertOtroCargo(
  pool: Pool,
  idProyecto: string,
  body: AgregarOtroCargoBody
): Promise<string> {
  const id = `otro-${randomUUID()}`
  await pool.query(
    `INSERT INTO proyecto_otros (id, id_proyecto, descripcion, monto_usd) VALUES (?, ?, ?, ?)`,
    [id, idProyecto, body.descripcion.trim(), Math.max(0, body.montoUsd)]
  )
  return id
}

export async function deleteOtroCargo(
  pool: Pool,
  idProyecto: string,
  idOtro: string
): Promise<boolean> {
  const [r] = await pool.query(
    `DELETE FROM proyecto_otros WHERE id = ? AND id_proyecto = ?`,
    [idOtro, idProyecto]
  )
  return ((r as { affectedRows?: number }).affectedRows ?? 0) > 0
}

export async function updateOtroCargo(
  pool: Pool,
  idProyecto: string,
  idOtro: string,
  body: Partial<AgregarOtroCargoBody>
): Promise<boolean> {
  const sets: string[] = []
  const vals: unknown[] = []
  if (body.descripcion !== undefined) {
    sets.push('descripcion = ?')
    vals.push(body.descripcion.trim())
  }
  if (body.montoUsd !== undefined) {
    sets.push('monto_usd = ?')
    vals.push(Math.max(0, body.montoUsd))
  }
  if (!sets.length) return false
  vals.push(idOtro, idProyecto)
  const [r] = await pool.query(
    `UPDATE proyecto_otros SET ${sets.join(', ')} WHERE id = ? AND id_proyecto = ?`,
    vals
  )
  return ((r as { affectedRows?: number }).affectedRows ?? 0) > 0
}

// ─── Inventario libre ────────────────────────────────────────────────────────

export async function fetchInventarioLibre(pool: Pool): Promise<ArticuloInventarioLibre[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, sg, descripcion, imagen_url, marca, bultos, numero_rack,
            cantidad_total, precio_unitario, estatus, referencia_logistica, notas
     FROM inventario_libre ORDER BY created_at DESC`
  )
  return rows.map(r => ({
    id: String(r.id),
    sg: String(r.sg),
    descripcion: String(r.descripcion),
    imagenUrl: String(r.imagen_url),
    marca: r.marca ? String(r.marca) : undefined,
    bultos: r.bultos != null ? Number(r.bultos) : undefined,
    numeroRack: r.numero_rack ? String(r.numero_rack) : undefined,
    cantidadTotal: Number(r.cantidad_total) || 1,
    precioUnitario: num(r.precio_unitario),
    estatus: r.estatus as ArticuloInventarioLibre['estatus'],
    referenciaLogistica: r.referencia_logistica ? String(r.referencia_logistica) : undefined,
    notas: r.notas ? String(r.notas) : undefined
  }))
}

export async function insertInventarioLibre(pool: Pool, body: AgregarInventarioLibreBody): Promise<string> {
  const id = `inv-${randomUUID()}`
  await pool.query(
    `INSERT INTO inventario_libre (id, sg, descripcion, imagen_url, marca, bultos, numero_rack,
      cantidad_total, precio_unitario, estatus, referencia_logistica, notas)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, body.sg.trim(), body.descripcion.trim(), body.imagenUrl,
      body.marca?.trim() || null, body.bultos ?? 0, body.numeroRack?.trim() || null,
      Math.max(1, body.cantidadTotal), body.precioUnitario, body.estatus,
      body.referenciaLogistica?.trim() || null, body.notas?.trim() || null
    ]
  )
  return id
}

// ─── Entregas ────────────────────────────────────────────────────────────────

function rowEntregaArticulo(r: RowDataPacket): EntregaArticulo {
  return {
    id: String(r.id),
    idEntrega: String(r.id_entrega),
    idProyecto: r.id_proyecto ? String(r.id_proyecto) : null,
    idArticulo: String(r.id_articulo),
    descripcion: String(r.descripcion),
    sg: String(r.sg),
    cliente: String(r.cliente),
    cantidad: Number(r.cantidad) || 1,
    entregado: Boolean(r.entregado)
  }
}

function rowEntregaDestino(r: RowDataPacket): EntregaDestino {
  return {
    id: String(r.id),
    idEntrega: String(r.id_entrega),
    cliente: String(r.cliente),
    direccion: r.direccion ? String(r.direccion) : '',
    orden: Number(r.orden) || 0,
    confirmado: Boolean(r.confirmado),
    firmaUrl: r.firma_url ? String(r.firma_url) : null,
    fotoUrl: r.foto_url ? String(r.foto_url) : null
  }
}

export async function fetchEntregas(pool: Pool): Promise<Entrega[]> {
  const [erows] = await pool.query<RowDataPacket[]>(
    `SELECT id, descripcion, fecha_programada, chofer, origen, estatus, notas, created_at
     FROM entregas ORDER BY created_at DESC`
  )
  const entregas: Entrega[] = []
  for (const e of erows) {
    const id = String(e.id)
    const [arows] = await pool.query<RowDataPacket[]>(
      `SELECT id, id_entrega, id_proyecto, id_articulo, descripcion, sg, cliente, cantidad, entregado
       FROM entrega_articulos WHERE id_entrega = ? ORDER BY id`, [id]
    )
    const [drows] = await pool.query<RowDataPacket[]>(
      `SELECT id, id_entrega, cliente, direccion, orden, confirmado, firma_url, foto_url
       FROM entrega_destinos WHERE id_entrega = ? ORDER BY orden, id`, [id]
    )
    entregas.push({
      id,
      descripcion: String(e.descripcion),
      fechaProgramada: e.fecha_programada ? String(e.fecha_programada).slice(0, 10) : null,
      chofer: String(e.chofer || ''),
      origen: e.origen ? String(e.origen) : '',
      estatus: e.estatus as Entrega['estatus'],
      notas: e.notas ? String(e.notas) : '',
      createdAt: toDateStr(e.created_at),
      articulos: arows.map(rowEntregaArticulo),
      destinos: drows.map(rowEntregaDestino)
    })
  }
  return entregas
}

export async function fetchEntrega(pool: Pool, id: string): Promise<Entrega | null> {
  const [erows] = await pool.query<RowDataPacket[]>(
    `SELECT id, descripcion, fecha_programada, chofer, origen, estatus, notas, created_at
     FROM entregas WHERE id = ? LIMIT 1`, [id]
  )
  if (!erows.length) return null
  const e = erows[0]!
  const [arows] = await pool.query<RowDataPacket[]>(
    `SELECT id, id_entrega, id_proyecto, id_articulo, descripcion, sg, cliente, cantidad, entregado
     FROM entrega_articulos WHERE id_entrega = ? ORDER BY id`, [id]
  )
  const [drows] = await pool.query<RowDataPacket[]>(
    `SELECT id, id_entrega, cliente, direccion, orden, confirmado, firma_url, foto_url
     FROM entrega_destinos WHERE id_entrega = ? ORDER BY orden, id`, [id]
  )
  return {
    id,
    descripcion: String(e.descripcion),
    fechaProgramada: e.fecha_programada ? String(e.fecha_programada).slice(0, 10) : null,
    chofer: String(e.chofer || ''),
    origen: e.origen ? String(e.origen) : '',
    estatus: e.estatus as Entrega['estatus'],
    notas: e.notas ? String(e.notas) : '',
    createdAt: String(e.created_at).slice(0, 10),
    articulos: arows.map(rowEntregaArticulo),
    destinos: drows.map(rowEntregaDestino)
  }
}

export async function insertEntrega(pool: Pool, body: CrearEntregaBody): Promise<string> {
  const id = `ent-${randomUUID()}`
  await pool.query(
    `INSERT INTO entregas (id, descripcion, fecha_programada, chofer, origen, notas)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id, body.descripcion.trim(), body.fechaProgramada || null,
      body.chofer?.trim() || '', body.origen?.trim() || null, body.notas?.trim() || null
    ]
  )
  for (let i = 0; i < body.destinos.length; i++) {
    const d = body.destinos[i]!
    const did = `dest-${randomUUID()}`
    await pool.query(
      `INSERT INTO entrega_destinos (id, id_entrega, cliente, direccion, orden) VALUES (?, ?, ?, ?, ?)`,
      [did, id, d.cliente.trim(), d.direccion?.trim() || null, i]
    )
  }
  for (const a of body.articulos) {
    const aid = `ea-${randomUUID()}`
    await pool.query(
      `INSERT INTO entrega_articulos (id, id_entrega, id_proyecto, id_articulo, descripcion, sg, cliente, cantidad)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        aid, id, a.idProyecto || null, a.idArticulo, a.descripcion.trim(),
        a.sg.trim(), a.cliente.trim(), Math.max(1, a.cantidad)
      ]
    )
  }
  return id
}

export async function updateEntregaEstatus(pool: Pool, id: string, body: ActualizarEntregaBody): Promise<boolean> {
  const sets: string[] = []
  const vals: unknown[] = []
  if (body.descripcion !== undefined) {
    sets.push('descripcion = ?')
    vals.push(body.descripcion.trim())
  }
  if (body.fechaProgramada !== undefined) {
    sets.push('fecha_programada = ?')
    vals.push(body.fechaProgramada || null)
  }
  if (body.chofer !== undefined) {
    sets.push('chofer = ?')
    vals.push(body.chofer.trim())
  }
  if (body.origen !== undefined) {
    sets.push('origen = ?')
    vals.push(body.origen.trim() || null)
  }
  if (body.estatus !== undefined) {
    sets.push('estatus = ?')
    vals.push(body.estatus)
  }
  if (body.notas !== undefined) {
    sets.push('notas = ?')
    vals.push(body.notas.trim() || null)
  }
  if (!sets.length) return false
  vals.push(id)
  const [r] = await pool.query(`UPDATE entregas SET ${sets.join(', ')} WHERE id = ?`, vals)
  return ((r as { affectedRows?: number }).affectedRows ?? 0) > 0
}

export async function updateEntregaArticuloEntregado(pool: Pool, idArticulo: string, entregado: boolean): Promise<boolean> {
  const [r] = await pool.query(
    `UPDATE entrega_articulos SET entregado = ? WHERE id = ?`, [entregado ? 1 : 0, idArticulo]
  )
  return ((r as { affectedRows?: number }).affectedRows ?? 0) > 0
}

export async function updateArticuloCampos(
  pool: Pool,
  idProyecto: string,
  idArticulo: string,
  campos: Partial<{
    sg: string
    descripcion: string
    marca: string | null
    bultos: number | null
    numeroRack: string | null
    cantidadTotal: number
    precioUnitario: number
    estatus: ArticuloProyecto['estatus']
    referenciaLogistica: string | null
    compradoPorTrade: boolean
  }>
): Promise<boolean> {
  const sets: string[] = []
  const vals: unknown[] = []
  if (campos.sg !== undefined) {
    sets.push('sg = ?')
    vals.push(campos.sg.trim())
  }
  if (campos.descripcion !== undefined) {
    sets.push('descripcion = ?')
    vals.push(campos.descripcion.trim())
  }
  if ('marca' in campos) {
    sets.push('marca = ?')
    vals.push(campos.marca?.trim() || null)
  }
  if ('bultos' in campos) {
    sets.push('bultos = ?')
    vals.push(campos.bultos ?? 0)
  }
  if ('numeroRack' in campos) {
    sets.push('numero_rack = ?')
    vals.push(campos.numeroRack?.trim() || null)
  }
  if (campos.cantidadTotal !== undefined) {
    sets.push('cantidad_total = ?')
    vals.push(Math.max(1, Math.floor(campos.cantidadTotal)))
  }
  if (campos.precioUnitario !== undefined) {
    sets.push('precio_unitario = ?')
    vals.push(Math.max(0, campos.precioUnitario))
  }
  if (campos.estatus !== undefined) {
    sets.push('estatus = ?')
    vals.push(campos.estatus)
  }
  if ('referenciaLogistica' in campos) {
    sets.push('referencia_logistica = ?')
    vals.push(campos.referenciaLogistica?.trim() || null)
  }
  if ('compradoPorTrade' in campos) {
    sets.push('comprado_por_trade = ?')
    vals.push(campos.compradoPorTrade ? 1 : 0)
  }
  if (!sets.length) return false
  vals.push(idArticulo, idProyecto)
  const [r] = await pool.query(
    `UPDATE articulos SET ${sets.join(', ')} WHERE id = ? AND id_proyecto = ? AND deleted_at IS NULL`,
    vals
  )
  return ((r as { affectedRows?: number }).affectedRows ?? 0) > 0
}

export async function softDeleteArticulo(
  pool: Pool,
  idArticulo: string,
  comentario: string
): Promise<boolean> {
  const [r] = await pool.query(
    `UPDATE articulos SET deleted_at = NOW(), eliminacion_comentario = ? WHERE id = ? AND deleted_at IS NULL`,
    [comentario.trim(), idArticulo]
  )
  return ((r as { affectedRows?: number }).affectedRows ?? 0) > 0
}

export async function restoreArticulo(pool: Pool, idArticulo: string): Promise<boolean> {
  const [r] = await pool.query(
    `UPDATE articulos SET deleted_at = NULL, eliminacion_comentario = NULL WHERE id = ?`,
    [idArticulo]
  )
  return ((r as { affectedRows?: number }).affectedRows ?? 0) > 0
}

export interface ArticuloEliminadoRow {
  id: string
  idProyecto: string
  sg: string
  descripcion: string
  imagenUrl: string
  marca?: string
  bultos?: number
  numeroRack?: string
  cantidadTotal: number
  precioUnitario: number
  estatus: ArticuloProyecto['estatus']
  referenciaLogistica?: string
  deletedAt: string
  eliminacionComentario: string | null
}

export async function fetchArticulosEliminados(pool: Pool): Promise<ArticuloEliminadoRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.id, a.id_proyecto, a.sg, a.descripcion, a.imagen_url, a.marca, a.bultos, a.numero_rack,
            a.cantidad_total, a.precio_unitario, a.estatus, a.referencia_logistica,
            a.deleted_at, a.eliminacion_comentario,
            p.nombre AS proyecto_nombre, p.cliente AS proyecto_cliente
     FROM articulos a
     LEFT JOIN proyectos p ON p.id_proyecto = a.id_proyecto
     WHERE a.deleted_at IS NOT NULL
     ORDER BY a.deleted_at DESC`
  )
  return rows.map(r => ({
    id: String(r.id),
    idProyecto: String(r.id_proyecto),
    proyectoNombre: r.proyecto_nombre ? String(r.proyecto_nombre) : undefined,
    proyectoCliente: r.proyecto_cliente ? String(r.proyecto_cliente) : undefined,
    sg: String(r.sg),
    descripcion: String(r.descripcion),
    imagenUrl: String(r.imagen_url),
    marca: r.marca ? String(r.marca) : undefined,
    bultos: r.bultos != null ? Number(r.bultos) : undefined,
    numeroRack: r.numero_rack ? String(r.numero_rack) : undefined,
    cantidadTotal: Number(r.cantidad_total) || 1,
    precioUnitario: num(r.precio_unitario),
    estatus: r.estatus as ArticuloProyecto['estatus'],
    referenciaLogistica: r.referencia_logistica ? String(r.referencia_logistica) : undefined,
    deletedAt: String(r.deleted_at).slice(0, 19).replace('T', ' '),
    eliminacionComentario: r.eliminacion_comentario ? String(r.eliminacion_comentario) : null
  }))
}

export async function updateDestinoConfirmacion(
  pool: Pool, idDestino: string,
  data: { confirmado: boolean, firmaUrl?: string | null, fotoUrl?: string | null }
): Promise<boolean> {
  const sets: string[] = ['confirmado = ?']
  const vals: unknown[] = [data.confirmado ? 1 : 0]
  if (data.firmaUrl !== undefined) {
    sets.push('firma_url = ?')
    vals.push(data.firmaUrl || null)
  }
  if (data.fotoUrl !== undefined) {
    sets.push('foto_url = ?')
    vals.push(data.fotoUrl || null)
  }
  vals.push(idDestino)
  const [r] = await pool.query(`UPDATE entrega_destinos SET ${sets.join(', ')} WHERE id = ?`, vals)
  return ((r as { affectedRows?: number }).affectedRows ?? 0) > 0
}

// ─── Manifiestos ──────────────────────────────────────────────────────────────

type LineaInput = {
  idArticulo: string
  idProyecto: string
  sg: string
  descripcionOriginal: string
  descripcionGenerica: string
  cantidadCorte: number
  precioOriginal: number
  precioCorte: number
}

export async function crearManifiesto(
  pool: Pool,
  lineas: LineaInput[],
  observaciones?: string
): Promise<{ id: string, folio: number }> {
  const [[folioRow]] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(MAX(folio), 0) + 1 AS siguiente FROM manifiestos`
  )
  const folio = Number((folioRow as RowDataPacket & { siguiente: number }).siguiente)
  const id = `man-${randomUUID()}`
  const fecha = new Date().toISOString().slice(0, 10)
  await pool.query(
    `INSERT INTO manifiestos (id, folio, fecha, observaciones) VALUES (?, ?, ?, ?)`,
    [id, folio, fecha, observaciones ?? null]
  )
  for (const l of lineas) {
    const lid = `ml-${randomUUID()}`
    await pool.query(
      `INSERT INTO manifiesto_lineas (id, id_manifiesto, id_articulo, id_proyecto, sg, descripcion_original, descripcion_generica, cantidad_corte, precio_original, precio_corte) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [lid, id, l.idArticulo, l.idProyecto, l.sg, l.descripcionOriginal, l.descripcionGenerica, l.cantidadCorte, l.precioOriginal, l.precioCorte]
    )
    await pool.query(
      `UPDATE articulos SET estatus = 'En Aduana' WHERE id = ? AND estatus = 'Laredo'`,
      [l.idArticulo]
    )
  }
  return { id, folio }
}

function rowManifiestoLinea(r: RowDataPacket): ManifiestoLinea {
  return {
    id: String(r.id),
    idManifiesto: String(r.id_manifiesto),
    idArticulo: String(r.id_articulo),
    idProyecto: String(r.id_proyecto),
    nombreProyecto: r.nombre_proyecto ? String(r.nombre_proyecto) : '',
    cliente: r.cliente ? String(r.cliente) : '',
    sg: String(r.sg),
    descripcionOriginal: String(r.descripcion_original),
    descripcionGenerica: String(r.descripcion_generica),
    cantidadCorte: Number(r.cantidad_corte),
    precioOriginal: num(r.precio_original),
    precioCorte: num(r.precio_corte)
  }
}

export async function listarManifiestos(pool: Pool): Promise<ManifiestoResumen[]> {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT m.id, m.folio, m.fecha, m.observaciones, m.created_at,
           COUNT(ml.id) AS total_lineas,
           COALESCE(SUM(ml.precio_corte * ml.cantidad_corte), 0) AS total_valor,
           GROUP_CONCAT(DISTINCT p.nombre ORDER BY p.nombre SEPARATOR '||') AS proyectos
    FROM manifiestos m
    LEFT JOIN manifiesto_lineas ml ON ml.id_manifiesto = m.id
    LEFT JOIN proyectos p ON p.id_proyecto = ml.id_proyecto
    GROUP BY m.id
    ORDER BY m.folio DESC
  `)
  return rows.map(r => ({
    id: String(r.id),
    folio: Number(r.folio),
    fecha: toDateStr(r.fecha),
    observaciones: r.observaciones ? String(r.observaciones) : null,
    totalLineas: Number(r.total_lineas),
    totalValorCorte: num(r.total_valor),
    proyectos: r.proyectos ? String(r.proyectos).split('||') : [],
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at)
  }))
}

export async function fetchManifiesto(pool: Pool, id: string): Promise<ManifiestoDetalle | null> {
  const [[mRow]] = await pool.query<RowDataPacket[]>(
    `SELECT id, folio, fecha, observaciones, created_at FROM manifiestos WHERE id = ?`,
    [id]
  )
  if (!mRow) return null
  const [lRows] = await pool.query<RowDataPacket[]>(`
    SELECT ml.*, p.nombre AS nombre_proyecto, p.cliente
    FROM manifiesto_lineas ml
    LEFT JOIN proyectos p ON p.id_proyecto = ml.id_proyecto
    WHERE ml.id_manifiesto = ?
    ORDER BY ml.id
  `, [id])
  return {
    id: String(mRow.id),
    folio: Number(mRow.folio),
    fecha: toDateStr(mRow.fecha),
    observaciones: mRow.observaciones ? String(mRow.observaciones) : null,
    createdAt: mRow.created_at instanceof Date ? mRow.created_at.toISOString() : String(mRow.created_at),
    lineas: lRows.map(rowManifiestoLinea)
  }
}

export async function fetchManifiestosByProyecto(pool: Pool, idProyecto: string): Promise<ManifiestoResumen[]> {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT m.id, m.folio, m.fecha, m.observaciones, m.created_at,
           COUNT(ml.id) AS total_lineas,
           COALESCE(SUM(ml.precio_corte * ml.cantidad_corte), 0) AS total_valor,
           GROUP_CONCAT(DISTINCT p.nombre ORDER BY p.nombre SEPARATOR '||') AS proyectos
    FROM manifiestos m
    JOIN manifiesto_lineas ml ON ml.id_manifiesto = m.id
    LEFT JOIN proyectos p ON p.id_proyecto = ml.id_proyecto
    WHERE EXISTS (
      SELECT 1 FROM manifiesto_lineas ml2
      WHERE ml2.id_manifiesto = m.id AND ml2.id_proyecto = ?
    )
    GROUP BY m.id
    ORDER BY m.folio DESC
  `, [idProyecto])
  return rows.map(r => ({
    id: String(r.id),
    folio: Number(r.folio),
    fecha: toDateStr(r.fecha),
    observaciones: r.observaciones ? String(r.observaciones) : null,
    totalLineas: Number(r.total_lineas),
    totalValorCorte: num(r.total_valor),
    proyectos: r.proyectos ? String(r.proyectos).split('||') : [],
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at)
  }))
}

export async function updateManifiestoLinea(
  pool: Pool,
  lineaId: string,
  data: { descripcionGenerica: string, cantidadCorte: number, precioCorte: number }
): Promise<void> {
  await pool.query(
    `UPDATE manifiesto_lineas SET descripcion_generica = ?, cantidad_corte = ?, precio_corte = ? WHERE id = ?`,
    [data.descripcionGenerica, data.cantidadCorte, data.precioCorte, lineaId]
  )
}

export async function deleteManifiestoLinea(pool: Pool, lineaId: string): Promise<void> {
  const [[row]] = await pool.query<RowDataPacket[]>(
    `SELECT id_articulo FROM manifiesto_lineas WHERE id = ?`,
    [lineaId]
  )
  if (!row) return
  await pool.query(`DELETE FROM manifiesto_lineas WHERE id = ?`, [lineaId])
  await pool.query(
    `UPDATE articulos SET estatus = 'Laredo' WHERE id = ?`,
    [String(row.id_articulo)]
  )
}

// ─── Devoluciones ─────────────────────────────────────────────────────────────

export async function fetchArticulosDisponiblesDevolucion(pool: Pool): Promise<ArticuloDisponibleDevolucion[]> {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT a.id AS idArticulo, a.id_proyecto AS idProyecto, p.nombre AS nombreProyecto,
           a.sg, a.descripcion, a.cantidad_total AS cantidadTotal, a.cantidad_recibida AS cantidadRecibida
    FROM articulos a
    JOIN proyectos p ON p.id_proyecto = a.id_proyecto
    WHERE a.estatus = 'Monterrey'
      AND a.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM entrega_articulos ea WHERE ea.id_articulo = a.id AND ea.entregado = 1
      )
    ORDER BY p.nombre, a.sg
  `)
  return rows.map(r => ({
    idArticulo: String(r.idArticulo),
    idProyecto: String(r.idProyecto),
    nombreProyecto: String(r.nombreProyecto),
    sg: String(r.sg),
    descripcion: String(r.descripcion),
    cantidadTotal: Number(r.cantidadTotal) || 0,
    cantidadRecibida: Number(r.cantidadRecibida) || 0
  }))
}

export async function fetchDevoluciones(pool: Pool): Promise<Devolucion[]> {
  const [devRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, numero, fecha, destino, notas, created_at FROM devoluciones ORDER BY numero DESC`
  )
  if (!devRows.length) return []
  const ids = devRows.map(r => r.id)
  const [artRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, id_devolucion, id_proyecto, id_articulo, sg, descripcion, cantidad, motivo, motivo_detalle
     FROM devolucion_articulos WHERE id_devolucion IN (${ids.map(() => '?').join(',')})`,
    ids
  )
  return devRows.map(r => ({
    id: String(r.id),
    numero: Number(r.numero),
    fecha: toDateStr(r.fecha),
    destino: String(r.destino) as Devolucion['destino'],
    notas: r.notas ? String(r.notas) : undefined,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    articulos: artRows
      .filter(a => a.id_devolucion === r.id)
      .map(a => ({
        id: String(a.id),
        idDevolucion: String(a.id_devolucion),
        idProyecto: String(a.id_proyecto),
        idArticulo: String(a.id_articulo),
        sg: String(a.sg),
        descripcion: String(a.descripcion),
        cantidad: Number(a.cantidad) || 1,
        motivo: String(a.motivo) as DevolucionArticulo['motivo'],
        motivoDetalle: a.motivo_detalle ? String(a.motivo_detalle) : undefined
      }))
  }))
}

export async function insertDevolucion(pool: Pool, body: CrearDevolucionBody): Promise<string> {
  const [[numRow]] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(MAX(numero), 0) + 1 AS siguiente FROM devoluciones`
  )
  const numero = Number((numRow as RowDataPacket & { siguiente: number }).siguiente)
  const id = `dev-${randomUUID()}`
  const fecha = new Date().toISOString().slice(0, 10)
  await pool.query(
    `INSERT INTO devoluciones (id, numero, fecha, destino, notas) VALUES (?, ?, ?, ?, ?)`,
    [id, numero, fecha, body.destino, body.notas?.trim() || null]
  )
  for (const a of body.articulos) {
    const aid = `da-${randomUUID()}`
    await pool.query(
      `INSERT INTO devolucion_articulos (id, id_devolucion, id_proyecto, id_articulo, sg, descripcion, cantidad, motivo, motivo_detalle)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        aid, id, a.idProyecto, a.idArticulo, a.sg.trim(),
        a.descripcion.trim(), Math.max(1, a.cantidad),
        a.motivo, a.motivoDetalle?.trim() || null
      ]
    )
    await pool.query(
      `UPDATE articulos SET estatus = ? WHERE id = ? AND deleted_at IS NULL`,
      [body.destino, a.idArticulo]
    )
  }
  return id
}
