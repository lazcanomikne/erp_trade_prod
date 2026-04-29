import { reactive, ref } from 'vue'
import type {
  ArticuloLimbo,
  ArticuloProyecto,
  Cliente,
  FleteExtra,
  OtroCargoProyecto,
  PagoProyecto,
  Proyecto,
  ProyectoDetalleInicial,
  ProyectoEstatus
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
  maniobrasUsd: number
  fleteLaredoMtyUsd: number
  fleteNacionalUsd: number
  fletesExtra: FleteExtra[]
  otrosExtras: OtroCargoProyecto[]
  igiPct: number
  wireTransferUsd: number
  comercializadoraPct: number
}

export interface CrearProyectoPayload {
  cliente: string
  nombre: string
  folioPropuesta: string
  intermediario?: boolean
  clienteFinal?: string
  tarifaImportacionPct: number
  /** Tasa por bloque de $60k: actual = rate × blocks */
  despachoAduanalUsd: number
  /** Tasa por bloque de $60k: actual = rate × blocks */
  fleteLogisticaUsd: number
  anticipoUsd: number
  maniobrasUsd: number
  fleteLaredoMtyUsd: number
  fleteNacionalUsd: number
  fletesExtra: FleteExtra[]
  igiPct: number
  wireTransferUsd: number
  comercializadoraPct: number
}

function detalleToMutable(d: ProyectoDetalleInicial): DetalleProyectoMutable {
  return {
    articulos: d.articulos.map(a => ({ ...a })),
    pagos: d.pagos.map(p => ({ ...p })),
    fleteUsd: d.fleteUsd,
    aduanaUsd: d.aduanaUsd,
    porcentajeServicio: d.porcentajeServicio,
    tarifaImportacionPct: d.tarifaImportacionPct,
    anticipoUsd: d.anticipoUsd,
    maniobrasUsd: d.maniobrasUsd,
    fleteLaredoMtyUsd: d.fleteLaredoMtyUsd,
    fleteNacionalUsd: d.fleteNacionalUsd,
    fletesExtra: d.fletesExtra.map(f => ({ ...f })),
    otrosExtras: d.otrosExtras.map(o => ({ ...o })),
    igiPct: d.igiPct,
    wireTransferUsd: d.wireTransferUsd,
    comercializadoraPct: d.comercializadoraPct
  }
}

