<script setup lang="ts">
useHead({ title: 'Artículos Entregados' })

const store = useInventarioStore()
const entregasStore = useEntregasStore()

try {
  await Promise.all([store.refreshFromApi(), entregasStore.refreshFromApi()])
} catch {
  throw createError({ statusCode: 503, statusMessage: 'No se pudieron cargar los datos.' })
}

type Vista = 'general' | 'cliente'
const vista = ref<Vista>('general')
const busqueda = ref('')

interface FilaEntregado {
  id: string
  sg: string
  descripcion: string
  cliente: string
  cantidad: number
  idEntrega: string
  descripcionEntrega: string
  idProyecto: string | null
}

const articulosEntregados = computed<FilaEntregado[]>(() => {
  const out: FilaEntregado[] = []
  for (const e of entregasStore.entregas) {
    for (const a of e.articulos) {
      if (!a.entregado) continue
      out.push({
        id: a.id,
        sg: a.sg,
        descripcion: a.descripcion,
        cliente: a.cliente,
        cantidad: a.cantidad,
        idEntrega: e.id,
        descripcionEntrega: e.descripcion,
        idProyecto: a.idProyecto
      })
    }
  }
  return out
})

const filtrados = computed(() => {
  const q = busqueda.value.trim().toLowerCase()
  if (!q) return articulosEntregados.value
  return articulosEntregados.value.filter(a =>
    a.sg.toLowerCase().includes(q) ||
    a.descripcion.toLowerCase().includes(q) ||
    a.cliente.toLowerCase().includes(q) ||
    a.descripcionEntrega.toLowerCase().includes(q)
  )
})

const totalPiezas = computed(() => filtrados.value.reduce((s, a) => s + a.cantidad, 0))

interface GrupoCliente {
  cliente: string
  articulos: FilaEntregado[]
  totalPiezas: number
}

const porCliente = computed<GrupoCliente[]>(() => {
  const map = new Map<string, FilaEntregado[]>()
  for (const a of filtrados.value) {
    if (!map.has(a.cliente)) map.set(a.cliente, [])
    map.get(a.cliente)!.push(a)
  }
  return Array.from(map.entries()).map(([cliente, arts]) => ({
    cliente,
    articulos: arts,
    totalPiezas: arts.reduce((s, a) => s + a.cantidad, 0)
  })).sort((a, b) => a.cliente.localeCompare(b.cliente, 'es'))
})

const fechaReporte = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
</script>

