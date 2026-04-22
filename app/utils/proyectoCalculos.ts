import type { ArticuloProyecto } from '~/types'

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

/** Valor devengado por línea: precio × cantidad en Monterrey. */
export function valorDevengadoLineaUsd(articulo: ArticuloProyecto): number {
  return articulo.precioUnitario * cantidadEnMonterrey(articulo)
}

/** Σ valor devengado (base para comisión Sergio). */
export function subtotalDevengadoUsd(articulos: ArticuloProyecto[]): number {
  return articulos.reduce((sum, a) => sum + valorDevengadoLineaUsd(a), 0)
}

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

/** Subtotal valuado de todas las líneas: Σ (precio × cantidad total). */
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

/** Columna "Ya importado": total línea solo si estatus Monterrey; si no, 0. */
export function yaImportadoLineaUsd(articulo: ArticuloProyecto): number {
  if (articulo.estatus !== 'Monterrey') {
    return 0
  }
  return articulo.precioUnitario * articulo.cantidadTotal
}

export function montoImportacionTarifaUsd(subtotalMonterrey: number, tarifaImportacionPct: number): number {
  return subtotalMonterrey * (tarifaImportacionPct / 100)
}

/**
 * Cargos acumulados (modelo Zambrano / PDF): solo mercancía en Monterrey,
 * más comisión del proyecto (%) sobre ese subtotal, más despacho y flete fijos.
 */
export function subtotalCargosZambranoUsd(
  articulos: ArticuloProyecto[],
  tarifaComisionPct: number,
  despachoAduanalUsd: number,
  fleteLogisticaUsd: number
): number {
  const subMonterrey = subtotalLineasMonterreyCompletasUsd(articulos)
  const comision = montoImportacionTarifaUsd(subMonterrey, tarifaComisionPct)
  return subMonterrey + comision + despachoAduanalUsd + fleteLogisticaUsd
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
  totalPagosUsd: number
): number {
  return subtotalCargosZambranoUsd(articulos, tarifaComisionPct, despachoAduanalUsd, fleteLogisticaUsd)
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
  totalPagosUsd: number
): number {
  return valorDevengadoNetoZambranoUsd(
    articulos,
    tarifaComisionPct,
    despachoAduanalUsd,
    fleteLogisticaUsd,
    anticipoUsd,
    totalPagosUsd
  )
}
