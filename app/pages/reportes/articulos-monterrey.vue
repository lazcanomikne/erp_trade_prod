<script setup lang="ts">
useHead({ title: 'Artículos en Monterrey' })

const store = useInventarioStore()
try { await store.refreshFromApi() } catch {
  throw createError({ statusCode: 503, statusMessage: 'No se pudieron cargar los datos.' })
}

type Vista = 'general' | 'cliente'
const vista = ref<Vista>('general')
const busqueda = ref('')

interface FilaArticulo {
  id: string
  sg: string
  descripcion: string
  marca?: string
  bultos?: number
  numeroRack?: string
  cantidad: number
  precio: number
  subtotal: number
  proyecto: string
  idProyecto: string
  cliente: string
  referencia?: string
}

const articulos = computed<FilaArticulo[]>(() => {
  const out: FilaArticulo[] = []
  for (const p of store.listaProyectos()) {
    const det = store.detalle(p.idProyecto)
    for (const a of det.articulos) {
      if (a.estatus !== 'Monterrey') continue
      out.push({
        id: a.id, sg: a.sg, descripcion: a.descripcion,
        marca: a.marca, bultos: a.bultos, numeroRack: a.numeroRack,
        cantidad: a.cantidadTotal,
        precio: a.precioUnitario,
        subtotal: a.cantidadTotal * a.precioUnitario,
        proyecto: p.nombre, idProyecto: p.idProyecto, cliente: p.cliente,
        referencia: a.referenciaLogistica
      })
    }
  }
  return out
})

const filtrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return articulos.value
  return articulos.value.filter(a =>
    a.sg.toLowerCase().includes(q) ||
    a.descripcion.toLowerCase().includes(q) ||
    a.cliente.toLowerCase().includes(q) ||
    a.proyecto.toLowerCase().includes(q) ||
    (a.marca ?? '').toLowerCase().includes(q)
  )
})

const totalSubtotal = computed(() => filtrados.value.reduce((s, a) => s + a.subtotal, 0))
const totalCantidad = computed(() => filtrados.value.reduce((s, a) => s + a.cantidad, 0))

interface GrupoCliente {
  cliente: string
  articulos: FilaArticulo[]
  totalCantidad: number
  totalSubtotal: number
}

const porCliente = computed<GrupoCliente[]>(() => {
  const map = new Map<string, FilaArticulo[]>()
  for (const a of filtrados.value) {
    if (!map.has(a.cliente)) map.set(a.cliente, [])
    map.get(a.cliente)!.push(a)
  }
  return Array.from(map.entries()).map(([cliente, arts]) => ({
    cliente,
    articulos: arts,
    totalCantidad: arts.reduce((s, a) => s + a.cantidad, 0),
    totalSubtotal: arts.reduce((s, a) => s + a.subtotal, 0)
  })).sort((a, b) => a.cliente.localeCompare(b.cliente, 'es'))
})

function fmt(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v)
}

const fechaReporte = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
</script>

