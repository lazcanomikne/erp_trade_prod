import type { AvatarProps } from '@nuxt/ui'

export type UserStatus = 'subscribed' | 'unsubscribed' | 'bounced'
export type SaleStatus = 'paid' | 'failed' | 'refunded'

export interface User {
  id: number
  name: string
  email: string
  avatar?: AvatarProps
  status: UserStatus
  location: string
}

export interface Mail {
  id: number
  unread?: boolean
  from: User
  subject: string
  body: string
  date: string
}

export interface Member {
  name: string
  username: string
  role: 'member' | 'owner'
  avatar: AvatarProps
}

export interface Stat {
  title: string
  icon: string
  value: number | string
  variation: number
  formatter?: (value: number) => string
}

export interface Sale {
  id: string
  date: string
  status: SaleStatus
  email: string
  amount: number
}

export interface Notification {
  id: number
  unread?: boolean
  sender: User
  body: string
  date: string
}

export type Period = 'daily' | 'weekly' | 'monthly'

export interface Range {
  start: Date
  end: Date
}

export type ProyectoEstatus = 'En Proceso' | 'Completado' | 'Pendiente de Pago'

export interface Proyecto {
  idProyecto: string
  cliente: string
  nombre: string
  valorTotalUsd: number
  estatus: ProyectoEstatus
  /** Porcentaje de valor devengado recibido en Monterrey respecto al total del proyecto */
  progresoDevengadoPct: number
  montoMonterreyUsd: number
  /** Folio de propuesta comercial (ej. 102901) */
  folioPropuesta?: string
  /** Fecha de creación del proyecto yyyy-mm-dd (usada como fecha del anticipo) */
  createdAt: string
}

export type ArticuloEstatusLogistica = 'Laredo' | 'En Aduana' | 'Monterrey'

export interface ArticuloProyecto {
  id: string
  sg: string
  descripcion: string
  /** URL de imagen (blob o remota) */
  imagenUrl: string
  cantidadTotal: number
  cantidadRecibida: number
  precioUnitario: number
  estatus: ArticuloEstatusLogistica
  /** Código de referencia logística (ej. SG/17958Y64) */
  referenciaLogistica?: string
  marca?: string
  bultos?: number
  numeroRack?: string
}

export interface ArticuloInventarioLibre {
  id: string
  sg: string
  descripcion: string
  imagenUrl: string
  marca?: string
  bultos?: number
  numeroRack?: string
  cantidadTotal: number
  precioUnitario: number
  estatus: ArticuloEstatusLogistica
  referenciaLogistica?: string
  notas?: string
}

export type EntregaEstatus = 'Pendiente' | 'En Ruta' | 'Entregado' | 'Parcial'

export interface EntregaArticulo {
  id: string
  idEntrega: string
  idProyecto: string | null
  idArticulo: string
  descripcion: string
  sg: string
  cliente: string
  cantidad: number
  entregado: boolean
}

export interface EntregaDestino {
  id: string
  idEntrega: string
  cliente: string
  direccion: string
  orden: number
  confirmado: boolean
  firmaUrl: string | null
  fotoUrl: string | null
}

export interface Entrega {
  id: string
  descripcion: string
  fechaProgramada: string | null
  chofer: string
  origen: string
  estatus: EntregaEstatus
  notas: string
  articulos: EntregaArticulo[]
  destinos: EntregaDestino[]
  createdAt: string
}

export interface PagoProyecto {
  id: string
  montoUsd: number
  nota?: string
  fecha: string
  referencia?: string
  formaPago?: string
}

export interface PagoHistoriaEntry {
  id: string
  idPago: string
  accion: 'edicion' | 'eliminacion'
  motivo: string
  snapshotAntes: {
    montoUsd: number
    fecha: string
    referencia: string | null
    formaPago: string | null
  }
  createdAt: string
}

export interface FleteExtra {
  label: string
  monto: number
}

export interface OtroCargoProyecto {
  id: string
  descripcion: string
  montoUsd: number
}

export interface ProyectoDetalleInicial {
  articulos: ArticuloProyecto[]
  pagos: PagoProyecto[]
  fleteUsd: number
  aduanaUsd: number
  /** Porcentaje entero, ej. 21 → 21% (legacy) */
  porcentajeServicio: number
  /** Tarifa % sobre subtotal Monterrey (importación / comisión) */
  tarifaImportacionPct: number
  anticipoUsd: number
  maniobrasUsd: number
  fleteLaredoMtyUsd: number
  fleteNacionalUsd: number
  /** Hasta 3 fletes adicionales con etiqueta libre */
  fletesExtra: FleteExtra[]
  /** Cargos adicionales libres (descripción + monto, sin límite) */
  otrosExtras: OtroCargoProyecto[]
  /** IGI % — impuesto general de importación, base: subtotal Monterrey */
  igiPct: number
  wireTransferUsd: number
  /** Comisión comercializadora % sobre subtotal Monterrey */
  comercializadoraPct: number
}

export interface ArticuloEliminado {
  id: string
  idProyecto: string
  proyectoNombre?: string
  proyectoCliente?: string
  sg: string
  descripcion: string
  imagenUrl: string
  marca?: string
  bultos?: number
  numeroRack?: string
  cantidadTotal: number
  precioUnitario: number
  estatus: ArticuloEstatusLogistica
  referenciaLogistica?: string
  deletedAt: string
  eliminacionComentario: string | null
}

/** Artículo recibido en Laredo sin match en proyectos (hasta asignación). */
export interface ArticuloLimbo {
  id: string
  sgProvisional: string
  descripcion: string
  imagenUrl: string
  /** ISO yyyy-mm-dd */
  fechaRegistro: string
}

export interface ManifiestoLinea {
  id: string
  idManifiesto: string
  idArticulo: string
  idProyecto: string
  nombreProyecto: string
  cliente: string
  sg: string
  descripcionOriginal: string
  descripcionGenerica: string
  cantidadCorte: number
  precioOriginal: number
  precioCorte: number
}

export interface ManifiestoResumen {
  id: string
  folio: number
  fecha: string
  observaciones: string | null
  totalLineas: number
  totalValorCorte: number
  proyectos: string[]
  createdAt: string
}

export interface ManifiestoDetalle {
  id: string
  folio: number
  fecha: string
  observaciones: string | null
  createdAt: string
  lineas: ManifiestoLinea[]
}

export interface CuentaPorCobrarFila {
  idProyecto: string
  nombre: string
  cliente: string
  /** Total proyecto con todos los cargos — misma lógica que detalle de proyecto */
  totalProyectoUsd: number
  pagosRecibidosUsd: number
  saldoPorCobrarUsd: number
  /** ISO date yyyy-mm-dd o null. Incluye fecha del anticipo si aplica. */
  ultimoPagoFecha: string | null
  estatus: ProyectoEstatus
}
