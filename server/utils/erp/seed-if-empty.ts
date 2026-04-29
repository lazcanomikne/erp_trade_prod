import type { Pool, RowDataPacket } from 'mysql2/promise'
import { mockProyectos } from '../../../app/utils/mockProyectos'
import { getProyectoDetalleInicial } from '../../../app/utils/mockProyectosDetalle'
import { insertArticulo, insertProyecto } from './repository'

/** Solo si `SEED_ERP=true` (o `NUXT_SEED_ERP=true`) — en producción dejar sin definir o false. */
function seedErpEnabled(): boolean {
  const v = process.env.SEED_ERP ?? process.env.NUXT_SEED_ERP ?? ''
  return String(v).trim().toLowerCase() === 'true'
}

export async function seedDatabaseIfEmpty(pool: Pool): Promise<boolean> {
  if (!seedErpEnabled()) {
    return false
  }

  const [rows] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM proyectos`)
  const n = Number((rows[0] as { n: number }).n ?? 0)
  if (n > 0) {
    return false
  }

  for (const mp of mockProyectos) {
    const det = getProyectoDetalleInicial(mp.idProyecto)
    await insertProyecto(
      pool,
      {
        cliente: mp.cliente,
        nombre: mp.nombre,
        folioPropuesta: mp.folioPropuesta,
        tarifaImportacionPct: det.tarifaImportacionPct,
        despachoAduanalUsd: det.aduanaUsd,
        fleteLogisticaUsd: det.fleteUsd,
        anticipoUsd: det.anticipoUsd,
        maniobrasUsd: 0,
        fleteLaredoMtyUsd: 0,
        fleteNacionalUsd: 0,
        fleteExtra1Label: null,
        fleteExtra1Usd: 0,
        fleteExtra2Label: null,
        fleteExtra2Usd: 0,
        fleteExtra3Label: null,
        fleteExtra3Usd: 0,
        igiPct: 0,
        wireTransferUsd: 0,
        comercializadoraPct: 0
      },
      mp.idProyecto
    )
    await pool.query(`UPDATE proyectos SET estatus = ? WHERE id_proyecto = ?`, [
      mp.estatus,
      mp.idProyecto
    ])
    await pool.query(
      `UPDATE proyecto_finanzas SET porcentaje_servicio = ? WHERE id_proyecto = ?`,
      [det.porcentajeServicio, mp.idProyecto]
    )

    for (const art of det.articulos) {
      await insertArticulo(
        pool,
        mp.idProyecto,
        {
          sg: art.sg,
          referenciaLogistica: art.referenciaLogistica || '',
          descripcion: art.descripcion,
          imagenUrl: art.imagenUrl,
          cantidadTotal: art.cantidadTotal,
          cantidadRecibida: art.cantidadRecibida,
          precioUnitario: art.precioUnitario,
          estatus: art.estatus
        },
        art.id
      )
    }

    for (const pg of det.pagos) {
      await pool.query(
        `INSERT INTO pagos (id, id_proyecto, monto_usd, fecha, nota) VALUES (?, ?, ?, ?, ?)`,
        [pg.id, mp.idProyecto, pg.montoUsd, pg.fecha.slice(0, 10), pg.nota ?? null]
      )
    }
  }

  return true
}
