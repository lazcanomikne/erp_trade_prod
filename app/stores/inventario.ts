import { reactive, ref } from 'vue'
import type { ArticuloLimbo, ArticuloProyecto, PagoProyecto, Proyecto } from '~/types'
import { mockProyectos } from '~/utils/mockProyectos'
import { getProyectoDetalleInicial } from '~/utils/mockProyectosDetalle'

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

export const useInventarioStore = defineStore('inventario', () => {
  const porProyecto = reactive<Record<string, DetalleProyectoMutable>>({})
  const articulosLimbo = reactive<ArticuloLimbo[]>([])
  const proyectosLocales = ref<Proyecto[]>([])
  let seeded = false

  function listaProyectos(): Proyecto[] {
    return [...mockProyectos, ...proyectosLocales.value]
  }

  function getProyectoById(idProyecto: string): Proyecto | undefined {
    return listaProyectos().find(p => p.idProyecto === idProyecto)
  }

  function ensureProject(idProyecto: string) {
    if (!porProyecto[idProyecto]) {
      const d = getProyectoDetalleInicial(idProyecto)
      porProyecto[idProyecto] = {
        articulos: d.articulos.map(a => ({ ...a })),
        pagos: d.pagos.map(p => ({ ...p })),
        fleteUsd: d.fleteUsd,
        aduanaUsd: d.aduanaUsd,
        porcentajeServicio: d.porcentajeServicio,
        tarifaImportacionPct: d.tarifaImportacionPct,
        anticipoUsd: d.anticipoUsd
      }
    }
  }

  function seedAll() {
    if (seeded) {
      return
    }
    for (const p of mockProyectos) {
      ensureProject(p.idProyecto)
    }
    seeded = true
  }

  function detalle(idProyecto: string): DetalleProyectoMutable {
    seedAll()
    ensureProject(idProyecto)
    return porProyecto[idProyecto]!
  }

  function crearProyecto(payload: CrearProyectoPayload): Proyecto {
    seedAll()
    const idProyecto = `PRY-${Date.now().toString(36).toUpperCase()}`
    const folio = payload.folioPropuesta.trim()
    const p: Proyecto = {
      idProyecto,
      cliente: payload.cliente.trim(),
      nombre: payload.nombre.trim(),
      valorTotalUsd: 0,
      estatus: 'En Proceso',
      progresoDevengadoPct: 0,
      montoMonterreyUsd: 0,
      folioPropuesta: folio || undefined
    }
    proyectosLocales.value.push(p)
    porProyecto[idProyecto] = {
      articulos: [],
      pagos: [],
      fleteUsd: Math.max(0, payload.fleteLogisticaUsd),
      aduanaUsd: Math.max(0, payload.despachoAduanalUsd),
      porcentajeServicio: payload.tarifaImportacionPct,
      tarifaImportacionPct: payload.tarifaImportacionPct,
      anticipoUsd: Math.max(0, payload.anticipoUsd)
    }
    return p
  }

  function bulkCorteLaredoAAduana(seleccion: { idProyecto: string, idArticulo: string }[]) {
    seedAll()
    for (const { idProyecto, idArticulo } of seleccion) {
      const art = porProyecto[idProyecto]?.articulos.find(a => a.id === idArticulo)
      if (art && art.estatus === 'Laredo') {
        art.estatus = 'En Aduana'
      }
    }
  }

  function registrarPago(idProyecto: string, montoUsd: number) {
    const d = detalle(idProyecto)
    d.pagos.push({
      id: `pay-${crypto.randomUUID()}`,
      montoUsd,
      fecha: new Date().toISOString().slice(0, 10)
    })
  }

  function registrarArriboDesconocido(payload: {
    sgProvisional: string
    descripcion: string
    imagenUrl: string
  }) {
    articulosLimbo.push({
      id: `limbo-${crypto.randomUUID()}`,
      sgProvisional: payload.sgProvisional.trim(),
      descripcion: payload.descripcion.trim(),
      imagenUrl: payload.imagenUrl,
      fechaRegistro: new Date().toISOString().slice(0, 10)
    })
  }

  function asignarLimboAProyecto(
    idLimbo: string,
    idProyecto: string,
    opts: {
      precioUnitario: number
      cantidadTotal?: number
      sgFinal?: string
      /** Si true, el artículo queda listo para devengar en Monterrey */
      marcarRecibidoMonterrey?: boolean
    }
  ) {
    seedAll()
    const idx = articulosLimbo.findIndex(x => x.id === idLimbo)
    if (idx === -1) {
      return false
    }
    const lim = articulosLimbo[idx]!
    const d = detalle(idProyecto)
    const cant = opts.cantidadTotal != null && opts.cantidadTotal > 0 ? Math.floor(opts.cantidadTotal) : 1
    const precio = opts.precioUnitario
    const sg = (opts.sgFinal ?? lim.sgProvisional).trim()
    const enMty = opts.marcarRecibidoMonterrey === true
    const art: ArticuloProyecto = {
      id: `art-${crypto.randomUUID()}`,
      sg,
      descripcion: lim.descripcion,
      imagenUrl: lim.imagenUrl,
      cantidadTotal: cant,
      cantidadRecibida: enMty ? cant : 0,
      precioUnitario: precio,
      estatus: enMty ? 'Monterrey' : 'Laredo',
      referenciaLogistica: ''
    }
    d.articulos.push(art)
    articulosLimbo.splice(idx, 1)
    return true
  }

  return {
    porProyecto,
    articulosLimbo,
    proyectosLocales,
    seedAll,
    ensureProject,
    detalle,
    listaProyectos,
    getProyectoById,
    crearProyecto,
    bulkCorteLaredoAAduana,
    registrarPago,
    registrarArriboDesconocido,
    asignarLimboAProyecto
  }
})