<template>
  <UDashboardPanel id="reporte-monterrey">
    <template #header>
      <UDashboardNavbar title="Artículos en Monterrey">
        <template #leading>
          <div class="flex items-center gap-2">
            <UDashboardSidebarCollapse />
            <UButton to="/reportes" icon="i-lucide-arrow-left" color="neutral" variant="ghost" square />
          </div>
        </template>
        <template #right>
          <UButton icon="i-lucide-printer" label="Imprimir" color="neutral" variant="outline" class="print:hidden" @click="window.print()" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <PrintHeader titulo="Artículos en Monterrey" :subtitulo="`${filtrados.length} artículo(s) · ${fechaReporte}`" />

      <div class="mb-4 flex flex-wrap gap-3 items-center print:hidden">
        <UInput v-model="busqueda" icon="i-lucide-search" placeholder="Buscar artículo, SG, cliente…" class="w-full max-w-xs" />
        <UBadge color="success" variant="soft">{{ filtrados.length }} artículos · {{ totalCantidad }} pzas</UBadge>
        <div class="ml-auto flex gap-1 bg-elevated/50 rounded-lg p-1">
          <UButton :color="vista === 'general' ? 'primary' : 'neutral'" :variant="vista === 'general' ? 'solid' : 'ghost'" size="sm" label="General" @click="vista = 'general'" />
          <UButton :color="vista === 'cliente' ? 'primary' : 'neutral'" :variant="vista === 'cliente' ? 'solid' : 'ghost'" size="sm" label="Por cliente" @click="vista = 'cliente'" />
        </div>
      </div>

      <div class="mb-4 grid grid-cols-3 gap-3 rounded-lg border border-default bg-elevated/30 p-3 text-sm">
        <div class="text-center">
          <p class="text-xs text-muted mb-0.5">Artículos</p>
          <p class="font-bold text-highlighted">{{ filtrados.length }}</p>
        </div>
        <div class="text-center border-x border-default/50">
          <p class="text-xs text-muted mb-0.5">Piezas totales</p>
          <p class="font-bold text-highlighted tabular-nums">{{ totalCantidad.toLocaleString() }}</p>
        </div>
        <div class="text-center">
          <p class="text-xs text-muted mb-0.5">Valor estimado</p>
          <p class="font-bold text-success tabular-nums">{{ fmt(totalSubtotal) }}</p>
        </div>
      </div>

      <template v-if="vista === 'general'">
        <div class="overflow-x-auto rounded-lg border border-default">
          <table class="w-full border-collapse text-sm">
            <thead>
              <tr class="bg-elevated/50 text-xs uppercase tracking-wide">
                <th class="px-3 py-2.5 text-start border-b border-default font-medium">SG / Artículo</th>
                <th class="w-28 px-3 py-2.5 text-start border-b border-default font-medium">Marca</th>
                <th class="w-16 px-3 py-2.5 text-center border-b border-default font-medium">Bultos</th>
                <th class="w-20 px-3 py-2.5 text-center border-b border-default font-medium">Rack</th>
                <th class="w-16 px-3 py-2.5 text-center border-b border-default font-medium">Cant.</th>
                <th class="w-28 px-3 py-2.5 text-end border-b border-default font-medium">Precio</th>
                <th class="w-28 px-3 py-2.5 text-end border-b border-default font-medium">Subtotal</th>
                <th class="px-3 py-2.5 text-start border-b border-default font-medium">Proyecto / Cliente</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!filtrados.length">
                <td colspan="8" class="py-12 text-center text-muted text-sm">Sin artículos en Monterrey.</td>
              </tr>
              <tr v-for="a in filtrados" :key="a.id" class="hover:bg-elevated/30 transition-colors">
                <td class="px-3 py-2.5 border-b border-default">
                  <p class="font-medium text-highlighted">{{ a.descripcion }}</p>
                  <p class="text-xs text-muted font-mono">{{ a.sg }}<span v-if="a.referencia"> · {{ a.referencia }}</span></p>
                </td>
                <td class="px-3 py-2.5 border-b border-default text-sm text-muted">{{ a.marca || '—' }}</td>
                <td class="px-3 py-2.5 border-b border-default text-center text-sm">{{ a.bultos ?? '—' }}</td>
                <td class="px-3 py-2.5 border-b border-default text-center text-sm font-mono">{{ a.numeroRack || '—' }}</td>
                <td class="px-3 py-2.5 border-b border-default text-center font-medium">{{ a.cantidad }}</td>
                <td class="px-3 py-2.5 border-b border-default text-end tabular-nums text-muted">{{ fmt(a.precio) }}</td>
                <td class="px-3 py-2.5 border-b border-default text-end tabular-nums font-medium text-success">{{ fmt(a.subtotal) }}</td>
                <td class="px-3 py-2.5 border-b border-default">
                  <p class="text-sm text-muted">{{ a.proyecto }}</p>
                  <p class="text-xs text-muted">{{ a.cliente }}</p>
                </td>
              </tr>
            </tbody>
            <tfoot class="bg-elevated/50 font-semibold text-sm">
              <tr>
                <td colspan="4" class="px-3 py-2.5 border-t border-default text-muted">TOTAL ({{ filtrados.length }} artículos)</td>
                <td class="px-3 py-2.5 border-t border-default text-center">{{ totalCantidad }}</td>
                <td class="px-3 py-2.5 border-t border-default" />
                <td class="px-3 py-2.5 border-t border-default text-end tabular-nums text-success">{{ fmt(totalSubtotal) }}</td>
                <td class="px-3 py-2.5 border-t border-default" />
              </tr>
            </tfoot>
          </table>
        </div>
      </template>

      <template v-else>
        <div v-for="g in porCliente" :key="g.cliente" class="mb-6">
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-semibold text-highlighted flex items-center gap-2">
              <UIcon name="i-lucide-building-2" class="size-4 text-muted" />
              {{ g.cliente }}
            </h3>
            <span class="text-sm text-success tabular-nums font-medium">{{ g.articulos.length }} arts · {{ g.totalCantidad }} pzas · {{ fmt(g.totalSubtotal) }}</span>
          </div>
          <div class="overflow-x-auto rounded-lg border border-default">
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="bg-elevated/50 text-xs">
                  <th class="px-3 py-2 text-start border-b border-default font-medium">SG / Artículo</th>
                  <th class="w-24 px-3 py-2 text-start border-b border-default font-medium">Marca</th>
                  <th class="w-14 px-3 py-2 text-center border-b border-default font-medium">Bultos</th>
                  <th class="w-16 px-3 py-2 text-center border-b border-default font-medium">Rack</th>
                  <th class="w-14 px-3 py-2 text-center border-b border-default font-medium">Cant.</th>
                  <th class="w-24 px-3 py-2 text-end border-b border-default font-medium">Subtotal</th>
                  <th class="px-3 py-2 text-start border-b border-default font-medium">Proyecto</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="a in g.articulos" :key="a.id" class="hover:bg-elevated/30">
                  <td class="px-3 py-2 border-b border-default">
                    <p class="font-medium text-highlighted">{{ a.descripcion }}</p>
                    <p class="text-xs text-muted font-mono">{{ a.sg }}</p>
                  </td>
                  <td class="px-3 py-2 border-b border-default text-sm text-muted">{{ a.marca || '—' }}</td>
                  <td class="px-3 py-2 border-b border-default text-center text-sm">{{ a.bultos ?? '—' }}</td>
                  <td class="px-3 py-2 border-b border-default text-center text-sm font-mono">{{ a.numeroRack || '—' }}</td>
                  <td class="px-3 py-2 border-b border-default text-center font-medium">{{ a.cantidad }}</td>
                  <td class="px-3 py-2 border-b border-default text-end tabular-nums text-success">{{ fmt(a.subtotal) }}</td>
                  <td class="px-3 py-2 border-b border-default text-sm text-muted">{{ a.proyecto }}</td>
                </tr>
              </tbody>
              <tfoot class="bg-elevated/30 text-xs font-semibold">
                <tr>
                  <td colspan="4" class="px-3 py-2 border-t border-default text-muted">Subtotal</td>
                  <td class="px-3 py-2 border-t border-default text-center">{{ g.totalCantidad }}</td>
                  <td class="px-3 py-2 border-t border-default text-end tabular-nums text-success">{{ fmt(g.totalSubtotal) }}</td>
                  <td class="px-3 py-2 border-t border-default" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </template>

      <p class="mt-4 text-xs text-muted print:text-gray-500">
        Reporte generado el {{ fechaReporte }} · Logística Internacional — Transportación & Estancias Especiales
      </p>
    </template>
  </UDashboardPanel>
</template>

<style>
@media print {
  aside, nav, header { display: none !important; }
}
</style>
