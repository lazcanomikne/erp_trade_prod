import type { ArticuloProyecto, FleteExtra, OtroCargoProyecto } from '~/types'

export interface CostosExtrasProyecto {
  maniobrasUsd?: number
  fleteLaredoMtyUsd?: number
  fleteNacionalUsd?: number
  fletesExtra?: FleteExtra[]
  otrosExtras?: OtroCargoProyecto[]
  igiPct?: number
  wireTransferUsd?: number
  comercializadoraPct?: number
}

/** Valor valuado del proyecto: Σ (precio × cantidad total). */
export function subtotalLineaUsd(articulo: ArticuloProyecto): number {
  return articulo.cantidadTotal * articulo.precioUnitario
}

/** Cantidad físicamente devengada en Monterrey (solo líneas en estatus Monterrey). */
export function cantidadEnMonterrey(articulo: ArticuloProyecto): number {
  if (articulo.estatus === 'Monterrey') {
    return articulo.cantidadRecibida
  }
  return 0
}

/** Valor devengado por línea para métricas: precio × cantidad recibida en Monterrey. */
export function valorDevengadoLineaUsd(articulo: ArticuloProyecto): number {
  return articulo.precioUnitario * cantidadEnMonterrey(articulo)
}

/**
 * Columna "Valor devengado": precio × cantidadTotal si el artículo está en Laredo o Monterrey; 0 si no.
 * Este valor cambia conforme el artículo avanza en la cadena logística.
 */
export function valorDevengadoColumnaUsd(articulo: ArticuloProyecto): number {
  if (articulo.estatus === 'Laredo' || articulo.estatus === 'Monterrey') {
    return articulo.precioUnitario * articulo.cantidadTotal
  }
  return 0
}

/** Σ valor devengado (Laredo + Monterrey) para todos los artículos. KPI global. */
export function valorDevengadoArticulosTotal(articulos: ArticuloProyecto[]): number {
  return articulos.reduce((sum, a) => sum + valorDevengadoColumnaUsd(a), 0)
}

/** Σ valor devengado (base para comisión Sergio). */
export function subtotalDevengadoUsd(articulos: ArticuloProyecto[]): number {
  return articulos.reduce((sum, a) => sum + valorDevengadoLineaUsd(a), 0)
}

/** Columna "Ya importado": siempre muestra precio × cantidadTotal, sin importar estatus. */
export function yaImportadoLineaUsd(articulo: ArticuloProyecto): number {
  return articulo.precioUnitario * articulo.cantidadTotal
}

/** Σ precio × cantidadTotal de todos los artículos. */
export function valorTotalProyectoDesdeArticulos(articulos: ArticuloProyecto[]): number {
  return articulos.reduce((sum, a) => sum + subtotalLineaUsd(a), 0)
}

/** Comisión / servicio: Valor devengado × % tarifa. */
export function servicioUsd(subtotalDevengado: number, porcentajeServicio: number): number {
  return subtotalDevengado * (porcentajeServicio / 100)
}

export function totalACobrarUsd(
  subtotalDevengado: number,
  porcentajeServicio: number,
  fleteUsd: number,
  aduanaUsd: number
): number {
  return subtotalDevengado + servicioUsd(subtotalDevengado, porcentajeServicio) + fleteUsd + aduanaUsd
}

/** Subtotal valuado de todos los artículos: Σ (precio × cantidad total). */
export function totalArticulosSubtotalUsd(articulos: ArticuloProyecto[]): number {
  return articulos.reduce((s, a) => s + subtotalLineaUsd(a), 0)
}

/**
 * Subtotal de líneas cuyo estatus es Monterrey (precio × cantidad total de la línea).
 * Base para la fila de importación % del resumen de cuentas.
 */
export function subtotalLineasMonterreyCompletasUsd(articulos: ArticuloProyecto[]): number {
  return articulos.reduce((s, a) => {
    if (a.estatus === 'Monterrey') {
      return s + a.precioUnitario * a.cantidadTotal
    }
    return s
  }, 0)
}

export function montoImportacionTarifaUsd(subtotalMonterrey: number, tarifaImportacionPct: number): number {
  return subtotalMonterrey * (tarifaImportacionPct / 100)
}

/**
 * Total del proyecto con todos los cargos.
 * - valorBase (Σ precio × qty) se usa SIEMPRE como base para % (importación, IGI, comercializadora).
 * - Si compradoPorTrade = false, el valor de los artículos NO se suma al total (Trade no los compra).
 * - Los cargos fijos (aduana, flete, extras) siempre se suman.
 */
