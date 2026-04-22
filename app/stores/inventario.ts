import { reactive, ref } from 'vue'
import type {
  ArticuloLimbo,
  ArticuloProyecto,
  PagoProyecto,
  Proyecto,
  ProyectoDetalleInicial
} from '~/types'

/** Respuesta de GET /api/erp/snapshot y mutaciones ERP. */
export interface ErpSnapshotPayload {
  proyectos: Array<{ cabecera: Proyecto, detalle: ProyectoDetalleInicial }>
  limbo: ArticuloLimbo[]
}

export interface DetalleProyectoMutable {
  articulos: ArticuloProyecto[]
  pagos: PagoProyecto[]
  fleteUsd: number
  aduanaUsd: number
  porcentajeServicio: number
  tarifaImportacionPct: number
  anticipoUsd: number
}

export interface CrearProyectoPayload {
  cliente: string
  nombre: string
  folioPropuesta: string
  tarifaImportacionPct: number
  despachoAduanalUsd: number
  fleteLogisticaUsd: number
  anticipoUsd: number
}

function detalleToMutable(d: ProyectoDetalleInicial): DetalleProyectoMutable {
  return {
    articulos: d.articulos.map(a => ({ ...a })),
    pagos: d.pagos.map(p => ({ ...p })),
    fleteUsd: d.fleteUsd,
    aduanaUsd: d.aduanaUsd,
    porcentajeServicio: d.porcentajeServicio,
    tarifaImportacionPct: d.tarifaImportacionPct,
    anticipoUsd: d.anticipoUsd
  }
}

