import type { ArticuloProyecto } from '~/types'
import { subtotalDevengadoUsd, valorTotalProyectoDesdeArticulos } from '~/utils/proyectoCalculos'

/** Cabecera de proyecto derivada solo de líneas (persistimos métricas en lectura/API). */
export function proyectoMetricsFromArticulos(articulos: ArticuloProyecto[]): {
  valorTotalUsd: number
  montoMonterreyUsd: number
  progresoDevengadoPct: number
} {
  const valorTotalUsd = valorTotalProyectoDesdeArticulos(articulos)
  const montoMonterreyUsd = subtotalDevengadoUsd(articulos)
  const progresoDevengadoPct
    = valorTotalUsd > 0 ? Math.round((10000 * montoMonterreyUsd) / valorTotalUsd) / 100 : 0
  return { valorTotalUsd, montoMonterreyUsd, progresoDevengadoPct }
}