export function totalProyectoConCargosUsd(
  articulos: ArticuloProyecto[],
  tarifaComisionPct: number,
  despachoAduanalUsd: number,
  fleteLogisticaUsd: number,
  extras?: CostosExtrasProyecto,
  compradoPorTrade = true
): number {
  const valorBase = valorTotalProyectoDesdeArticulos(articulos)
  const valorArticulos = compradoPorTrade ? valorBase : 0
  const comision = montoImportacionTarifaUsd(valorBase, tarifaComisionPct)
  let total = valorArticulos + comision + despachoAduanalUsd + fleteLogisticaUsd
  if (extras) {
    total += extras.maniobrasUsd ?? 0
    total += extras.fleteLaredoMtyUsd ?? 0
    total += extras.fleteNacionalUsd ?? 0
    total += (extras.fletesExtra ?? []).reduce((s, f) => s + f.monto, 0)
    total += (extras.otrosExtras ?? []).reduce((s, o) => s + o.montoUsd, 0)
    total += valorBase * ((extras.igiPct ?? 0) / 100)
    total += extras.wireTransferUsd ?? 0
    total += valorBase * ((extras.comercializadoraPct ?? 0) / 100)
  }
  return total
}

/**
 * Cargos acumulados (modelo Zambrano / PDF): solo mercancía en Monterrey,
 * más comisión del proyecto (%) sobre el total de artículos, más despacho y flete fijos,
 * más costos adicionales opcionales.
 * Si compradoPorTrade = false, el subtotal Monterrey no se suma al total.
 */
export function subtotalCargosZambranoUsd(
  articulos: ArticuloProyecto[],
  tarifaComisionPct: number,
  despachoAduanalUsd: number,
  fleteLogisticaUsd: number,
  extras?: CostosExtrasProyecto,
  compradoPorTrade = true
): number {
  const valorBase = valorTotalProyectoDesdeArticulos(articulos)
  const subMonterrey = subtotalLineasMonterreyCompletasUsd(articulos)
  const valorMonterrey = compradoPorTrade ? subMonterrey : 0
  const comision = montoImportacionTarifaUsd(valorBase, tarifaComisionPct)
  let total = valorMonterrey + comision + despachoAduanalUsd + fleteLogisticaUsd
  if (extras) {
    total += extras.maniobrasUsd ?? 0
    total += extras.fleteLaredoMtyUsd ?? 0
    total += extras.fleteNacionalUsd ?? 0
    total += (extras.fletesExtra ?? []).reduce((s, f) => s + f.monto, 0)
    total += (extras.otrosExtras ?? []).reduce((s, o) => s + o.montoUsd, 0)
    total += valorBase * ((extras.igiPct ?? 0) / 100)
    total += extras.wireTransferUsd ?? 0
    total += valorBase * ((extras.comercializadoraPct ?? 0) / 100)
  }
  return total
}

/**
 * Valor devengado neto: cargos Zambrano menos anticipo registrado y pagos aplicados al proyecto.
 */
export function valorDevengadoNetoZambranoUsd(
  articulos: ArticuloProyecto[],
  tarifaComisionPct: number,
  despachoAduanalUsd: number,
  fleteLogisticaUsd: number,
  anticipoUsd: number,
  totalPagosUsd: number,
  extras?: CostosExtrasProyecto,
  compradoPorTrade = true
): number {
  return subtotalCargosZambranoUsd(articulos, tarifaComisionPct, despachoAduanalUsd, fleteLogisticaUsd, extras, compradoPorTrade)
    - anticipoUsd
    - totalPagosUsd
}

/** Saldo por cobrar (misma base que valor devengado neto en este modelo). */
export function saldoPorCobrarZambranoUsd(
  articulos: ArticuloProyecto[],
  tarifaComisionPct: number,
  despachoAduanalUsd: number,
  fleteLogisticaUsd: number,
  anticipoUsd: number,
  totalPagosUsd: number,
  extras?: CostosExtrasProyecto,
  compradoPorTrade = true
): number {
  return valorDevengadoNetoZambranoUsd(
    articulos,
    tarifaComisionPct,
    despachoAduanalUsd,
    fleteLogisticaUsd,
    anticipoUsd,
    totalPagosUsd,
    extras,
    compradoPorTrade
  )
}
