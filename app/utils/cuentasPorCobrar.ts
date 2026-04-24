import type { CuentaPorCobrarFila, Proyecto } from '~/types'
import { totalProyectoConCargosUsd } from '~/utils/proyectoCalculos'

function ultimaFecha(fechas: string[]): string | null {
  if (!fechas.length) return null
  return [...fechas].sort((a, b) => b.localeCompare(a))[0] ?? null
}

export function filaFinanzasDesdeProyecto(p: Proyecto): CuentaPorCobrarFila {
  const store = useInventarioStore()
  const d = store.detalle(p.idProyecto)

  const totalProyecto = totalProyectoConCargosUsd(
    d.articulos, d.tarifaImportacionPct, d.aduanaUsd, d.fleteUsd,
    {
      maniobrasUsd: d.maniobrasUsd, fleteLaredoMtyUsd: d.fleteLaredoMtyUsd,
      fleteNacionalUsd: d.fleteNacionalUsd, fletesExtra: d.fletesExtra,
      otrosExtras: d.otrosExtras, igiPct: d.igiPct,
      wireTransferUsd: d.wireTransferUsd, comercializadoraPct: d.comercializadoraPct
    }
  )

  const pagosRecibidos = d.pagos.reduce((s, x) => s + x.montoUsd, 0) + d.anticipoUsd
  const saldo = Math.max(0, totalProyecto - pagosRecibidos)

  // Fechas de pagos + fecha del anticipo (createdAt del proyecto) si hay anticipo
  const fechas: string[] = d.pagos.map(x => x.fecha)
  if (d.anticipoUsd > 0) fechas.push(p.createdAt)
  const ultimoPagoFecha = ultimaFecha(fechas)

  return {
    idProyecto: p.idProyecto,
    nombre: p.nombre,
    cliente: p.cliente,
    totalProyectoUsd: totalProyecto,
    pagosRecibidosUsd: pagosRecibidos,
    saldoPorCobrarUsd: saldo,
    ultimoPagoFecha,
    estatus: p.estatus
  }
}

export function esProyectoActivo(p: Proyecto): boolean {
  return p.estatus === 'En Proceso' || p.estatus === 'Pendiente de Pago'
}

export function listarCuentasPorCobrar(): CuentaPorCobrarFila[] {
  const store = useInventarioStore()
  return store
    .listaProyectos()
    .filter(esProyectoActivo)
    .map(filaFinanzasDesdeProyecto)
}