export const useInventarioStore = defineStore('inventario', () => {
  const proyectos = ref<Proyecto[]>([])
  const porProyecto = ref<Record<string, DetalleProyectoMutable>>({})
  const articulosLimbo = reactive<ArticuloLimbo[]>([])
  const loaded = ref(false)
  const loadError = ref<string | null>(null)

  function hydrate(raw: ErpSnapshotPayload) {
    proyectos.value = raw.proyectos.map(p => ({ ...p.cabecera }))
    const m: Record<string, DetalleProyectoMutable> = {}
    for (const p of raw.proyectos) {
      m[p.cabecera.idProyecto] = detalleToMutable(p.detalle)
    }
    porProyecto.value = m
    articulosLimbo.splice(0, articulosLimbo.length, ...raw.limbo)
    loaded.value = true
    loadError.value = null
  }

  async function refreshFromApi(): Promise<void> {
    const raw = await $fetch<ErpSnapshotPayload>('/api/erp/snapshot')
    hydrate(raw)
  }

  /** Carga inicial desde MySQL (API). */
  async function ensureLoaded(): Promise<void> {
    if (loaded.value) {
      return
    }
    try {
      await refreshFromApi()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      loadError.value = msg
      console.error('[inventario] ensureLoaded:', e)
      throw e
    }
  }

  /** Compatibilidad con páginas que aún llaman seedAll() */
  function seedAll() {
    void ensureLoaded()
  }

  function listaProyectos(): Proyecto[] {
    return proyectos.value
  }

  function getProyectoById(idProyecto: string): Proyecto | undefined {
    return proyectos.value.find(p => p.idProyecto === idProyecto)
  }

  function ensureProject(idProyecto: string) {
    if (!porProyecto.value[idProyecto]) {
      porProyecto.value = {
        ...porProyecto.value,
        [idProyecto]: {
          articulos: [],
          pagos: [],
          fleteUsd: 0,
          aduanaUsd: 0,
          porcentajeServicio: 21,
          tarifaImportacionPct: 20,
          anticipoUsd: 0
        }
      }
    }
  }

  function detalle(idProyecto: string): DetalleProyectoMutable {
    ensureProject(idProyecto)
    return porProyecto.value[idProyecto]!
  }

  async function crearProyecto(payload: CrearProyectoPayload): Promise<Proyecto> {
    const snap = await $fetch<{ cabecera: Proyecto, detalle: ProyectoDetalleInicial }>(
      '/api/erp/proyectos',
      {
        method: 'POST',
        body: {
          cliente: payload.cliente.trim(),
          nombre: payload.nombre.trim(),
          folioPropuesta: payload.folioPropuesta.trim() || undefined,
          tarifaImportacionPct: payload.tarifaImportacionPct,
          despachoAduanalUsd: Math.max(0, payload.despachoAduanalUsd),
          fleteLogisticaUsd: Math.max(0, payload.fleteLogisticaUsd),
          anticipoUsd: Math.max(0, payload.anticipoUsd)
        }
      }
    )
    await refreshFromApi()
    return snap.cabecera
  }

  async function bulkCorteLaredoAAduana(seleccion: { idProyecto: string, idArticulo: string }[]) {
    await $fetch<ErpSnapshotPayload>('/api/erp/logistica/corte', {
      method: 'POST',
      body: { seleccion }
    })
    await refreshFromApi()
  }

  async function registrarPago(idProyecto: string, montoUsd: number) {
    await $fetch<ErpSnapshotPayload>(`/api/erp/proyectos/${encodeURIComponent(idProyecto)}/pagos`, {
      method: 'POST',
      body: { montoUsd }
    })
    await refreshFromApi()
  }

  async function registrarArriboDesconocido(payload: {
    sgProvisional: string
    descripcion: string
    imagenUrl: string
  }) {
    await $fetch<ErpSnapshotPayload>('/api/erp/limbo', {
      method: 'POST',
      body: {
        sgProvisional: payload.sgProvisional.trim(),
        descripcion: payload.descripcion.trim(),
        imagenUrl: payload.imagenUrl
      }
    })
    await refreshFromApi()
  }

  async function asignarLimboAProyecto(
    idLimbo: string,
    idProyecto: string,
    opts: {
      precioUnitario: number
      cantidadTotal?: number
      sgFinal?: string
      marcarRecibidoMonterrey?: boolean
    }
  ): Promise<boolean> {
    try {
      await $fetch<ErpSnapshotPayload>(`/api/erp/limbo/${encodeURIComponent(idLimbo)}/asignar`, {
        method: 'POST',
        body: {
          idProyecto,
          precioUnitario: opts.precioUnitario,
          cantidadTotal: opts.cantidadTotal,
          sgFinal: opts.sgFinal,
          marcarRecibidoMonterrey: opts.marcarRecibidoMonterrey
        }
      })
      await refreshFromApi()
      return true
    } catch {
      return false
    }
  }

  async function agregarArticulo(
    idProyecto: string,
    art: {
      sg: string
      descripcion: string
      imagenUrl: string
      cantidadTotal: number
      precioUnitario: number
      estatus: ArticuloProyecto['estatus']
    }
  ) {
    const cant = Math.max(1, Math.floor(art.cantidadTotal))
    const recibida = art.estatus === 'Monterrey' ? cant : 0
    await $fetch<ErpSnapshotPayload>(
      `/api/erp/proyectos/${encodeURIComponent(idProyecto)}/articulos`,
      {
        method: 'POST',
        body: {
          sg: art.sg,
          descripcion: art.descripcion,
          imagenUrl: art.imagenUrl,
          cantidadTotal: cant,
          cantidadRecibida: recibida,
          precioUnitario: art.precioUnitario,
          estatus: art.estatus,
          referenciaLogistica: ''
        }
      }
    )
    await refreshFromApi()
  }

  async function patchArticuloEstatus(
    idProyecto: string,
    idArticulo: string,
    estatus: ArticuloProyecto['estatus']
  ) {
    await $fetch<ErpSnapshotPayload>(
      `/api/erp/proyectos/${encodeURIComponent(idProyecto)}/articulos/${encodeURIComponent(idArticulo)}`,
      {
        method: 'PATCH',
        body: { estatus }
      }
    )
    await refreshFromApi()
  }

  return {
    proyectos,
    porProyecto,
    articulosLimbo,
    loaded,
    loadError,
    seedAll,
    ensureLoaded,
    refreshFromApi,
    ensureProject,
    detalle,
    listaProyectos,
    getProyectoById,
    crearProyecto,
    bulkCorteLaredoAAduana,
    registrarPago,
    registrarArriboDesconocido,
    asignarLimboAProyecto,
    agregarArticulo,
    patchArticuloEstatus
  }
})
