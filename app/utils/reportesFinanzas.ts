import type { ArticuloProyecto } from '~/types'
import { listarCuentasPorCobrar } from '~/utils/cuentasPorCobrar'
import {
  cantidadEnMonterrey,
  servicioUsd,
  subtotalDevengadoUsd,
  valorTotalProyectoDesdeArticulos
} from '~/utils/proyectoCalculos'

export interface BalanceProyectoRow {
  idProyecto: string
  nombre: string
  valuadoUsd: number
  cobradoUsd: number
}

export interface SaldoVencidoRow {
  idProyecto: string
  nombre: string
  cliente: string
  saldoUsd: number
  diasDesdeUltimoPago: number | null
  ultimoPagoFecha: string | null
}

function diasEntreHoy(iso: string | null): number | null {
  if (!iso) {
    return null
  }
  const d = new Date(iso + 'T12:00:00')
  const now = new Date()
  return Math.floor((now.getTime() - d.getTime()) / 86400000)
}

function tieneMercanciaMonterrey(articulos: ArticuloProyecto[]): boolean {
  return articulos.some(a => cantidadEnMonterrey(a) > 0)
}

export function totalComisionesDevengadasUsd(): number {
  const store = useInventarioStore()
  store.seedAll()
  let sum = 0
  for (const p of store.listaProyectos()) {
    const d = store.detalle(p.idProyecto)
    sum += servicioUsd(subtotalDevengadoUsd(d.articulos), d.porcentajeServicio)
  }
  return sum
}

export function balanceValuadoVsCobrado(): BalanceProyectoRow[] {
  const store = useInventarioStore()
  store.seedAll()
  return store.listaProyectos().map((p) => {
    const d = store.detalle(p.idProyecto)
    const valuadoUsd = valorTotalProyectoDesdeArticulos(d.articulos) || p.valorTotalUsd
    const cobradoUsd = d.pagos.reduce((s, x) => s + x.montoUsd, 0)
    return {
      idProyecto: p.idProyecto,
      nombre: p.nombre,
      valuadoUsd,
      cobradoUsd
    }
  })
}

/**
 * Clientes con mercancía en Monterrey, saldo pendiente y sin pago reciente (>15 días o sin pagos).
 */
export function saldosVencidosMonterrey(): SaldoVencidoRow[] {
  const store = useInventarioStore()
  store.seedAll()
  const filas = listarCuentasPorCobrar()
  const out: SaldoVencidoRow[] = []
  for (const f of filas) {
    if (f.saldoPorCobrarUsd <= 0.01) {
      continue
    }
    const articulos = store.detalle(f.idProyecto).articulos
    if (!tieneMercanciaMonterrey(articulos)) {
      continue
    }
    const dias = diasEntreHoy(f.ultimoPagoFecha)
    const vencido = f.ultimoPagoFecha == null || (dias != null && dias > 15)
    if (!vencido) {
      continue
    }
    out.push({
      idProyecto: f.idProyecto,
      nombre: f.nombre,
      cliente: f.cliente,
      saldoUsd: f.saldoPorCobrarUsd,
      diasDesdeUltimoPago: dias,
      ultimoPagoFecha: f.ultimoPagoFecha
    })
  }
  return out.sort((a, b) => b.saldoUsd - a.saldoUsd)
}

export function sumaValuadoGlobal(filas: BalanceProyectoRow[]): number {
  return filas.reduce((s, r) => s + r.valuadoUsd, 0)
}

export function sumaCobradoGlobal(filas: BalanceProyectoRow[]): number {
  return filas.reduce((s, r) => s + r.cobradoUsd, 0)
}
