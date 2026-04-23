import type {
  ArticuloLimbo,
  ArticuloProyecto,
  Proyecto,
  ProyectoDetalleInicial,
  ProyectoEstatus
} from '~/types'

export interface ProyectoSnapshot {
  cabecera: Proyecto
  detalle: ProyectoDetalleInicial
}

export interface ErpSnapshot {
  proyectos: ProyectoSnapshot[]
  limbo: ArticuloLimbo[]
}

export interface CrearProyectoBody {
  cliente: string
  nombre: string
  folioPropuesta?: string
  tarifaImportacionPct: number
  despachoAduanalUsd: number
  fleteLogisticaUsd: number
  anticipoUsd: number
  maniobrasUsd: number
  fleteLaredoMtyUsd: number
  fleteNacionalUsd: number
  fleteExtra1Label: string | null
  fleteExtra1Usd: number
  fleteExtra2Label: string | null
  fleteExtra2Usd: number
  fleteExtra3Label: string | null
  fleteExtra3Usd: number
  igiPct: number
  wireTransferUsd: number
  comercializadoraPct: number
}

export interface ActualizarProyectoBody {
  cliente?: string
  nombre?: string
  /** null o "" quita el folio en DB */
  folioPropuesta?: string | null
  estatus?: ProyectoEstatus
  tarifaImportacionPct?: number
  despachoAduanalUsd?: number
  fleteLogisticaUsd?: number
  anticipoUsd?: number
  maniobrasUsd?: number
  fleteLaredoMtyUsd?: number
  fleteNacionalUsd?: number
  fleteExtra1Label?: string | null
  fleteExtra1Usd?: number
  fleteExtra2Label?: string | null
  fleteExtra2Usd?: number
  fleteExtra3Label?: string | null
  fleteExtra3Usd?: number
  igiPct?: number
  wireTransferUsd?: number
  comercializadoraPct?: number
}

export interface AgregarOtroCargoBody {
  descripcion: string
  montoUsd: number
}

export interface AgregarArticuloBody {
  sg: string
  referenciaLogistica?: string
  descripcion: string
  imagenUrl: string
  cantidadTotal: number
  cantidadRecibida: number
  precioUnitario: number
  estatus: ArticuloProyecto['estatus']
}
