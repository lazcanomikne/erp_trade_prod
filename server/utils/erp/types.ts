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
  marca?: string
  bultos?: number
  numeroRack?: string
  compradoPorTrade?: boolean
}

export interface AgregarInventarioLibreBody {
  sg: string
  descripcion: string
  imagenUrl: string
  marca?: string
  bultos?: number
  numeroRack?: string
  cantidadTotal: number
  precioUnitario: number
  estatus: ArticuloProyecto['estatus']
  referenciaLogistica?: string
  notas?: string
}

export interface CrearEntregaBody {
  descripcion: string
  fechaProgramada?: string | null
  chofer?: string
  origen?: string
  notas?: string
  destinos: Array<{ cliente: string, direccion?: string }>
  articulos: Array<{
    idProyecto: string | null
    idArticulo: string
    descripcion: string
    sg: string
    cliente: string
    cantidad: number
  }>
}

export interface ActualizarEntregaBody {
  descripcion?: string
  fechaProgramada?: string | null
  chofer?: string
  origen?: string
  estatus?: 'Pendiente' | 'En Ruta' | 'Entregado' | 'Parcial'
  notas?: string
}

export type MotivoDevolucion = 'Dañado' | 'Incompleto' | 'Producto incorrecto' | 'Área no lista' | 'Otros'
export type DestinoDevolucion = 'Laredo' | 'En Aduana' | 'Monterrey'

export interface DevolucionArticuloInput {
  idProyecto: string
  idArticulo: string
  sg: string
  descripcion: string
  cantidad: number
  motivo: MotivoDevolucion
  motivoDetalle?: string
}

export interface CrearDevolucionBody {
  destino: DestinoDevolucion
  notas?: string
  articulos: DevolucionArticuloInput[]
}

export interface DevolucionArticulo {
  id: string
  idDevolucion: string
  idProyecto: string
  idArticulo: string
  sg: string
  descripcion: string
  cantidad: number
  motivo: MotivoDevolucion
  motivoDetalle?: string
  /** Campos de detalle (disponibles en fetchDevolucionDetalle) */
  nombreProyecto?: string
  precioUnitario?: number
  marca?: string
  estatusActual?: string
}

export interface Devolucion {
  id: string
  numero: number
  fecha: string
  destino: DestinoDevolucion
  notas?: string
  articulos: DevolucionArticulo[]
  createdAt: string
  cancelado: boolean
  canceladoAt?: string
}

export interface ArticuloDisponibleDevolucion {
  idArticulo: string
  idProyecto: string
  nombreProyecto: string
  sg: string
  descripcion: string
  cantidadTotal: number
  cantidadRecibida: number
}
