import type {
  CuentaClienteConsolidada,
  CuentaClienteProyecto,
  CuentaPorCobrarFila,
  Proyecto
} from '~/types'
import { totalProyectoConCargosUsd } from '~/utils/proyectoCalculos'

function ultimaFecha(fechas: string[]): string | null {
  if (!fechas.length) return null
  return [...fechas].sort((a, b) => b.localeCompare(a))[0] ?? null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

interface FinanzasProyecto {
  totalProyecto: number
  pagosRecibidos: number
  saldo: number
  ultimoPagoFecha: string | null
}

/**
 * Núcleo del cálculo financiero de un proyecto (misma lógica que el detalle de
 * proyecto y la pantalla de Cuentas por Cobrar): total con todos los cargos,
 * menos anticipo y pagos. Compartido por la vista por proyecto y por cliente.
 */
export function finanzasProyecto(p: Proyecto): FinanzasProyecto {
  const store = useInventarioStore()
  const d = store.detalle(p.idProyecto)

  const totalProyecto = totalProyectoConCargosUsd(
    d.articulos, d.tarifaImportacionPct, d.aduanaUsd, d.fleteUsd,
    {
      maniobrasUsd: d.maniobrasUsd, fleteLaredoMtyUsd: d.fleteLaredoMtyUsd,
      fleteNacionalUsd: d.fleteNacionalUsd, fletesExtra: d.fletesExtra,
      otrosExtras: d.otrosExtras, igiPct: d.igiPct,
      wireTransferUsd: d.wireTransferUsd, comercializadoraPct: d.comercializadoraPct,
      despachoAduanalDivisor: d.despachoAduanalDivisor, fleteLogisticaDivisor: d.fleteLogisticaDivisor
    },
    p.compradoPorTrade
  )

  const pagosRecibidos = d.pagos.reduce((s, x) => s + x.montoUsd, 0) + d.anticipoUsd
  const saldo = Math.max(0, totalProyecto - pagosRecibidos)

  // Fechas de pagos + fecha del anticipo (createdAt del proyecto) si hay anticipo
  const fechas: string[] = d.pagos.map(x => x.fecha)
  if (d.anticipoUsd > 0) fechas.push(p.createdAt)
  const ultimoPagoFecha = ultimaFecha(fechas)

  return { totalProyecto, pagosRecibidos, saldo, ultimoPagoFecha }
}

export function filaFinanzasDesdeProyecto(p: Proyecto): CuentaPorCobrarFila {
  const f = finanzasProyecto(p)
  return {
    idProyecto: p.idProyecto,
    nombre: p.nombre,
    cliente: p.cliente,
    totalProyectoUsd: f.totalProyecto,
    pagosRecibidosUsd: f.pagosRecibidos,
    saldoPorCobrarUsd: f.saldo,
    ultimoPagoFecha: f.ultimoPagoFecha,
    estatus: p.estatus
  }
}

export function esProyectoActivo(p: Proyecto): boolean {
  return p.estatus === 'Cotización' || p.estatus === 'En Proceso' || p.estatus === 'Pendiente de Pago'
}

export function listarCuentasPorCobrar(): CuentaPorCobrarFila[] {
  const store = useInventarioStore()
  return store
    .listaProyectos()
    .filter(esProyectoActivo)
    .map(filaFinanzasDesdeProyecto)
}

/**
 * Consolidado por cliente: cada cliente aparece una sola vez con la suma del
 * saldo pendiente de todos sus proyectos activos. Misma fórmula de saldo que la
 * pantalla de Cuentas por Cobrar. Los proyectos de cada cliente vienen ordenados
 * del más antiguo al más reciente (base del reparto FIFO).
 */
export function listarCuentasPorCobrarPorCliente(): CuentaClienteConsolidada[] {
  const store = useInventarioStore()
  const map = new Map<string, CuentaClienteProyecto[]>()

  for (const p of store.listaProyectos().filter(esProyectoActivo)) {
    const f = finanzasProyecto(p)
    if (!map.has(p.cliente)) map.set(p.cliente, [])
    map.get(p.cliente)!.push({
      idProyecto: p.idProyecto,
      nombre: p.nombre,
      totalProyectoUsd: f.totalProyecto,
      pagosRecibidosUsd: f.pagosRecibidos,
      saldoUsd: f.saldo,
      createdAt: p.createdAt,
      estatus: p.estatus
    })
  }

  const out: CuentaClienteConsolidada[] = []
  for (const [cliente, proyectos] of map) {
    proyectos.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    out.push({
      cliente,
      totalProyectoUsd: proyectos.reduce((s, x) => s + x.totalProyectoUsd, 0),
      pagosRecibidosUsd: proyectos.reduce((s, x) => s + x.pagosRecibidosUsd, 0),
      saldoTotalUsd: proyectos.reduce((s, x) => s + x.saldoUsd, 0),
      numProyectos: proyectos.length,
      numProyectosConSaldo: proyectos.filter(x => x.saldoUsd > 0.005).length,
      proyectos
    })
  }

  // Mayor saldo primero
  return out.sort((a, b) => b.saldoTotalUsd - a.saldoTotalUsd)
}

/**
 * Propuesta de reparto FIFO de un pago consolidado: salda el proyecto más
 * antiguo primero y continúa con el siguiente hasta agotar el monto.
 * `proyectos` debe venir ordenado del más antiguo al más reciente.
 * Devuelve un mapa idProyecto → monto a aplicar (redondeado a 2 decimales).
 */
export function proponerRepartoFifo(
  monto: number,
  proyectos: CuentaClienteProyecto[]
): Record<string, number> {
  const asignaciones: Record<string, number> = {}
  let restante = round2(Math.max(0, monto))
  for (const p of proyectos) {
    if (restante <= 0) {
      asignaciones[p.idProyecto] = 0
      continue
    }
    const aplicar = round2(Math.min(p.saldoUsd, restante))
    asignaciones[p.idProyecto] = aplicar
    restante = round2(restante - aplicar)
  }
  return asignaciones
}
