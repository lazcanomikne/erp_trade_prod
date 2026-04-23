import type { Entrega, EntregaEstatus } from '~/types'

export const useEntregasStore = defineStore('entregas', () => {
  const entregas = ref<Entrega[]>([])
  const loaded = ref(false)

  async function refreshFromApi() {
    entregas.value = await $fetch<Entrega[]>('/api/erp/entregas')
    loaded.value = true
  }

  async function crearEntrega(payload: {
    descripcion: string
    fechaProgramada?: string | null
    chofer?: string
    origen?: string
    notas?: string
    destinos: Array<{ cliente: string; direccion?: string }>
    articulos: Array<{
      idProyecto: string | null
      idArticulo: string
      descripcion: string
      sg: string
      cliente: string
      cantidad: number
    }>
  }): Promise<Entrega> {
    const result = await $fetch<Entrega>('/api/erp/entregas', { method: 'POST', body: payload })
    await refreshFromApi()
    return result
  }

  async function actualizarEntrega(id: string, patch: {
    descripcion?: string
    fechaProgramada?: string | null
    chofer?: string
    origen?: string
    estatus?: EntregaEstatus
    notas?: string
  }): Promise<Entrega> {
    const result = await $fetch<Entrega>(`/api/erp/entregas/${encodeURIComponent(id)}`, {
      method: 'PATCH', body: patch
    })
    const idx = entregas.value.findIndex(e => e.id === id)
    if (idx !== -1) entregas.value[idx] = result
    return result
  }

  async function marcarArticuloEntregado(idEntrega: string, idArticulo: string, entregado: boolean) {
    await $fetch(`/api/erp/entregas/${encodeURIComponent(idEntrega)}/articulos/${encodeURIComponent(idArticulo)}`, {
      method: 'PATCH', body: { entregado }
    })
    const entrega = entregas.value.find(e => e.id === idEntrega)
    if (entrega) {
      const art = entrega.articulos.find(a => a.id === idArticulo)
      if (art) art.entregado = entregado
    }
  }

  async function confirmarDestino(
    idEntrega: string,
    idDestino: string,
    data: { confirmado: boolean; firmaUrl?: string | null; fotoUrl?: string | null }
  ) {
    await $fetch(`/api/erp/entregas/${encodeURIComponent(idEntrega)}/destinos/${encodeURIComponent(idDestino)}`, {
      method: 'PATCH', body: data
    })
    const entrega = entregas.value.find(e => e.id === idEntrega)
    if (entrega) {
      const dest = entrega.destinos.find(d => d.id === idDestino)
      if (dest) {
        dest.confirmado = data.confirmado
        if (data.firmaUrl !== undefined) dest.firmaUrl = data.firmaUrl ?? null
        if (data.fotoUrl !== undefined) dest.fotoUrl = data.fotoUrl ?? null
      }
    }
  }

  function getEntregaById(id: string): Entrega | undefined {
    return entregas.value.find(e => e.id === id)
  }

  return {
    entregas,
    loaded,
    refreshFromApi,
    crearEntrega,
    actualizarEntrega,
    marcarArticuloEntregado,
    confirmarDestino,
    getEntregaById
  }
})
