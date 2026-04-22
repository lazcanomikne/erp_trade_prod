import type { CuentaPorCobrarFila, Proyecto } from '~/types'
import { subtotalDevengadoUsd, totalACobrarUsd } from '~/utils/proyectoCalculos'

function ultimaFechaPago(fechas: string[]): string | null {
  if (!fechas.length) {
    return null
  }
  return [...fechas].sort((a, b) => b.localeCompare(a))[0] ?? null
}

export function filaFinanzasDesdeProyecto(p: Proyecto): CuentaPorCobrarFila {
  const store = useInventarioStore()
  store.seedAll()
  const d = store.detalle(p.idProyecto)
  const montoDevengado = subtotalDevengadoUsd(d.articulos)
  const totalACobrar = totalACobrarUsd(
    montoDevengado,
    d.porcentajeServicio,
    d.fleteUsd,
    d.aduanaUsd
  )
  const pagosRecibidos = d.pagos.reduce((s, x) => s + x.montoUsd, 0)
  const saldo = Math.max(0, totalACobrar - pagosRecibidos)
  const ultimoPagoFecha = ultimaFechaPago(d.pagos.map(x => x.fecha))

  return {
    idProyecto: p.idProyecto,
    nombre: p.nombre,
    cliente: p.cliente,
    montoDevengadoUsd: montoDevengado,
    pagosRecibidosUsd: pagosRecibidos,
    saldoPorCobrarUsd: saldo,
    ultimoPagoFecha,
    estatus: p.estatus
  }
}

/** Proyectos operativos (no cerrados contablemente en este demo). */
export function esProyectoActivo(p: Proyecto): boolean {
  return p.estatus === 'En Proceso' || p.estatus === 'Pendiente de Pago'
}

export function listarCuentasPorCobrar(): CuentaPorCobrarFila[] {
  const store = useInventarioStore()
  store.seedAll()
  return store
    .listaProyectos()
    .filter(esProyectoActivo)
    .map(filaFinanzasDesdeProyecto)
}