<template>
  <UDashboardPanel id="reporte-entregados">
    <template #header>
      <UDashboardNavbar title="Artículos Entregados">
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
      <PrintHeader titulo="Artículos Entregados" :subtitulo="`${filtrados.length} artículo(s) en ${entregasStore.entregas.length} entrega(s) · ${fechaReporte}`" />

      <div class="mb-4 flex flex-wrap gap-3 items-center print:hidden">
        <UInput v-model="busqueda" icon="i-lucide-search" placeholder="Buscar artículo, SG, cliente, entrega…" class="w-full max-w-xs" />
        <UBadge color="success" variant="soft">{{ filtrados.length }} artículos · {{ totalPiezas }} pzas entregadas</UBadge>
        <div class="ml-auto flex gap-1 bg-elevated/50 rounded-lg p-1">
          <UButton :color="vista === 'general' ? 'primary' : 'neutral'" :variant="vista === 'general' ? 'solid' : 'ghost'" size="sm" label="General" @click="vista = 'general'" />
          <UButton :color="vista === 'cliente' ? 'primary' : 'neutral'" :variant="vista === 'cliente' ? 'solid' : 'ghost'" size="sm" label="Por cliente" @click="vista = 'cliente'" />
        </div>
      </div>

      <div class="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-default bg-elevated/30 p-3 text-sm">
        <div class="text-center">
          <p class="text-xs text-muted mb-0.5">Artículos entregados</p>
          <p class="font-bold text-highlighted">{{ filtrados.length }}</p>
        </div>
        <div class="text-center border-l border-default/50">
          <p class="text-xs text-muted mb-0.5">Piezas entregadas</p>
          <p class="font-bold text-success tabular-nums">{{ totalPiezas.toLocaleString() }}</p>
        </div>
      </div>

      <div v-if="!filtrados.length" class="flex flex-col items-center justify-center py-20 text-muted gap-3">
        <UIcon name="i-lucide-package-check" class="size-10 text-muted/40" />
        <p class="text-sm">No hay artículos entregados aún. Usa el módulo de Entregas para registrar confirmaciones.</p>
      </div>

      <template v-else-if="vista === 'general'">
        <div class="overflow-x-auto rounded-lg border border-default">
          <table class="w-full border-collapse text-sm">
            <thead>
              <tr class="bg-elevated/50 text-xs uppercase tracking-wide">
                <th class="px-3 py-2.5 text-start border-b border-default font-medium">SG / Artículo</th>
                <th class="px-3 py-2.5 text-start border-b border-default font-medium">Cliente</th>
                <th class="w-16 px-3 py-2.5 text-center border-b border-default font-medium">Cant.</th>
                <th class="px-3 py-2.5 text-start border-b border-default font-medium">Entrega</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in filtrados" :key="a.id" class="hover:bg-elevated/30 transition-colors">
                <td class="px-3 py-2.5 border-b border-default">
                  <p class="font-medium text-highlighted">{{ a.descripcion }}</p>
                  <p class="text-xs text-muted font-mono">{{ a.sg }}</p>
                </td>
                <td class="px-3 py-2.5 border-b border-default text-muted">{{ a.cliente }}</td>
                <td class="px-3 py-2.5 border-b border-default text-center font-medium">{{ a.cantidad }}</td>
                <td class="px-3 py-2.5 border-b border-default">
                  <NuxtLink :to="`/entregas/${encodeURIComponent(a.idEntrega)}`" class="text-primary hover:underline text-sm print:text-gray-900 print:no-underline">
                    {{ a.descripcionEntrega }}
                  </NuxtLink>
                </td>
              </tr>
            </tbody>
            <tfoot class="bg-elevated/50 font-semibold text-sm">
              <tr>
                <td colspan="2" class="px-3 py-2.5 border-t border-default text-muted">TOTAL</td>
                <td class="px-3 py-2.5 border-t border-default text-center text-success">{{ totalPiezas }}</td>
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
            <span class="text-sm text-success font-medium">{{ g.articulos.length }} arts · {{ g.totalPiezas }} pzas</span>
          </div>
          <div class="overflow-x-auto rounded-lg border border-default">
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="bg-elevated/50 text-xs">
                  <th class="px-3 py-2 text-start border-b border-default font-medium">SG / Artículo</th>
                  <th class="w-16 px-3 py-2 text-center border-b border-default font-medium">Cant.</th>
                  <th class="px-3 py-2 text-start border-b border-default font-medium">Entrega</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="a in g.articulos" :key="a.id" class="hover:bg-elevated/30">
                  <td class="px-3 py-2 border-b border-default">
                    <p class="font-medium text-highlighted">{{ a.descripcion }}</p>
                    <p class="text-xs text-muted font-mono">{{ a.sg }}</p>
                  </td>
                  <td class="px-3 py-2 border-b border-default text-center font-medium">{{ a.cantidad }}</td>
                  <td class="px-3 py-2 border-b border-default text-sm text-muted">{{ a.descripcionEntrega }}</td>
                </tr>
              </tbody>
              <tfoot class="bg-elevated/30 text-xs font-semibold">
                <tr>
                  <td class="px-3 py-2 border-t border-default text-muted">Subtotal cliente</td>
                  <td class="px-3 py-2 border-t border-default text-center text-success">{{ g.totalPiezas }}</td>
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
