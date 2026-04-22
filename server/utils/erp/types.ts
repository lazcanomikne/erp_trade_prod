import type {
  ArticuloLimbo,
  ArticuloProyecto,
  Proyecto,
  ProyectoDetalleInicial
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