export const useInventarioStore = defineStore('inventario', () => {
  const proyectos = ref<Proyecto[]>([])
  const porProyecto = ref<Record<string, DetalleProyectoMutable>>({})
  const articulosLimbo = reactive<ArticuloLimbo[]>([])
  const clientes = ref<Cliente[]>([])
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

  async function fetchClientesFromApi(): Promise<void> {
    const data = await $fetch<Cliente[]>('/api/erp/clientes')
    clientes.value = data
  }

  async function crearClienteEnApi(nombre: string): Promise<Cliente> {
    const c = await $fetch<Cliente>('/api/erp/clientes', {
      method: 'POST',
      body: { nombre }
    })
    if (!clientes.value.find(x => x.id === c.id)) {
      clientes.value.push(c)
      clientes.value.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    }
    return c
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
      /** No relanzar: SSR (p. ej. /proyectos/[id]) no debe responder 500 si falla MySQL/API. */
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
          anticipoUsd: 0,
          maniobrasUsd: 0,
          fleteLaredoMtyUsd: 0,
          fleteNacionalUsd: 0,
          fletesExtra: [],
          otrosExtras: [],
          igiPct: 0,
          wireTransferUsd: 0,
          comercializadoraPct: 0
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
          intermediario: payload.intermediario ?? false,
          clienteFinal: payload.clienteFinal?.trim() || undefined,
          tarifaImportacionPct: payload.tarifaImportacionPct,
          despachoAduanalUsd: Math.max(0, payload.despachoAduanalUsd),
          fleteLogisticaUsd: Math.max(0, payload.fleteLogisticaUsd),
          anticipoUsd: Math.max(0, payload.anticipoUsd),
          maniobrasUsd: Math.max(0, payload.maniobrasUsd),
          fleteLaredoMtyUsd: Math.max(0, payload.fleteLaredoMtyUsd),
          fleteNacionalUsd: Math.max(0, payload.fleteNacionalUsd),
          fleteExtra1Label: payload.fletesExtra[0]?.label || null,
          fleteExtra1Usd: payload.fletesExtra[0]?.monto ?? 0,
          fleteExtra2Label: payload.fletesExtra[1]?.label || null,
          fleteExtra2Usd: payload.fletesExtra[1]?.monto ?? 0,
          fleteExtra3Label: payload.fletesExtra[2]?.label || null,
          fleteExtra3Usd: payload.fletesExtra[2]?.monto ?? 0,
          igiPct: payload.igiPct,
          wireTransferUsd: Math.max(0, payload.wireTransferUsd),
          comercializadoraPct: payload.comercializadoraPct
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

  async function registrarPago(idProyecto: string, payload: {
    montoUsd: number
    fecha: string
    referencia?: string
    formaPago?: string
  }) {
    await $fetch<ErpSnapshotPayload>(`/api/erp/proyectos/${encodeURIComponent(idProyecto)}/pagos`, {
      method: 'POST',
      body: payload
    })
    await refreshFromApi()
  }

  async function editarPago(idProyecto: string, pagoId: string, payload: {
    montoUsd: number
    fecha: string
    referencia?: string | null
    formaPago?: string | null
    motivo: string
  }) {
    await $fetch<ErpSnapshotPayload>(`/api/erp/proyectos/${encodeURIComponent(idProyecto)}/pagos/${pagoId}`, {
      method: 'PATCH',
      body: payload
    })
    await refreshFromApi()
  }

  async function eliminarPago(idProyecto: string, pagoId: string, motivo: string) {
    await $fetch<ErpSnapshotPayload>(`/api/erp/proyectos/${encodeURIComponent(idProyecto)}/pagos/${pagoId}`, {
      method: 'DELETE',
      body: { motivo }
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
      marca?: string
      bultos?: number
      numeroRack?: string
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
          referenciaLogistica: '',
          marca: art.marca,
          bultos: art.bultos,
          numeroRack: art.numeroRack
        }
      }
    )
    await refreshFromApi()
  }

  async function editarArticulo(
    idProyecto: string,
    idArticulo: string,
    campos: Partial<{
      sg: string
      descripcion: string
      marca: string | null
      bultos: number | null
      numeroRack: string | null
      cantidadTotal: number
      precioUnitario: number
      estatus: ArticuloProyecto['estatus']
      referenciaLogistica: string | null
    }>
  ) {
    await $fetch(
      `/api/erp/proyectos/${encodeURIComponent(idProyecto)}/articulos/${encodeURIComponent(idArticulo)}`,
      { method: 'PATCH', body: campos }
    )
    await refreshFromApi()
  }

  async function eliminarArticulo(idProyecto: string, idArticulo: string, comentario: string) {
    await $fetch(
      `/api/erp/proyectos/${encodeURIComponent(idProyecto)}/articulos/${encodeURIComponent(idArticulo)}`,
      { method: 'DELETE', body: { comentario } }
    )
    await refreshFromApi()
  }

  async function restaurarArticulo(idArticulo: string) {
    await $fetch(`/api/erp/articulos/${encodeURIComponent(idArticulo)}/restaurar`, { method: 'POST' })
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

  async function patchArticuloReferencia(
    idProyecto: string,
    idArticulo: string,
    referenciaLogistica: string | null
  ) {
    const det = porProyecto.value[idProyecto]
    const art = det?.articulos.find(a => a.id === idArticulo)
    if (art) art.referenciaLogistica = referenciaLogistica ?? undefined
    await $fetch<ErpSnapshotPayload>(
      `/api/erp/proyectos/${encodeURIComponent(idProyecto)}/articulos/${encodeURIComponent(idArticulo)}`,
      {
        method: 'PATCH',
        body: { referenciaLogistica }
      }
    )
    await refreshFromApi()
  }

  async function agregarOtroCargo(
    idProyecto: string,
    descripcion: string,
    montoUsd: number
  ) {
    await $fetch<{ cabecera: Proyecto, detalle: ProyectoDetalleInicial }>(
      `/api/erp/proyectos/${encodeURIComponent(idProyecto)}/otros`,
      { method: 'POST', body: { descripcion, montoUsd } }
    )
    await refreshFromApi()
  }

  async function eliminarOtroCargo(idProyecto: string, idOtro: string) {
    await $fetch<{ cabecera: Proyecto, detalle: ProyectoDetalleInicial }>(
      `/api/erp/proyectos/${encodeURIComponent(idProyecto)}/otros/${encodeURIComponent(idOtro)}`,
      { method: 'DELETE' }
    )
    await refreshFromApi()
  }

  async function editarOtroCargo(
    idProyecto: string,
    idOtro: string,
    descripcion: string,
    montoUsd: number
  ) {
    await $fetch<{ cabecera: Proyecto, detalle: ProyectoDetalleInicial }>(
      `/api/erp/proyectos/${encodeURIComponent(idProyecto)}/otros/${encodeURIComponent(idOtro)}`,
      { method: 'PATCH', body: { descripcion, montoUsd } }
    )
    await refreshFromApi()
  }

  async function actualizarProyecto(
    idProyecto: string,
    payload: {
      cliente?: string
      nombre?: string
      folioPropuesta?: string | null
      estatus?: ProyectoEstatus
      compradoPorTrade?: boolean
      tarifaImportacionPct?: number
      despachoAduanalUsd?: number
      fleteLogisticaUsd?: number
      anticipoUsd?: number
      maniobrasUsd?: number
      fleteLaredoMtyUsd?: number
      fleteNacionalUsd?: number
      fletesExtra?: FleteExtra[]
      igiPct?: number
      wireTransferUsd?: number
      comercializadoraPct?: number
    }
  ) {
    const { fletesExtra, ...rest } = payload
    const body: Record<string, unknown> = { ...rest }
    if (fletesExtra !== undefined) {
      body.fleteExtra1Label = fletesExtra[0]?.label || null
      body.fleteExtra1Usd = fletesExtra[0]?.monto ?? 0
      body.fleteExtra2Label = fletesExtra[1]?.label || null
      body.fleteExtra2Usd = fletesExtra[1]?.monto ?? 0
      body.fleteExtra3Label = fletesExtra[2]?.label || null
      body.fleteExtra3Usd = fletesExtra[2]?.monto ?? 0
    }
    await $fetch<{ cabecera: Proyecto, detalle: ProyectoDetalleInicial }>(
      `/api/erp/proyectos/${encodeURIComponent(idProyecto)}`,
      { method: 'PATCH', body }
    )
    await refreshFromApi()
  }

  return {
    proyectos,
    porProyecto,
    articulosLimbo,
    clientes,
    loaded,
    loadError,
    seedAll,
    ensureLoaded,
    refreshFromApi,
    fetchClientesFromApi,
    crearClienteEnApi,
    ensureProject,
    detalle,
    listaProyectos,
    getProyectoById,
    crearProyecto,
    bulkCorteLaredoAAduana,
    registrarPago,
    editarPago,
    eliminarPago,
    registrarArriboDesconocido,
    asignarLimboAProyecto,
    agregarArticulo,
    patchArticuloEstatus,
    patchArticuloReferencia,
    actualizarProyecto,
    agregarOtroCargo,
    eliminarOtroCargo,
    editarOtroCargo,
    editarArticulo,
    eliminarArticulo,
    restaurarArticulo
  }
})
